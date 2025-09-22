const axios = require('axios');
const cheerio = require('cheerio');

class ZipRecruiterScraper {
    constructor() {
        this.baseUrl = 'https://www.ziprecruiter.com';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };
    }

    async searchJobs(location, keywords = '') {
        try {
            const params = {
                search: keywords,
                location: location,
                days: 7, // Jobs posted in last 7 days
                employment_types: 'part_time'
            };

            const searchUrl = `${this.baseUrl}/jobs-search?${new URLSearchParams(params)}`;
            console.log(`🔍 Searching ZipRecruiter: ${searchUrl}`);

            const response = await axios.get(searchUrl, { headers: this.headers });
            const $ = cheerio.load(response.data);

            const jobs = [];
            $('[data-testid="job-list-item"]').each((index, element) => {
                const $job = $(element);

                const titleElement = $job.find('[data-testid="job-title-link"]');
                const title = titleElement.text().trim();
                const jobUrl = titleElement.attr('href');

                const company = $job.find('[data-testid="job-company"]').text().trim();
                const location = $job.find('[data-testid="job-location"]').text().trim();
                const salary = $job.find('[data-testid="job-salary"]').text().trim();

                // Get job description snippet
                const summary = $job.find('[data-testid="job-snippet"]').text().trim();

                if (title && company && this.isPartTimeJob(title, summary)) {
                    jobs.push({
                        title,
                        company,
                        location: location || location,
                        jobUrl: jobUrl ? (jobUrl.startsWith('http') ? jobUrl : `${this.baseUrl}${jobUrl}`) : '',
                        salary,
                        summary,
                        source: 'ZipRecruiter',
                        postedDate: 'Recently posted'
                    });
                }
            });

            console.log(`✅ Found ${jobs.length} jobs on ZipRecruiter`);
            return jobs;

        } catch (error) {
            console.error('❌ Error scraping ZipRecruiter:', error.message);
            return [];
        }
    }

    isPartTimeJob(title, summary) {
        const partTimeKeywords = [
            'part-time', 'part time', 'flexible', 'hourly',
            'evenings', 'weekends', 'seasonal', 'temporary',
            'customer service', 'retail', 'data entry'
        ];

        const excludeKeywords = [
            'full-time', 'full time', 'management', 'director',
            'manager', 'supervisor', 'lead', 'senior'
        ];

        const combined = `${title} ${summary}`.toLowerCase();

        // Exclude management positions
        if (excludeKeywords.some(keyword => combined.includes(keyword))) {
            return false;
        }

        // Include part-time jobs
        return partTimeKeywords.some(keyword => combined.includes(keyword));
    }

    async getJobDetails(jobUrl) {
        try {
            const response = await axios.get(jobUrl, { headers: this.headers });
            const $ = cheerio.load(response.data);

            return {
                description: $('[data-testid="job-description"]').text().trim(),
                requirements: this.extractRequirements($),
                benefits: this.extractBenefits($)
            };
        } catch (error) {
            console.error('❌ Error getting ZipRecruiter job details:', error.message);
            return null;
        }
    }

    extractRequirements($) {
        const requirements = [];
        $('[data-testid="job-description"] ul li').each((index, element) => {
            const text = $(element).text().trim();
            if (text.toLowerCase().includes('require') ||
                text.toLowerCase().includes('must') ||
                text.toLowerCase().includes('experience')) {
                requirements.push(text);
            }
        });
        return requirements;
    }

    extractBenefits($) {
        const benefits = [];
        $('[data-testid="job-description"]').find('*').each((index, element) => {
            const text = $(element).text().trim();
            if (text.toLowerCase().includes('benefit') ||
                text.toLowerCase().includes('insurance') ||
                text.toLowerCase().includes('pto')) {
                benefits.push(text);
            }
        });
        return benefits;
    }
}

module.exports = ZipRecruiterScraper;