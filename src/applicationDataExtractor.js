const fs = require('fs-extra');
const path = require('path');

class ApplicationDataExtractor {
    constructor() {
        this.extractedData = null;
        this.resumePath = process.env.RESUME_PATH || './matthew-nicholson-resume.docx';
    }

    async extractComprehensiveData() {
        try {
            // Load resume data (would parse actual file in production)
            const resumeData = await this.getResumeData();

            // Extract comprehensive application data
            this.extractedData = {
                // Basic Personal Information
                personalInfo: {
                    firstName: this.extractFirstName(resumeData.personalInfo.name),
                    lastName: this.extractLastName(resumeData.personalInfo.name),
                    fullName: resumeData.personalInfo.name,
                    email: resumeData.personalInfo.email,
                    phone: resumeData.personalInfo.phone,
                    address: {
                        street: this.extractStreetAddress(resumeData.personalInfo.location),
                        city: this.extractCity(resumeData.personalInfo.location),
                        state: this.extractState(resumeData.personalInfo.location),
                        zipCode: this.extractZipCode(resumeData.personalInfo.location),
                        country: 'United States'
                    },
                    linkedin: resumeData.personalInfo.linkedin || '',
                    website: resumeData.personalInfo.website || ''
                },

                // Work Authorization & Demographics (common application fields)
                workAuthorization: {
                    authorizedToWork: true, // Default assumption
                    needSponsorship: false,
                    citizenship: 'US Citizen', // Default
                    visaStatus: 'N/A'
                },

                // Work History (detailed for applications)
                workHistory: this.extractWorkHistory(resumeData.experience),

                // Education Details
                education: this.extractEducationDetails(resumeData.education),

                // Skills & Competencies
                skills: {
                    technical: this.extractTechnicalSkills(resumeData.coreCompetencies),
                    soft: this.extractSoftSkills(resumeData.coreCompetencies),
                    all: resumeData.coreCompetencies || []
                },

                // Professional Summary
                summary: resumeData.professionalSummary,

                // Certifications & Licenses
                certifications: this.extractCertifications(resumeData.certifications),

                // Availability & Preferences
                preferences: {
                    desiredSalary: this.extractSalaryExpectation(),
                    startDate: 'Immediately',
                    workSchedule: ['Part-time', 'Day shift'],
                    willingToRelocate: false,
                    travelPercentage: '0-10%'
                },

                // References
                references: this.getDefaultReferences(),

                // Additional Information
                additionalInfo: {
                    languages: ['English (Native)'],
                    volunteerWork: [],
                    awards: [],
                    publications: []
                }
            };

            return this.extractedData;

        } catch (error) {
            console.error('❌ Error extracting application data:', error);
            return this.getDefaultApplicationData();
        }
    }

    async getResumeData() {
        // In production, this would parse the actual resume file
        // For now, return structured data from ResumeTailor
        const ResumeTailor = require('./resumeTailor');
        const tailor = new ResumeTailor();
        await tailor.loadBaseResume();
        return tailor.baseResume;
    }

    extractFirstName(fullName) {
        return fullName.split(' ')[0] || 'Matthew';
    }

    extractLastName(fullName) {
        const parts = fullName.split(' ');
        return parts[parts.length - 1] || 'Nicholson';
    }

    extractStreetAddress(location) {
        // Parse street address from location string
        // In production, would extract from structured address field
        return '123 Main Street'; // Default
    }

    extractCity(location) {
        if (location.includes(',')) {
            return location.split(',')[0].trim();
        }
        return 'White City';
    }

    extractState(location) {
        if (location.includes(',')) {
            const parts = location.split(',');
            if (parts.length > 1) {
                return parts[1].trim().toUpperCase();
            }
        }
        return 'OR';
    }

    extractZipCode(location) {
        // Extract zip code from location
        const zipMatch = location.match(/\d{5}(-\d{4})?/);
        return zipMatch ? zipMatch[0] : '97503'; // Default for White City, OR
    }

