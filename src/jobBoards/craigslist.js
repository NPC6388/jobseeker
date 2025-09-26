const axios = require('axios');
const cheerio = require('cheerio');

class CraigslistScraper {
    constructor() {
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        };
    }

    async searchJobs(location, keywords = '') {
        try {
            // Map common locations to Craigslist subdomains
            const craigslistUrl = this.getCraigslistUrl(location);

            const params = {
                query: keywords,
                is_parttime: 1, // Part-time filter
                employment_type: 1 // Part-time employment type
            };

            const searchUrl = `${craigslistUrl}/search/jjj?${new URLSearchParams(params)}`;

            const response = await axios.get(searchUrl, { headers: this.headers });
            const $ = cheerio.load(response.data);

            const jobs = [];
            $('.result-row').each((index, element) => {
                const $job = $(element);

                const titleElement = $job.find('.result-title');
                const title = titleElement.text().trim();
                const jobUrl = titleElement.attr('href');

                // Get location from the job listing
                const locationText = $job.find('.result-hood').text().trim().replace(/[()]/g, '');

                // Get posting date
                const dateElement = $job.find('.result-date');
                const postedDate = dateElement.attr('datetime') || dateElement.text().trim();

                // Check if it's a part-time job based on title or compensation
                const compensationText = $job.find('.result-price').text().trim();

                if (title && jobUrl && this.isPartTimeJob(title, compensationText)) {
                    jobs.push({
                        title,
                        company: 'Various', // Craigslist doesn't always show company names
                        location: locationText || location,
                        jobUrl: jobUrl.startsWith('http') ? jobUrl : `${craigslistUrl}${jobUrl}`,
                        salary: compensationText,
                        summary: '', // Will be filled when getting job details
                        source: 'Craigslist',
                        postedDate: this.formatDate(postedDate)
                    });
                }
            });

            return jobs;

        } catch (error) {
            console.error('❌ Error scraping Craigslist:', error.message);
            return [];
        }
    }

    getCraigslistUrl(location) {
        // Map locations to Craigslist subdomains
        const locationMap = {
            'seattle': 'https://seattle.craigslist.org',
            'portland': 'https://portland.craigslist.org',
            'vancouver': 'https://vancouver.craigslist.org',
            'spokane': 'https://spokane.craigslist.org',
            'bellingham': 'https://bellingham.craigslist.org',
            'tacoma': 'https://seattle.craigslist.org',
            'olympia': 'https://seattle.craigslist.org'
        };

        const normalizedLocation = location.toLowerCase().split(',')[0].trim();
        return locationMap[normalizedLocation] || 'https://seattle.craigslist.org';
    }

    isPartTimeJob(title, compensation) {
        const partTimeKeywords = [
            'part-time', 'part time', 'flexible', 'hourly',
            'evenings', 'weekends', 'seasonal', 'temporary'
        ];

        const excludeKeywords = [
            'full-time', 'full time', 'salary', 'management',
            'director', 'manager', 'supervisor', 'lead'
        ];

        const titleLower = title.toLowerCase();
        const compensationLower = compensation.toLowerCase();
        const combined = `${titleLower} ${compensationLower}`;

        // Exclude full-time or management positions
        if (excludeKeywords.some(keyword => combined.includes(keyword))) {
            return false;
        }

        // Include if contains part-time keywords or hourly pay
        return partTimeKeywords.some(keyword => combined.includes(keyword)) ||
               /\$\d+\/hr|\$\d+ per hour|\$\d+ hourly/i.test(compensation);
    }

    async getJobDetails(jobUrl) {
        try {
            const response = await axios.get(jobUrl, { headers: this.headers });
            const $ = cheerio.load(response.data);

            const description = $('#postingbody').text().trim();
            const company = $('h1.postingtitle .postingtitletext .postinginfos').text().trim() || 'Not specified';

            return {
                description,
                company,
                requirements: this.extractRequirements(description),
                benefits: this.extractBenefits(description)
            };
        } catch (error) {
            console.error('❌ Error getting Craigslist job details:', error.message);
            return null;
        }
    }

    extractRequirements(description) {
        const requirements = [];
        const lines = description.split('\n');

        for (const line of lines) {
            const lineLower = line.toLowerCase().trim();
            if (lineLower.includes('require') ||
                lineLower.includes('must have') ||
                lineLower.includes('need') ||
                lineLower.includes('experience')) {
                requirements.push(line.trim());
            }
        }

        return requirements;
    }

    extractBenefits(description) {
        const benefits = [];
        const lines = description.split('\n');

        for (const line of lines) {
            const lineLower = line.toLowerCase().trim();
            if (lineLower.includes('benefit') ||
                lineLower.includes('insurance') ||
                lineLower.includes('vacation') ||
                lineLower.includes('pto') ||
                lineLower.includes('paid time off')) {
                benefits.push(line.trim());
            }
        }

        return benefits;
    }

    formatDate(dateString) {
        try {
            if (!dateString) return 'Recently posted';

            // Handle Craigslist date formats
            if (dateString.includes('T')) {
                return new Date(dateString).toLocaleDateString();
            }

            return dateString;
        } catch (error) {
            return 'Recently posted';
        }
    }
}

module.exports = CraigslistScraper;