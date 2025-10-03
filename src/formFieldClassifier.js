const path = require('path');

/**
 * FormFieldClassifier
 *
 * Classifies form fields into categories:
 * - answerable: Can be filled from resume/profile data
 * - manual: Requires user input
 * - optional: Can be skipped
 */
class FormFieldClassifier {
    constructor() {
        // Define field patterns that can be auto-filled
        this.answerablePatterns = {
            // Personal Information
            personalInfo: {
                patterns: [
                    /first.*name/i,
                    /last.*name/i,
                    /full.*name/i,
                    /email/i,
                    /phone/i,
                    /address/i,
                    /city/i,
                    /state/i,
                    /zip/i,
                    /postal/i,
                    /country/i
                ],
                source: 'personalInfo'
            },

            // Professional Information
            professionalInfo: {
                patterns: [
                    /current.*title/i,
                    /job.*title/i,
                    /position/i,
                    /current.*employer/i,
                    /company.*name/i,
                    /years.*experience/i,
                    /linkedin/i,
                    /portfolio/i,
                    /website/i,
                    /github/i
                ],
                source: 'professionalInfo'
            },

            // Education
            education: {
                patterns: [
                    /education/i,
                    /degree/i,
                    /university/i,
                    /college/i,
                    /school/i,
                    /graduation/i,
                    /major/i,
                    /gpa/i,
                    /diploma/i
                ],
                source: 'education'
            },

            // Work Authorization
            workAuth: {
                patterns: [
                    /authorized.*work/i,
                    /work.*authorization/i,
                    /visa.*status/i,
                    /citizen/i,
                    /right.*to.*work/i,
                    /legally.*work/i,
                    /employment.*eligibility/i
                ],
                source: 'workAuthorization'
            },

            // Availability
            availability: {
                patterns: [
                    /start.*date/i,
                    /available.*start/i,
                    /notice.*period/i,
                    /when.*can.*start/i,
                    /available.*immediately/i
                ],
                source: 'availability'
            },

            // References
            references: {
                patterns: [
                    /reference/i,
                    /professional.*contact/i,
                    /former.*supervisor/i
                ],
                source: 'references'
            }
        };

        // Patterns that REQUIRE manual input
        this.manualPatterns = [
            /why.*want.*work/i,
            /why.*interested/i,
            /tell.*us.*about/i,
            /describe.*yourself/i,
            /strengths.*weaknesses/i,
            /biggest.*achievement/i,
            /handle.*conflict/i,
            /example.*of/i,
            /situation.*where/i,
            /cover.*letter/i,
            /additional.*information/i,
            /anything.*else/i,
            /salary.*expectation/i,
            /salary.*requirement/i,
            /desired.*salary/i,
            /compensation.*expectation/i,
            /criminal.*history/i,
            /been.*convicted/i,
            /background.*check/i,
            /drug.*test/i,
            /relocation/i,
            /willing.*to.*relocate/i,
            /travel.*required/i,
            /security.*clearance/i,
            /veteran.*status/i,
            /disability/i,
            /gender/i,
            /race/i,
            /ethnicity/i
        ];

        // Optional fields that can be skipped
        this.optionalPatterns = [
            /optional/i,
            /if.*applicable/i,
            /not.*required/i
        ];
    }

