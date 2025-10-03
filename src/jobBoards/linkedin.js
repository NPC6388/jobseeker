const { chromium } = require('playwright');
const axios = require('axios');
const readline = require('readline');

class LinkedInScraper {
    constructor() {
        this.baseUrl = 'https://www.linkedin.com';
        this.browser = null;
        this.page = null;
        this.isLoggedIn = false;
        this.credentials = {
            email: process.env.LINKEDIN_EMAIL || '',
            password: process.env.LINKEDIN_PASSWORD || ''
        };
    }

    async promptForCredentials() {
        // If credentials are already set in env, use them
        if (this.credentials.email && this.credentials.password) {
            return this.credentials;
        }

        // If running in web mode, don't block - just return empty
        // User should use the UI to provide credentials
        console.log('⚠️ LinkedIn credentials not set. Use the web UI to login to LinkedIn.');
        return { email: '', password: '' };
    }

    async login() {
        if (this.isLoggedIn) {
            return true;
        }

        try {
            console.log('🔑 Logging into LinkedIn...');

            // Get credentials
            const creds = await this.promptForCredentials();

            if (!creds.email || !creds.password) {
                console.log('❌ LinkedIn credentials not provided, skipping LinkedIn jobs');
                return false;
            }

            // Navigate to LinkedIn login page
            await this.page.goto('https://www.linkedin.com/login', {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // Fill in credentials
            await this.page.fill('input[name="session_key"]', creds.email);
            await this.page.fill('input[name="session_password"]', creds.password);

            // Click sign in button
            await this.page.click('button[type="submit"]');

            // Wait for navigation
            await this.page.waitForTimeout(3000);

            // Check if login was successful
            const currentUrl = this.page.url();

            if (currentUrl.includes('/feed') || currentUrl.includes('/jobs')) {
                console.log('✅ Successfully logged into LinkedIn');
                this.isLoggedIn = true;
                return true;
            } else if (currentUrl.includes('/checkpoint')) {
                console.log('⚠️ LinkedIn requires additional verification (2FA/CAPTCHA)');
                console.log('📱 Please complete verification in the browser window...');

                // Wait for user to complete verification (up to 2 minutes)
                await this.page.waitForURL(url =>
                    url.includes('/feed') || url.includes('/jobs'),
                    { timeout: 120000 }
                ).catch(() => {
                    console.log('❌ Verification timeout - please try again');
                    return false;
                });

                this.isLoggedIn = true;
                console.log('✅ Verification completed, logged in successfully');
                return true;
            } else {
                console.log('❌ LinkedIn login failed');
                return false;
            }

        } catch (error) {
            console.error('❌ Error during LinkedIn login:', error.message);
            return false;
        }
    }

    async initialize() {
        try {
            this.browser = await chromium.launch({
                headless: false, // Show browser for login
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--disable-extensions',
                    '--disable-default-apps',
                    '--disable-sync',
                    '--disable-translate',
                    '--hide-scrollbars',
                    '--mute-audio',
                    '--no-first-run',
                    '--safebrowsing-disable-auto-update',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-background-networking',
                    '--disable-background-timer-throttling',
                    '--disable-renderer-backgrounding',
                    '--disable-features=TranslateUI',
                    '--disable-features=BlinkGenPropertyTrees',
                    '--disable-ipc-flooding-protection'
                ]
            });
            this.page = await this.browser.newPage();

            // Set user agent to avoid detection
            await this.page.setExtraHTTPHeaders({
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            });
        } catch (error) {
            console.error('❌ Failed to initialize LinkedIn browser:', error.message);
            this.browser = null;
            this.page = null;
            throw error;
        }
    }

    async searchJobs(location, keywords = '') {
        // Check if LinkedIn scraping is disabled
        if (process.env.DISABLE_LINKEDIN === 'true') {
            console.log('LinkedIn scraping disabled via environment variable');
            return [];
        }

        try {
            if (!this.page) {
                await this.initialize();
            }

            // Check if browser is still alive
            if (!this.browser || !this.browser.isConnected()) {
                await this.initialize();
            }

            // Login if not already logged in
            if (!this.isLoggedIn) {
                const loginSuccess = await this.login();
                if (!loginSuccess) {
                    console.log('⚠️ Skipping LinkedIn jobs - use "LinkedIn Login" button in dashboard');
                    return [];
                }
            }

            console.log('🔍 Searching LinkedIn jobs...');
            const searchUrl = `${this.baseUrl}/jobs/search/?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_JT=P&f_WT=1`; // P = Part-time, WT=1 = Remote/Hybrid

            await this.page.goto(searchUrl, {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // Wait for job listings to load with fallback
            try {
                await this.page.waitForSelector('.jobs-search__results-list', { timeout: 15000 });
            } catch (timeoutError) {
                // Fallback: try alternative selectors
                const hasJobs = await this.page.locator('.base-card').count() > 0;
                if (!hasJobs) {
                    return [];
                }
            }

            const jobs = await this.page.evaluate(() => {
                const jobElements = document.querySelectorAll('.base-card');
                const jobs = [];

                jobElements.forEach(element => {
                    const titleElement = element.querySelector('.base-search-card__title');
                    const companyElement = element.querySelector('.base-search-card__subtitle');
                    const locationElement = element.querySelector('.job-search-card__location');
                    const linkElement = element.querySelector('.base-card__full-link');

                    if (titleElement && companyElement) {
                        jobs.push({
                            title: titleElement.textContent.trim(),
                            company: companyElement.textContent.trim(),
                            location: locationElement?.textContent.trim() || '',
                            jobUrl: linkElement?.href || '',
                            source: 'LinkedIn',
                            postedDate: 'Recently posted'
                        });
                    }
                });

                return jobs;
            });

            return jobs;

        } catch (error) {
            console.error('❌ Error scraping LinkedIn with Playwright:', error.message);

            // Try to reinitialize browser if connection was lost
            if (error.message.includes('Target page, context or browser has been closed')) {
                try {
                    await this.close();
                    await this.initialize();
                } catch (reinitError) {
                    console.error('❌ Failed to reinitialize LinkedIn browser:', reinitError.message);
                }
            }

            // Fallback to HTTP scraping if Playwright fails
            console.log('🔄 Attempting fallback HTTP scraping for LinkedIn...');
            return await this.searchJobsHTTP(location, keywords);
        }
    }

    async searchJobsHTTP(location, keywords = '') {
        try {
            // Simple HTTP fallback - limited functionality but won't crash
            const searchUrl = `${this.baseUrl}/jobs/search/?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_JT=P`;

            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                timeout: 10000
            });

            // Basic HTML parsing could be added here if needed
            // For now, return empty array since LinkedIn blocks most HTTP scraping
            console.log('LinkedIn HTTP fallback completed (limited results due to anti-bot measures)');
            return [];

        } catch (error) {
            console.error('❌ LinkedIn HTTP fallback also failed:', error.message);
            return [];
        }
    }

    async getJobDetails(jobUrl) {
        try {
            await this.page.goto(jobUrl, { waitUntil: 'networkidle' });

            const details = await this.page.evaluate(() => {
                const descriptionElement = document.querySelector('.show-more-less-html__markup');
                const applyButton = document.querySelector('.jobs-s-apply button');

                return {
                    description: descriptionElement?.textContent.trim() || '',
                    applyUrl: applyButton ? window.location.href : null
                };
            });

            return details;
        } catch (error) {
            console.error('❌ Error getting LinkedIn job details:', error.message);
            return null;
        }
    }

    async close() {
        try {
            if (this.page) {
                await this.page.close();
                this.page = null;
            }
            if (this.browser) {
                await this.browser.close();
                this.browser = null;
            }
        } catch (error) {
            console.error('❌ Error closing LinkedIn browser:', error.message);
            // Force null the references even if close failed
            this.page = null;
            this.browser = null;
        }
    }
}

module.exports = LinkedInScraper;