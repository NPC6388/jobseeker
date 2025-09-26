class MockJobsScraper {
    constructor() {
        this.jobTemplates = [
            {
                title: 'Customer Service Representative',
                company: 'Local Retail Chain',
                baseSalary: '$15-18/hour',
                summary: 'Provide excellent customer service in a fast-paced retail environment. Handle customer inquiries, process returns, and maintain product knowledge.'
            },
            {
                title: 'Data Entry Clerk',
                company: 'Regional Office Services',
                baseSalary: '$14-16/hour',
                summary: 'Accurate data entry and document processing. Maintain databases and ensure data integrity. Flexible part-time schedule available.'
            },
            {
                title: 'Administrative Assistant',
                company: 'Professional Services Group',
                baseSalary: '$16-20/hour',
                summary: 'Support office operations with filing, scheduling, and correspondence. Computer skills required. Great for organized individuals.'
            },
            {
                title: 'Retail Sales Associate',
                company: 'Department Store',
                baseSalary: '$13-15/hour',
                summary: 'Help customers find products, process transactions, and maintain store appearance. Previous retail experience preferred but not required.'
            },
            {
                title: 'Receptionist',
                company: 'Medical Office',
                baseSalary: '$15-17/hour',
                summary: 'Greet patients, answer phones, and schedule appointments. Professional demeanor and communication skills essential.'
            },
            {
                title: 'Office Clerk',
                company: 'Insurance Agency',
                baseSalary: '$14-17/hour',
                summary: 'General office duties including filing, copying, and customer service. Entry-level position with growth opportunities.'
            }
        ];
    }

    async searchJobs(location, keywords = '') {
        try {

            // Simulate search delay
            await this.delay(500 + Math.random() * 1000);

            const radius = parseInt(process.env.SEARCH_RADIUS) || 25;
            const searchKeywords = keywords.toLowerCase().split(',').map(k => k.trim());

            const jobs = [];

            this.jobTemplates.forEach((template, index) => {
                // Filter based on keywords if provided
                if (keywords && searchKeywords.length > 0) {
                    const jobText = `${template.title} ${template.summary}`.toLowerCase();
                    const hasMatchingKeyword = searchKeywords.some(keyword =>
                        jobText.includes(keyword) || keyword.includes('customer') && jobText.includes('customer')
                    );

                    if (!hasMatchingKeyword) return;
                }

                // Generate variations based on radius (more jobs for larger radius)
                const numVariations = Math.max(1, Math.floor(radius / 15));

                for (let i = 0; i < numVariations; i++) {
                    const distance = Math.floor(Math.random() * radius) + 1;
                    const locationVariant = this.generateLocationVariant(location, distance);

                    jobs.push({
                        title: template.title,
                        company: `${template.company} ${i > 0 ? `(Branch ${i + 1})` : ''}`,
                        location: locationVariant,
                        jobUrl: `https://mockjobs.example.com/job/${index}-${i}`,
                        salary: template.baseSalary,
                        summary: template.summary,
                        source: 'MockJobs',
                        postedDate: this.getRandomRecentDate(),
                        distance: `${distance} miles away`
                    });
                }
            });

            return jobs;

        } catch (error) {
            console.error('❌ Error with mock job search:', error.message);
            return [];
        }
    }

    generateLocationVariant(baseLocation, distance) {
        const [city, state] = baseLocation.split(',').map(s => s.trim());

        const nearbyAreas = [
            'Downtown', 'North', 'South', 'East', 'West', 'Central',
            'Uptown', 'Midtown', 'Suburban', 'Metro Area'
        ];

        const area = nearbyAreas[Math.floor(Math.random() * nearbyAreas.length)];
        return `${area} ${city}, ${state}`;
    }

    getRandomRecentDate() {
        const daysAgo = Math.floor(Math.random() * 7) + 1;
        const date = new Date();
        date.setDate(date.getDate() - daysAgo);

        if (daysAgo === 1) return '1 day ago';
        return `${daysAgo} days ago`;
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getJobDetails(jobUrl) {
        return {
            description: 'Detailed job description would be available here with full requirements and responsibilities.',
            requirements: ['High school diploma or equivalent', 'Strong communication skills', 'Computer literacy'],
            benefits: ['Flexible scheduling', 'Employee discount', 'Paid training']
        };
    }
}

module.exports = MockJobsScraper;