    /**
     * Classify a form field based on its label, name, and placeholder
     * @param {Object} field - Field information { label, name, placeholder, type, required }
     * @returns {Object} - Classification result
     */
    classifyField(field) {
        const fieldText = `${field.label || ''} ${field.name || ''} ${field.placeholder || ''}`.toLowerCase();

        // Check if optional
        const isOptional = this.optionalPatterns.some(pattern => pattern.test(fieldText)) || !field.required;

        // Check if manual input required
        const requiresManual = this.manualPatterns.some(pattern => pattern.test(fieldText));

        if (requiresManual) {
            return {
                type: 'manual',
                reason: 'Requires personal judgment or detailed response',
                canSkip: isOptional,
                priority: isOptional ? 'low' : 'high'
            };
        }

        // Check if answerable from resume
        for (const [category, config] of Object.entries(this.answerablePatterns)) {
            if (config.patterns.some(pattern => pattern.test(fieldText))) {
                return {
                    type: 'answerable',
                    source: config.source,
                    category: category,
                    canSkip: isOptional,
                    priority: field.required ? 'high' : 'medium'
                };
            }
        }

        // Field type specific classification
        if (field.type === 'file') {
            return {
                type: 'answerable',
                source: 'fileUpload',
                category: 'document',
                canSkip: isOptional,
                priority: field.required ? 'high' : 'low'
            };
        }

        if (field.type === 'checkbox' || field.type === 'radio') {
            // Likely yes/no or selection - might need manual review
            return {
                type: 'uncertain',
                reason: 'Selection field - may need verification',
                canSkip: isOptional,
                priority: field.required ? 'medium' : 'low'
            };
        }

        // Unknown field type
        return {
            type: 'uncertain',
            reason: 'Unable to determine field type',
            canSkip: isOptional,
            priority: field.required ? 'medium' : 'low'
        };
    }

    /**
     * Analyze all fields in a form
     * @param {Array} fields - Array of field objects
     * @returns {Object} - Analysis summary
     */
    analyzeForm(fields) {
        const classifications = fields.map(field => ({
            field,
            classification: this.classifyField(field)
        }));

        const summary = {
            total: fields.length,
            answerable: classifications.filter(c => c.classification.type === 'answerable').length,
            manual: classifications.filter(c => c.classification.type === 'manual').length,
            uncertain: classifications.filter(c => c.classification.type === 'uncertain').length,
            optional: classifications.filter(c => c.classification.canSkip).length,
            required: classifications.filter(c => !c.classification.canSkip).length,
            needsAttention: classifications.filter(c =>
                c.classification.type === 'manual' && c.classification.priority === 'high'
            ),
            classifications
        };

        return summary;
    }

    /**
     * Get fields that need manual attention
     * @param {Array} fields - Array of field objects
     * @returns {Array} - Fields requiring manual input
     */
    getManualFields(fields) {
        return fields
            .map(field => ({
                field,
                classification: this.classifyField(field)
            }))
            .filter(c => c.classification.type === 'manual' ||
                        (c.classification.type === 'uncertain' && c.classification.priority === 'medium'))
            .sort((a, b) => {
                // Sort by priority: high > medium > low
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                return priorityOrder[b.classification.priority] - priorityOrder[a.classification.priority];
            });
    }

    /**
     * Extract field information from a page element
     * @param {Object} element - Playwright element
     * @returns {Promise<Object>} - Field information
     */
    async extractFieldInfo(element) {
        try {
            const tagName = await element.evaluate(el => el.tagName.toLowerCase());
            const type = await element.evaluate(el => el.type || el.tagName.toLowerCase());
            const name = await element.evaluate(el => el.name || el.id || '');
            const placeholder = await element.evaluate(el => el.placeholder || '');
            const required = await element.evaluate(el => el.required || el.hasAttribute('required'));

            // Try to find associated label
            let label = '';
            try {
                const labelId = await element.evaluate(el => el.id);
                if (labelId) {
                    const labelElement = await element.evaluate((el, id) => {
                        const label = document.querySelector(`label[for="${id}"]`);
                        return label ? label.textContent : '';
                    }, labelId);
                    label = labelElement;
                }

                // If no label found, check parent elements
                if (!label) {
                    label = await element.evaluate(el => {
                        const parent = el.closest('label');
                        if (parent) return parent.textContent.replace(el.value || '', '').trim();

                        const prevElement = el.previousElementSibling;
                        if (prevElement && (prevElement.tagName === 'LABEL' || prevElement.tagName === 'SPAN')) {
                            return prevElement.textContent.trim();
                        }

                        return '';
                    });
                }
            } catch (e) {
                // Ignore label extraction errors
            }

            return {
                tagName,
                type,
                name,
                placeholder,
                label,
                required,
                element
            };
        } catch (error) {
            console.error('Error extracting field info:', error.message);
            return null;
        }
    }
}

module.exports = FormFieldClassifier;
