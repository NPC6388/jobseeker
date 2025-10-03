const { chromium } = require('playwright');
const FormFieldClassifier = require('./formFieldClassifier');
const ApplicationDataExtractor = require('./applicationDataExtractor');
const EventEmitter = require('events');

/**
 * SmartApplicationHandler
 *
 * Handles job applications intelligently:
 * - Auto-fills fields from resume data
 * - Identifies fields that need manual input
 * - Pauses and notifies user when manual input is required
 * - Supports full automation mode with smart pausing
 */
class SmartApplicationHandler extends EventEmitter {
    constructor(options = {}) {
        super();
        this.browser = null;
        this.page = null;
        this.classifier = new FormFieldClassifier();
        this.dataExtractor = new ApplicationDataExtractor();
        this.applicationData = null;

        this.options = {
            headless: options.headless !== undefined ? options.headless : false, // Show browser by default for manual input
            autoMode: options.autoMode || false,
            pauseOnManualFields: options.pauseOnManualFields !== undefined ? options.pauseOnManualFields : true,
            timeout: options.timeout || 60000
        };

        // State management
        this.state = {
            isRunning: false,
            isPaused: false,
            currentJob: null,
            currentForm: null,
            manualFieldsNeeded: [],
            filledFields: [],
            status: 'idle'
        };
    }

    async initialize() {
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: this.options.headless,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            this.page = await this.browser.newPage();
            await this.page.setExtraHTTPHeaders({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            });

            this.emit('initialized');
        }

