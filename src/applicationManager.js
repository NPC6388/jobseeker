const fs = require('fs-extra');
const path = require('path');
const puppeteer = require('puppeteer');

class ApplicationManager {
    constructor() {
        this.browser = null;
        this.page = null;
        this.personalInfo = {
            name: process.env.YOUR_NAME,
            email: process.env.YOUR_EMAIL,
            phone: process.env.YOUR_PHONE
        };
    }

    async initialize() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: false, // Set to true for production
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            this.page = await this.browser.newPage();
            await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        }
    }

    async applyToJob(job) {
        try {
            await this.initialize();

            if (job.source === 'Indeed') {
                return await this.applyToIndeedJob(job);
            } else if (job.source === 'LinkedIn') {
                return await this.applyToLinkedInJob(job);
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
            const applyButton = await this.page.$('.jobsearch-IndeedApplyButton-link, .indeed-apply-button');

            if (!applyButton) {
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
            const field = await this.page.$(selector);
            if (field && value) {
                await field.click();
                await field.evaluate(el => el.value = '');
                await field.type(value);
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

            const fileInput = await this.page.$('input[type="file"]');
            if (fileInput) {
                await fileInput.uploadFile(path.resolve(resumePath));
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
            const textArea = await this.page.$('textarea[name*="cover"], textarea[id*="cover"], textarea[placeholder*="cover"]');

            if (textArea) {
                await textArea.click();
                await textArea.type(coverLetter);
                console.log('   📝 Cover letter added successfully');
            }
        } catch (error) {
            console.log('   ⚠️  Could not add cover letter:', error.message);
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

module.exports = ApplicationManager;