const axios = require('axios');
const cheerio = require('cheerio');

class IndeedScraper {
    constructor() {
        this.baseUrl = 'https://www.indeed.com';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };
    }

    async searchJobs(location, keywords = '', jobType = 'parttime') {
        try {
            const params = {
                q: keywords,
                l: location,
                jt: jobType,
                radius: process.env.SEARCH_RADIUS || 25,
                sc: '0kf:attr(DSQF7)explvl(ENTRY_LEVEL);' // Part-time filter
            };

            const searchUrl = `${this.baseUrl}/jobs?${new URLSearchParams(params)}`;
            console.log(`🔍 Searching Indeed: ${searchUrl}`);

            const response = await axios.get(searchUrl, { headers: this.headers });
            const $ = cheerio.load(response.data);

            const jobs = [];
            $('.job_seen_beacon').each((index, element) => {
                const $job = $(element);

                const title = $job.find('[data-jk] h2 a span').text().trim();
                const company = $job.find('[data-testid="company-name"]').text().trim();
                const location = $job.find('[data-testid="job-location"]').text().trim();
                const jobKey = $job.find('[data-jk]').attr('data-jk');
                const jobUrl = jobKey ? `${this.baseUrl}/jobs?jk=${jobKey}` : '';
                const salary = $job.find('.salary-snippet').text().trim();
                const summary = $job.find('.summary').text().trim();

                if (title && company) {
                    jobs.push({
                        title,
                        company,
                        location,
                        jobUrl,
                        salary,
                        summary,
                        source: 'Indeed',
                        jobKey,
                        postedDate: this.extractPostedDate($job)
                    });
                }
            });

            console.log(`✅ Found ${jobs.length} jobs on Indeed`);
            return jobs;

        } catch (error) {
            console.error('❌ Error scraping Indeed:', error.message);
            return [];
        }
    }

    extractPostedDate($job) {
        const dateText = $job.find('.date').text().trim();
        return dateText || 'Recently posted';
    }

    async getJobDetails(jobUrl) {
        try {
            const response = await axios.get(jobUrl, { headers: this.headers });
            const $ = cheerio.load(response.data);

            return {
                description: $('.jobsearch-jobDescriptionText').text().trim(),
                requirements: this.extractRequirements($),
                benefits: this.extractBenefits($),
                applyUrl: $('.jobsearch-IndeedApplyButton-link').attr('href') || jobUrl
            };
        } catch (error) {
            console.error('❌ Error getting job details:', error.message);
            return null;
        }
    }

    extractRequirements($) {
        const requirements = [];
        $('.jobsearch-jobDescriptionText ul li').each((index, element) => {
            const text = $(element).text().trim();
            if (text.toLowerCase().includes('require') || text.toLowerCase().includes('must')) {
                requirements.push(text);
            }
        });
        return requirements;
    }

    extractBenefits($) {
        const benefits = [];
        $('.jobsearch-jobDescriptionText').find('*').each((index, element) => {
            const text = $(element).text().trim();
            if (text.toLowerCase().includes('benefit') || text.toLowerCase().includes('insurance')) {
                benefits.push(text);
            }
        });
        return benefits;
    }
}

module.exports = IndeedScraper;