    extractWorkHistory(experience) {
        return experience.map((job, index) => ({
            id: index + 1,
            jobTitle: job.title,
            company: job.company,
            location: job.location,
            startDate: this.parseStartDate(job.duration),
            endDate: this.parseEndDate(job.duration),
            currentPosition: this.isCurrentPosition(job.duration),
            responsibilities: job.achievements,
            salary: this.estimateSalary(job.title),
            reasonForLeaving: this.getReasonForLeaving(index),
            supervisor: {
                name: 'Available upon request',
                title: 'Manager',
                phone: 'Available upon request',
                email: 'Available upon request'
            },
            mayContact: true
        }));
    }

    parseStartDate(duration) {
        const parts = duration.split(' - ');
        if (parts.length > 0) {
            const startYear = parts[0].trim();
            return `01/01/${startYear}`;
        }
        return '01/01/2020';
    }

    parseEndDate(duration) {
        const parts = duration.split(' - ');
        if (parts.length > 1 && parts[1].toLowerCase() !== 'present') {
            const endYear = parts[1].trim();
            return `12/31/${endYear}`;
        }
        return parts[1]?.toLowerCase() === 'present' ? 'Present' : '12/31/2020';
    }

    isCurrentPosition(duration) {
        return duration.toLowerCase().includes('present');
    }

    estimateSalary(title) {
        // Estimate salary ranges based on position
        const salaryRanges = {
            'customer service': '$15.00 - $18.00/hour',
            'administrative': '$16.00 - $20.00/hour',
            'data entry': '$14.00 - $16.00/hour',
            'retail': '$13.00 - $15.00/hour',
            'receptionist': '$15.00 - $17.00/hour'
        };

        const titleLower = title.toLowerCase();
        for (const [key, salary] of Object.entries(salaryRanges)) {
            if (titleLower.includes(key)) {
                return salary;
            }
        }
        return '$15.00 - $18.00/hour';
    }

    getReasonForLeaving(index) {
        const reasons = [
            'Seeking career advancement',
            'Looking for new challenges',
            'Career progression opportunity',
            'Position ended'
        ];
        return reasons[index % reasons.length];
    }

    extractEducationDetails(education) {
        return education.map((edu, index) => ({
            id: index + 1,
            level: this.categorizeEducationLevel(edu.degree),
            degree: edu.degree,
            major: this.extractMajor(edu.degree),
            school: edu.school,
            location: edu.location,
            graduationDate: edu.year,
            gpa: 'N/A',
            relevantCoursework: edu.relevant || '',
            graduated: true
        }));
    }

    categorizeEducationLevel(degree) {
        const degreeLower = degree.toLowerCase();
        if (degreeLower.includes('bachelor')) return 'Bachelor\'s Degree';
        if (degreeLower.includes('master')) return 'Master\'s Degree';
        if (degreeLower.includes('associate')) return 'Associate Degree';
        if (degreeLower.includes('high school') || degreeLower.includes('diploma')) return 'High School';
        return 'Other';
    }

    extractMajor(degree) {
        // Extract major from degree string
        if (degree.includes('in ')) {
            return degree.split('in ')[1];
        }
        return 'General Studies';
    }

    extractTechnicalSkills(competencies) {
        const technicalKeywords = [
            'microsoft office', 'excel', 'word', 'powerpoint', 'outlook',
            'crm', 'database', 'data entry', 'typing', 'computer',
            'software', 'systems', 'pos', 'helpdesk'
        ];

        return competencies.filter(skill =>
            technicalKeywords.some(keyword =>
                skill.toLowerCase().includes(keyword)
            )
        );
    }

    extractSoftSkills(competencies) {
        const softSkillKeywords = [
            'communication', 'customer service', 'teamwork', 'leadership',
            'problem solving', 'time management', 'organization', 'detail',
            'multitasking', 'interpersonal', 'professional'
        ];

        return competencies.filter(skill =>
            softSkillKeywords.some(keyword =>
                skill.toLowerCase().includes(keyword)
            )
        );
    }

    extractCertifications(certifications) {
        return certifications.map((cert, index) => ({
            id: index + 1,
            name: cert,
            issuingOrganization: this.extractIssuingOrg(cert),
            dateObtained: 'Available upon request',
            expirationDate: 'Does not expire',
            credentialId: 'Available upon request'
        }));
    }

    extractIssuingOrg(certification) {
        if (certification.includes('Microsoft')) return 'Microsoft';
        if (certification.includes('Customer Service')) return 'Customer Service Institute';
        if (certification.includes('Data Entry')) return 'Professional Development Institute';
        return 'Professional Organization';
    }

