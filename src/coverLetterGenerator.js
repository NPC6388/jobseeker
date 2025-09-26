const fs = require('fs-extra');
const path = require('path');

class CoverLetterGenerator {
    constructor() {
        this.templates = {
            customerService: `Dear Hiring Manager,

I am excited to apply for the {jobTitle} position at {company}. With my strong communication skills and passion for helping customers, I believe I would be an excellent addition to your team.

In my experience, I have developed skills in problem-solving, active listening, and maintaining a positive attitude even in challenging situations. I understand the importance of creating positive customer experiences and representing your company professionally.

I am particularly interested in this {jobTitle} role because it offers the opportunity to work with people and make a meaningful impact on their experience with {company}. My availability for day shifts makes me well-suited for this position.

Thank you for considering my application. I look forward to the opportunity to discuss how I can contribute to your customer service team.

Sincerely,

{applicantName}`,

            retail: `Dear Hiring Manager,

I am writing to express my interest in the {jobTitle} position at {company}. I am drawn to retail work because of the dynamic environment and the opportunity to interact with customers while supporting business operations.

I have experience in maintaining organized workspaces, handling transactions accurately, and providing helpful customer service. I am comfortable working in fast-paced environments and am always willing to learn new procedures and systems.

The {jobTitle} position at {company} appeals to me because it offers the chance to be part of a team while developing valuable retail experience. I am available for day shifts and am committed to maintaining the high standards your customers expect.

I would welcome the opportunity to discuss how my enthusiasm and work ethic can benefit your team. Thank you for your consideration.

Best regards,

{applicantName}`,

            dataEntry: `Dear Hiring Manager,

I am pleased to submit my application for the {jobTitle} position at {company}. I am particularly interested in this role as it combines my attention to detail with my proficiency in computer systems and data management.

I have experience working with various software applications and databases, always ensuring accuracy and efficiency in my work. I understand the importance of maintaining data integrity and meeting deadlines in administrative roles.

The {jobTitle} position at {company} is appealing because it offers the opportunity to contribute to business operations through careful and accurate work. My preference for day-shift hours makes this an ideal fit for my schedule.

I am confident that my detail-oriented approach and reliability would make me a valuable addition to your team. Thank you for considering my application.

Sincerely,
{applicantName}`,

            general: `Dear Hiring Manager,

I am writing to express my strong interest in the {jobTitle} position at {company}. This opportunity aligns perfectly with my career goals and preference for part-time day work that allows for professional growth.

I bring a combination of reliability, adaptability, and strong work ethic to any role. I am comfortable learning new systems and procedures, work well both independently and as part of a team, and always maintain a professional attitude.

I am particularly attracted to this {jobTitle} role at {company} because it offers the chance to contribute meaningfully while maintaining the work-life balance that part-time positions provide. I am committed to delivering quality work consistently.

I would welcome the opportunity to discuss how my skills and enthusiasm can benefit your organization. Thank you for your time and consideration.

Best regards,

{applicantName}`
        };
    }

    generateCoverLetter(job, applicantName = process.env.YOUR_NAME) {
        try {
            // Determine the best template based on job title and description
            const template = this.selectTemplate(job);

            // Ensure template is valid before using replace
            if (!template || typeof template !== 'string') {
                console.warn('Template is undefined or not a string, using general template');
                return this.templates.general
                    .replace(/{jobTitle}/g, job.title || 'the position')
                    .replace(/{company}/g, job.company || 'your company')
                    .replace(/{applicantName}/g, applicantName || 'Matthew Nicholson');
            }

            // Replace placeholders with job-specific information
            let coverLetter = template
                .replace(/{jobTitle}/g, job.title || 'the position')
                .replace(/{company}/g, job.company || 'your company')
                .replace(/{applicantName}/g, applicantName || 'Matthew Nicholson');

            return coverLetter;

        } catch (error) {
            console.error('Error generating cover letter:', error.message);
            return this.templates.general
                .replace(/{jobTitle}/g, job.title || 'the position')
                .replace(/{company}/g, job.company || 'your company')
                .replace(/{applicantName}/g, applicantName || 'Matthew Nicholson');
        }
    }

    selectTemplate(job) {
        const jobText = `${job.title} ${job.summary || ''}`.toLowerCase();

        if (jobText.includes('customer service') || jobText.includes('customer support') ||
            jobText.includes('call center') || jobText.includes('help desk')) {
            return this.templates.customerService;
        }

        if (jobText.includes('retail') || jobText.includes('sales') || jobText.includes('cashier') ||
            jobText.includes('store') || jobText.includes('shop')) {
            return this.templates.retail;
        }

        if (jobText.includes('data entry') || jobText.includes('administrative') ||
            jobText.includes('clerk') || jobText.includes('office') || jobText.includes('filing')) {
            return this.templates.dataEntry;
        }

        return this.templates.general;
    }

    async saveCoverLetter(coverLetter, filename = 'generated_cover_letter.txt') {
        try {
            const dataDir = path.join(__dirname, '..', 'data');
            await fs.ensureDir(dataDir);

            const filePath = path.join(dataDir, filename);
            await fs.writeFile(filePath, coverLetter, 'utf8');

            return filePath;

        } catch (error) {
            console.error('Error saving cover letter:', error.message);
            return null;
        }
    }

    async generateAndSaveForJob(job) {
        try {
            const coverLetter = this.generateCoverLetter(job);
            const safeCompany = (job.company || 'Unknown_Company').toString();
            const safeTitle = (job.title || 'Unknown_Position').toString();
            const filename = `cover_letter_${safeCompany}_${safeTitle}`.replace(/[^a-zA-Z0-9]/g, '_') + '.txt';

            return await this.saveCoverLetter(coverLetter, filename);

        } catch (error) {
            console.error('Error generating and saving cover letter:', error.message);
            return null;
        }
    }
}

module.exports = CoverLetterGenerator;