        // Load application data if not already loaded
        if (!this.applicationData) {
            this.applicationData = await this.dataExtractor.extractComprehensiveData();
            this.emit('dataLoaded', this.applicationData);
        }
    }

    /**
     * Apply to a job with smart handling
     * @param {Object} job - Job information
     * @returns {Promise<Object>} - Application result
     */
    async applyToJob(job) {
        await this.initialize();

        this.state.isRunning = true;
        this.state.currentJob = job;
        this.state.status = 'navigating';
        this.emit('applicationStarted', job);

        try {
            // Navigate to job URL
            await this.page.goto(job.jobUrl, {
                waitUntil: 'networkidle',
                timeout: this.options.timeout
            });

            this.state.status = 'finding_application_form';
            this.emit('statusUpdate', { status: 'Finding application form' });

            // Find and click apply button
            const applied = await this.findAndClickApplyButton();
            if (!applied) {
                throw new Error('Could not find apply button');
            }

            // Wait for application form to load
            await this.page.waitForTimeout(2000);

            // Analyze the form
            this.state.status = 'analyzing_form';
            this.emit('statusUpdate', { status: 'Analyzing application form' });

            const formAnalysis = await this.analyzeApplicationForm();

            if (formAnalysis.manual.length > 0 && this.options.pauseOnManualFields) {
                // There are fields that need manual input
                this.state.status = 'needs_manual_input';
                this.state.manualFieldsNeeded = formAnalysis.manual;

                this.emit('manualInputRequired', {
                    job,
                    fields: formAnalysis.manual,
                    message: `${formAnalysis.manual.length} field(s) need your attention`
                });

                if (this.options.autoMode) {
                    // In auto mode, pause and wait for user
                    await this.pauseForManualInput(formAnalysis.manual);
                } else {
                    // In manual mode, return control to user
                    return {
                        success: false,
                        status: 'needs_manual_input',
                        manualFields: formAnalysis.manual,
                        message: 'Manual input required'
                    };
                }
            }

            // Fill answerable fields
            this.state.status = 'filling_form';
            this.emit('statusUpdate', { status: 'Filling application form' });

            const fillResult = await this.fillApplicationForm(formAnalysis);

            // Check if we should submit
            if (process.env.AUTO_SUBMIT === 'true' && this.options.autoMode) {
                this.state.status = 'submitting';
                this.emit('statusUpdate', { status: 'Submitting application' });

                await this.submitApplication();

                this.emit('applicationCompleted', {
                    job,
                    success: true,
                    fieldsFilled: fillResult.filled,
                    manualFieldsCompleted: formAnalysis.manual.length
                });

                return {
                    success: true,
                    status: 'submitted',
                    fieldsFilled: fillResult.filled,
                    manualFieldsCompleted: formAnalysis.manual.length
                };
            } else {
                this.emit('applicationCompleted', {
                    job,
                    success: true,
                    status: 'filled_not_submitted',
                    fieldsFilled: fillResult.filled
                });

                return {
                    success: true,
                    status: 'filled_not_submitted',
                    fieldsFilled: fillResult.filled,
                    message: 'Form filled but not submitted (AUTO_SUBMIT=false)'
                };
            }

        } catch (error) {
            this.state.status = 'error';
            this.emit('applicationError', { job, error: error.message });

            return {
                success: false,
                status: 'error',
                error: error.message
            };
        } finally {
            this.state.isRunning = false;
            this.state.currentJob = null;
        }
    }

    /**
     * Find and click the apply button
     * @returns {Promise<boolean>}
     */
    async findAndClickApplyButton() {
        const applySelectors = [
            'button:has-text("Apply")',
            'a:has-text("Apply")',
            '[data-testid*="apply"]',
            '.apply-button',
            '#apply-button',
            'button[aria-label*="Apply"]'
        ];

        for (const selector of applySelectors) {
            try {
                const button = this.page.locator(selector).first();
                if (await button.isVisible({ timeout: 2000 })) {
                    await button.click();
                    return true;
                }
            } catch (e) {
                continue;
            }
        }

        return false;
    }

    /**
     * Analyze the application form
     * @returns {Promise<Object>} - Form analysis
     */
    async analyzeApplicationForm() {
        // Find all input fields
        const fields = await this.page.$$('input:not([type="hidden"]), textarea, select');

        const fieldInfos = [];
        for (const field of fields) {
            const info = await this.classifier.extractFieldInfo(field);
            if (info) {
                fieldInfos.push(info);
            }
        }

        // Classify each field
        const classified = fieldInfos.map(field => ({
            field,
            classification: this.classifier.classifyField(field)
        }));

        const answerable = classified.filter(c => c.classification.type === 'answerable');
        const manual = classified.filter(c => c.classification.type === 'manual');
        const uncertain = classified.filter(c => c.classification.type === 'uncertain');

        return {
            total: fieldInfos.length,
            answerable,
            manual,
            uncertain,
            summary: {
                canAutoFill: answerable.length,
                needsManualInput: manual.length,
                uncertain: uncertain.length
            }
        };
    }

    /**
     * Fill the application form with available data
     * @param {Object} formAnalysis - Form analysis result
     * @returns {Promise<Object>} - Fill result
     */
    async fillApplicationForm(formAnalysis) {
        const filled = [];
        const failed = [];

        for (const { field, classification } of formAnalysis.answerable) {
            try {
                const value = this.getFieldValue(classification);
                if (value) {
                    await field.element.fill(value);
                    filled.push({
                        field: field.label || field.name,
                        value: value
                    });
                    this.emit('fieldFilled', { field: field.label || field.name, value });
                }
            } catch (error) {
                failed.push({
                    field: field.label || field.name,
                    error: error.message
                });
            }
        }

        return { filled, failed };
    }

    /**
     * Get field value from application data
     * @param {Object} classification - Field classification
     * @returns {string|null}
     */
    getFieldValue(classification) {
        const data = this.applicationData;

        if (!data) return null;

        switch (classification.source) {
            case 'personalInfo':
                if (classification.category === 'personalInfo') {
                    return data.personalInfo?.name || data.personalInfo?.email || data.personalInfo?.phone || null;
                }
                break;

            case 'professionalInfo':
                return data.professionalInfo?.currentTitle || data.professionalInfo?.company || null;

            case 'education':
                return data.education?.[0]?.degree || data.education?.[0]?.institution || null;

            case 'workAuthorization':
                return 'Yes'; // Default for work authorization

            case 'availability':
                return 'Immediate'; // Default availability

            default:
                return null;
        }
    }

    /**
     * Pause and wait for manual input
     * @param {Array} manualFields - Fields requiring manual input
     * @returns {Promise<void>}
     */
    async pauseForManualInput(manualFields) {
        this.state.isPaused = true;

        // Navigate to the first manual field
        if (manualFields.length > 0 && manualFields[0].field.element) {
            try {
                await manualFields[0].field.element.scrollIntoViewIfNeeded();
                await manualFields[0].field.element.focus();
            } catch (e) {
                console.error('Could not focus on manual field:', e.message);
            }
        }

        // Emit event with notification
        this.emit('pausedForManualInput', {
            fields: manualFields,
            message: `Please fill in ${manualFields.length} field(s) manually, then click Continue`
        });

        // Wait for user to resume
        return new Promise((resolve) => {
            this.once('userResumed', () => {
                this.state.isPaused = false;
                resolve();
            });
        });
    }

    /**
     * Resume application after manual input
     */
    resumeApplication() {
        if (this.state.isPaused) {
            this.emit('userResumed');
        }
    }

    /**
     * Submit the application
     * @returns {Promise<boolean>}
     */
    async submitApplication() {
        const submitSelectors = [
            'button[type="submit"]',
            'button:has-text("Submit")',
            'input[type="submit"]',
            '[data-testid*="submit"]'
        ];

        for (const selector of submitSelectors) {
            try {
                const button = this.page.locator(selector).first();
                if (await button.isVisible({ timeout: 2000 })) {
                    await button.click();
                    await this.page.waitForTimeout(2000);
                    return true;
                }
            } catch (e) {
                continue;
            }
        }

        return false;
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }

    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
}

module.exports = SmartApplicationHandler;