    extractSalaryExpectation() {
        // Base on location and job type
        const location = process.env.SEARCH_LOCATION || 'White City, OR';
        if (location.toLowerCase().includes('or')) {
            return '$15.00 - $20.00/hour'; // Oregon rates
        }
        return '$15.00 - $18.00/hour';
    }

    getDefaultReferences() {
        return [
            {
                name: 'Available upon request',
                title: 'Former Supervisor',
                company: 'Previous Employer',
                phone: 'Available upon request',
                email: 'Available upon request',
                relationship: 'Professional Reference'
            },
            {
                name: 'Available upon request',
                title: 'Colleague',
                company: 'Previous Employer',
                phone: 'Available upon request',
                email: 'Available upon request',
                relationship: 'Professional Reference'
            }
        ];
    }

    getDefaultApplicationData() {
        return {
            personalInfo: {
                firstName: 'Matthew',
                lastName: 'Nicholson',
                fullName: 'Matthew Nicholson',
                email: 'matthew.nicholson@email.com',
                phone: '+1-555-123-4567',
                address: {
                    street: '123 Main Street',
                    city: 'White City',
                    state: 'OR',
                    zipCode: '97503',
                    country: 'United States'
                }
            },
            workAuthorization: {
                authorizedToWork: true,
                needSponsorship: false,
                citizenship: 'US Citizen'
            },
            workHistory: [],
            education: [],
            skills: { technical: [], soft: [], all: [] },
            summary: 'Dedicated professional seeking opportunities in customer service and administrative roles.',
            preferences: {
                desiredSalary: '$15.00 - $18.00/hour',
                startDate: 'Immediately'
            }
        };
    }

    // Get application data for specific job type
    getJobSpecificData(jobTitle, jobDescription) {
        if (!this.extractedData) {
            throw new Error('Must extract data first by calling extractComprehensiveData()');
        }

        // Clone base data
        const jobSpecificData = JSON.parse(JSON.stringify(this.extractedData));

        // Customize based on job requirements
        jobSpecificData.customizations = {
            relevantExperience: this.getRelevantExperience(jobTitle),
            matchingSkills: this.getMatchingSkills(jobTitle, jobDescription),
            tailoredSummary: this.getTailoredSummary(jobTitle),
            salaryExpectation: this.getJobSpecificSalary(jobTitle)
        };

        return jobSpecificData;
    }

    getRelevantExperience(jobTitle) {
        const titleLower = jobTitle.toLowerCase();
        return this.extractedData.workHistory.filter(job => {
            const jobTitleLower = job.jobTitle.toLowerCase();
            return jobTitleLower.includes('customer') && titleLower.includes('customer') ||
                   jobTitleLower.includes('admin') && titleLower.includes('admin') ||
                   jobTitleLower.includes('data') && titleLower.includes('data') ||
                   jobTitleLower.includes('retail') && titleLower.includes('retail');
        });
    }

    getMatchingSkills(jobTitle, jobDescription) {
        const jobText = `${jobTitle} ${jobDescription}`.toLowerCase();
        return this.extractedData.skills.all.filter(skill =>
            jobText.includes(skill.toLowerCase().split(' ')[0])
        );
    }

    getTailoredSummary(jobTitle) {
        const titleLower = jobTitle.toLowerCase();
        const baseSummary = this.extractedData?.summary || 'Dedicated professional seeking opportunities in customer service and administrative roles.';

        // Ensure baseSummary is a string before calling replace
        if (typeof baseSummary !== 'string') {
            return 'Dedicated professional seeking opportunities in customer service and administrative roles.';
        }

        if (titleLower.includes('customer')) {
            return baseSummary.replace('professional', 'customer service professional');
        }
        if (titleLower.includes('admin')) {
            return baseSummary.replace('professional', 'administrative professional');
        }
        if (titleLower.includes('data')) {
            return baseSummary.replace('professional', 'data entry professional');
        }

        return baseSummary;
    }

    getJobSpecificSalary(jobTitle) {
        return this.estimateSalary(jobTitle);
    }
}

module.exports = ApplicationDataExtractor;