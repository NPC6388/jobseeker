const puppeteer = require('puppeteer');

class LinkedInScraper {
    constructor() {
        this.baseUrl = 'https://www.linkedin.com';
        this.browser = null;
        this.page = null;
    }

    async initialize() {
        this.browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();

        // Set user agent to avoid detection
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    }

    async searchJobs(location, keywords = '') {
        try {
            if (!this.page) await this.initialize();

            const searchUrl = `${this.baseUrl}/jobs/search/?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_JT=P&f_WT=1`; // P = Part-time, WT=1 = Remote/Hybrid

            console.log(`🔍 Searching LinkedIn: ${searchUrl}`);
            await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });

            // Wait for job listings to load
            await this.page.waitForSelector('.jobs-search__results-list', { timeout: 10000 });

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

            console.log(`✅ Found ${jobs.length} jobs on LinkedIn`);
            return jobs;

        } catch (error) {
            console.error('❌ Error scraping LinkedIn:', error.message);
            return [];
        }
    }

    async getJobDetails(jobUrl) {
        try {
            await this.page.goto(jobUrl, { waitUntil: 'networkidle2' });

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
        if (this.browser) {
            await this.browser.close();
        }
    }
}

module.exports = LinkedInScraper;