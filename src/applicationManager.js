const fs = require('fs-extra');
const path = require('path');
const { chromium } = require('playwright');
const ApplicationDataExtractor = require('./applicationDataExtractor');

class ApplicationManager {
    constructor() {
        this.browser = null;
        this.page = null;
        this.dataExtractor = new ApplicationDataExtractor();
        this.applicationData = null;
        this.personalInfo = {
            name: process.env.YOUR_NAME,
            email: process.env.YOUR_EMAIL,
            phone: process.env.YOUR_PHONE
        };
    }

    async initialize() {
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: false, // Set to true for production
            });
            this.page = await this.browser.newPage();
            await this.page.setExtraHTTPHeaders({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            });
        }

        // Load comprehensive application data if not already loaded
        if (!this.applicationData) {
            console.log('📄 Loading comprehensive application data...');
            this.applicationData = await this.dataExtractor.extractComprehensiveData();
        }
    }

    async applyToJob(job) {
        try {
            await this.initialize();

            if (job.source === 'Indeed') {
                return await this.applyToIndeedJob(job);
            } else if (job.source === 'LinkedIn') {
                return await this.applyToLinkedInJob(job);
            } else if (job.source === 'Craigslist') {
                return await this.applyToCraigslistJob(job);
            } else if (job.source === 'ZipRecruiter') {
                return await this.applyToZipRecruiterJob(job);
            }

            return false;
        } catch (error) {
            console.error('❌ Application error:', error.message);
            return false;
        }
    }

    async applyToIndeedJob(job) {
        try {
            console.log(`   🔗 Opening Indeed job: ${job.jobUrl}`);
            await this.page.goto(job.jobUrl, { waitUntil: 'networkidle2' });

            // Check if "Apply Now" button exists
            const applyButton = await this.page.locator('.jobsearch-IndeedApplyButton-link, .indeed-apply-button').first();

            if (!(await applyButton.isVisible().catch(() => false))) {
                console.log('   ℹ️  No direct apply button found - external application required');
                return false;
            }

            // Click apply button
            await applyButton.click();
            await this.page.waitForTimeout(2000);

            // Check if Indeed's application form loaded
            const hasIndeedForm = await this.page.$('.indeed-apply-widget');

            if (hasIndeedForm) {
                return await this.fillIndeedApplicationForm();
            } else {
                // External site - try generic form filling
                return await this.fillGenericApplicationForm();
            }

        } catch (error) {
            console.error('   ❌ Indeed application error:', error.message);
            return false;
        }
    }

    async fillIndeedApplicationForm() {
        try {
            // Fill personal information
            await this.fillFieldIfExists('input[name="applicant.name"]', this.personalInfo.name);
            await this.fillFieldIfExists('input[name="applicant.email"]', this.personalInfo.email);
            await this.fillFieldIfExists('input[name="applicant.phoneNumber"]', this.personalInfo.phone);

            // Upload resume if file input exists
            await this.uploadResumeIfExists();

            // Fill cover letter if text area exists
            await this.fillCoverLetterIfExists();

            // Check if we should auto-submit
            if (process.env.AUTO_SUBMIT === 'true') {
                const submitButton = await this.page.$('button[type="submit"], .indeed-apply-button-label');
                if (submitButton) {
                    await submitButton.click();
                    await this.page.waitForTimeout(3000);
                    return true;
                }
            }

            console.log('   ℹ️  Application form filled but not submitted (AUTO_SUBMIT=false)');
            return true;

        } catch (error) {
            console.error('   ❌ Error filling Indeed form:', error.message);
            return false;
        }
    }

    async applyToLinkedInJob(job) {
        try {
            console.log('   ℹ️  LinkedIn applications require manual login - skipping automatic application');
            return false;
        } catch (error) {
            console.error('   ❌ LinkedIn application error:', error.message);
            return false;
        }
    }

    async applyToCraigslistJob(job) {
        try {
            console.log(`   🔗 Opening Craigslist job: ${job.jobUrl}`);
            await this.page.goto(job.jobUrl, { waitUntil: 'networkidle' });

            // Look for contact email or reply button
            const replyButton = await this.page.locator('a[href*="mailto"], .reply-link').first();

            if (await replyButton.isVisible().catch(() => false)) {
                console.log('   📧 Craigslist job requires email response - opening email client');
                await replyButton.click();
                await this.page.waitForTimeout(2000);
                return true;
            } else {
                console.log('   ℹ️  No reply option found for this Craigslist job');
                return false;
            }

        } catch (error) {
            console.error('   ❌ Craigslist application error:', error.message);
            return false;
        }
    }

    async applyToZipRecruiterJob(job) {
        try {
            console.log(`   🔗 Opening ZipRecruiter job: ${job.jobUrl}`);
            await this.page.goto(job.jobUrl, { waitUntil: 'networkidle' });

            // Look for apply button
            const applyButton = await this.page.locator('button[data-testid="apply-button"], .apply-button, [data-testid="job-apply-button"]').first();

            if (await applyButton.isVisible().catch(() => false)) {
                await applyButton.click();
                await this.page.waitForTimeout(3000);

                // Try to fill the application form
                return await this.fillGenericApplicationForm();
            } else {
                console.log('   ℹ️  No apply button found for this ZipRecruiter job');
                return false;
            }

        } catch (error) {
            console.error('   ❌ ZipRecruiter application error:', error.message);
            return false;
        }
    }

    async fillGenericApplicationForm() {
        try {
            // Try to find and fill common form fields
            await this.fillFieldIfExists('input[name*="name"], input[id*="name"], input[placeholder*="name"]', this.personalInfo.name);
            await this.fillFieldIfExists('input[name*="email"], input[id*="email"], input[type="email"]', this.personalInfo.email);
            await this.fillFieldIfExists('input[name*="phone"], input[id*="phone"], input[type="tel"]', this.personalInfo.phone);

            // Upload resume
            await this.uploadResumeIfExists();

            // Fill cover letter
            await this.fillCoverLetterIfExists();

            console.log('   ✅ Generic form filled successfully');
            return true;

        } catch (error) {
            console.error('   ❌ Error filling generic form:', error.message);
            return false;
        }
    }

    async fillFieldIfExists(selector, value) {
        try {
            const field = this.page.locator(selector).first();
            if (await field.isVisible().catch(() => false) && value) {
                await field.click();
                await field.fill('');
                await field.fill(value);
            }
        } catch (error) {
            // Silently fail if field doesn't exist
        }
    }

    async uploadResumeIfExists() {
        try {
            const resumePath = process.env.RESUME_PATH;
            if (!resumePath || !await fs.pathExists(resumePath)) {
                console.log('   ⚠️  Resume file not found - skipping upload');
                return;
            }

            const fileInput = this.page.locator('input[type="file"]').first();
            if (await fileInput.isVisible().catch(() => false)) {
                await fileInput.setInputFiles(path.resolve(resumePath));
                console.log('   📎 Resume uploaded successfully');
            }
        } catch (error) {
            console.log('   ⚠️  Could not upload resume:', error.message);
        }
    }

    async fillCoverLetterIfExists() {
        try {
            const coverLetterPath = process.env.COVER_LETTER_PATH;
            if (!coverLetterPath || !await fs.pathExists(coverLetterPath)) {
                return;
            }

            const coverLetter = await fs.readFile(coverLetterPath, 'utf8');
            const textArea = this.page.locator('textarea[name*="cover"], textarea[id*="cover"], textarea[placeholder*="cover"]').first();

            if (await textArea.isVisible().catch(() => false)) {
                await textArea.click();
                await textArea.fill(coverLetter);
                console.log('   📝 Cover letter added successfully');
            }
        } catch (error) {
            console.log('   ⚠️  Could not add cover letter:', error.message);
        }
    }

    // Comprehensive form filling methods
    async fillPersonalInformation(page) {
        const data = this.applicationData.personalInfo;

        // Common personal info field selectors
        const selectors = {
            firstName: ['input[name*="first"]', 'input[id*="first"]', '#firstName', '#fname'],
            lastName: ['input[name*="last"]', 'input[id*="last"]', '#lastName', '#lname'],
            fullName: ['input[name*="name"]', 'input[id*="name"]', '#name', '#fullName'],
            email: ['input[type="email"]', 'input[name*="email"]', '#email'],
            phone: ['input[type="tel"]', 'input[name*="phone"]', '#phone'],
            address: ['input[name*="address"]', 'input[id*="address"]', '#address'],
            city: ['input[name*="city"]', 'input[id*="city"]', '#city'],
            state: ['select[name*="state"]', 'input[name*="state"]', '#state'],
            zipCode: ['input[name*="zip"]', 'input[name*="postal"]', '#zip', '#zipCode']
        };

        try {
            await this.safelyFillField(page, selectors.firstName, data.firstName);
            await this.safelyFillField(page, selectors.lastName, data.lastName);
            await this.safelyFillField(page, selectors.fullName, data.fullName);
            await this.safelyFillField(page, selectors.email, data.email);
            await this.safelyFillField(page, selectors.phone, data.phone);
            await this.safelyFillField(page, selectors.address, data.address.street);
            await this.safelyFillField(page, selectors.city, data.address.city);
            await this.safelyFillField(page, selectors.state, data.address.state);
            await this.safelyFillField(page, selectors.zipCode, data.address.zipCode);

            console.log('✅ Personal information auto-filled');
        } catch (error) {
            console.error('❌ Error filling personal info:', error.message);
        }
    }

    async fillWorkHistory(page) {
        const workHistory = this.applicationData.workHistory;

        try {
            // Fill most recent job (common on application forms)
            const recentJob = workHistory[0];
            if (recentJob) {
                const selectors = {
                    jobTitle: ['input[name*="title"]', 'input[id*="title"]', '#jobTitle'],
                    company: ['input[name*="company"]', 'input[id*="company"]', '#company'],
                    startDate: ['input[name*="start"]', 'input[id*="start"]', '#startDate'],
                    endDate: ['input[name*="end"]', 'input[id*="end"]', '#endDate'],
                    salary: ['input[name*="salary"]', 'input[id*="salary"]', '#salary'],
                    supervisor: ['input[name*="supervisor"]', 'input[id*="supervisor"]', '#supervisor']
                };

                await this.safelyFillField(page, selectors.jobTitle, recentJob.jobTitle);
                await this.safelyFillField(page, selectors.company, recentJob.company);
                await this.safelyFillField(page, selectors.startDate, recentJob.startDate);
                await this.safelyFillField(page, selectors.endDate, recentJob.endDate);
                await this.safelyFillField(page, selectors.salary, recentJob.salary);
                await this.safelyFillField(page, selectors.supervisor, recentJob.supervisor.name);

                console.log('✅ Work history auto-filled');
            }
        } catch (error) {
            console.error('❌ Error filling work history:', error.message);
        }
    }

    async fillEducation(page) {
        const education = this.applicationData.education;

        try {
            const recentEducation = education[0];
            if (recentEducation) {
                const selectors = {
                    school: ['input[name*="school"]', 'input[id*="school"]', '#school'],
                    degree: ['input[name*="degree"]', 'select[name*="degree"]', '#degree'],
                    graduationDate: ['input[name*="graduation"]', 'input[id*="graduation"]', '#graduationDate'],
                    gpa: ['input[name*="gpa"]', 'input[id*="gpa"]', '#gpa']
                };

                await this.safelyFillField(page, selectors.school, recentEducation.school);
                await this.safelyFillField(page, selectors.degree, recentEducation.degree);
                await this.safelyFillField(page, selectors.graduationDate, recentEducation.graduationDate);

                console.log('✅ Education information auto-filled');
            }
        } catch (error) {
            console.error('❌ Error filling education:', error.message);
        }
    }

    async fillWorkAuthorization(page) {
        const auth = this.applicationData.workAuthorization;

        try {
            // Common work authorization questions
            const selectors = {
                authorized: ['input[name*="authorized"]', 'input[id*="authorized"]'],
                sponsorship: ['input[name*="sponsor"]', 'input[id*="sponsor"]'],
                citizenship: ['select[name*="citizen"]', 'input[name*="citizen"]']
            };

            // Fill yes/no for work authorization
            await this.safelySelectOption(page, selectors.authorized, auth.authorizedToWork ? 'yes' : 'no');
            await this.safelySelectOption(page, selectors.sponsorship, auth.needSponsorship ? 'yes' : 'no');
            await this.safelyFillField(page, selectors.citizenship, auth.citizenship);

            console.log('✅ Work authorization auto-filled');
        } catch (error) {
            console.error('❌ Error filling work authorization:', error.message);
        }
    }

    async fillAvailability(page) {
        const prefs = this.applicationData.preferences;

        try {
            const selectors = {
                startDate: ['input[name*="start"]', 'input[id*="available"]', '#startDate'],
                salary: ['input[name*="salary"]', 'input[id*="salary"]', '#expectedSalary'],
                schedule: ['select[name*="schedule"]', 'input[name*="schedule"]']
            };

            await this.safelyFillField(page, selectors.startDate, prefs.startDate);
            await this.safelyFillField(page, selectors.salary, prefs.desiredSalary);

            console.log('✅ Availability information auto-filled');
        } catch (error) {
            console.error('❌ Error filling availability:', error.message);
        }
    }

    async safelyFillField(page, selectors, value) {
        if (!value) return;

        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    await element.fill(value.toString());
                    await page.waitForTimeout(100); // Small delay for UI updates
                    return;
                }
            } catch (error) {
                // Continue to next selector
            }
        }
    }

    async safelySelectOption(page, selectors, value) {
        if (!value) return;

        for (const selector of selectors) {
            try {
                const element = await page.$(selector);
                if (element) {
                    const tagName = await element.evaluate(el => el.tagName);

                    if (tagName === 'SELECT') {
                        await element.selectOption(value.toString());
                    } else if (tagName === 'INPUT') {
                        const type = await element.getAttribute('type');
                        if (type === 'radio' || type === 'checkbox') {
                            if (value.toString().toLowerCase() === 'yes' || value === true) {
                                await element.check();
                            }
                        } else {
                            await element.fill(value.toString());
                        }
                    }
                    await page.waitForTimeout(100);
                    return;
                }
            } catch (error) {
                // Continue to next selector
            }
        }
    }

    // Auto-fill comprehensive application data
    async autoFillApplication(page, job) {
        console.log('🤖 Auto-filling application with comprehensive data...');

        try {
            // Get job-specific data
            const jobSpecificData = this.getJobSpecificData(job);

            // Fill different sections of the application
            await this.fillPersonalInformation(page);
            await page.waitForTimeout(500);

            await this.fillWorkHistory(page);
            await page.waitForTimeout(500);

            await this.fillEducation(page);
            await page.waitForTimeout(500);

            await this.fillWorkAuthorization(page);
            await page.waitForTimeout(500);

            await this.fillAvailability(page);
            await page.waitForTimeout(500);

            // Upload resume if found
            await this.uploadResumeToPage(page);

            console.log('✅ Application auto-filled successfully');
            return true;

        } catch (error) {
            console.error('❌ Error auto-filling application:', error.message);
            return false;
        }
    }

    // Get job-specific application data
    getJobSpecificData(job) {
        return this.dataExtractor.getJobSpecificData(job.title, job.summary || '');
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

module.exports = ApplicationManager;