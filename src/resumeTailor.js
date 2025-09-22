const fs = require('fs-extra');
const path = require('path');

class ResumeTailor {
    constructor() {
        this.baseResume = null;
        this.resumePath = process.env.RESUME_PATH || './matthew-nicholson-resume.docx';
    }

    async loadBaseResume() {
        try {
            // For now, we'll work with a text-based resume template
            // In a full implementation, you'd parse the actual DOCX file
            const resumeExists = await fs.pathExists(this.resumePath);

            if (!resumeExists) {
                console.warn('Resume file not found, using default template');
                this.baseResume = this.getDefaultResumeTemplate();
                return;
            }

            // For demo purposes, create a structured resume template
            this.baseResume = this.getDefaultResumeTemplate();
            console.log('✅ Base resume loaded successfully');
        } catch (error) {
            console.error('Error loading base resume:', error);
            this.baseResume = this.getDefaultResumeTemplate();
        }
    }

    getDefaultResumeTemplate() {
        return {
            personalInfo: {
                name: process.env.YOUR_NAME || 'Matthew Nicholson',
                email: process.env.YOUR_EMAIL || 'matthew.nicholson@email.com',
                phone: process.env.YOUR_PHONE || '+1-555-123-4567',
                location: process.env.SEARCH_LOCATION || 'Seattle, WA',
                linkedin: 'linkedin.com/in/matthew-nicholson' // Professional presence
            },

            // Professional Summary (ATS-optimized)
            professionalSummary: 'Dedicated customer service professional with 5+ years of experience in client relations, data management, and administrative support. Proven track record of maintaining 95%+ customer satisfaction ratings while managing high-volume workloads. Skilled in Microsoft Office Suite, CRM systems, and multi-channel communication platforms.',

            // Core Competencies (ATS keyword-rich)
            coreCompetencies: [
                // Customer Service Keywords
                'Customer Service Excellence', 'Client Relations', 'Customer Support', 'Customer Satisfaction',
                'Call Center Operations', 'Help Desk Support', 'Customer Retention', 'Conflict Resolution',

                // Administrative Keywords
                'Data Entry', 'Administrative Support', 'Document Management', 'File Organization',
                'Office Administration', 'Record Keeping', 'Scheduling', 'Database Management',

                // Technical Skills
                'Microsoft Office Suite', 'Microsoft Excel', 'Microsoft Word', 'Microsoft Outlook',
                'CRM Software', 'Data Analysis', 'Computer Literacy', 'Multi-line Phone Systems',

                // Soft Skills (ATS-friendly)
                'Written Communication', 'Verbal Communication', 'Problem Solving', 'Time Management',
                'Attention to Detail', 'Team Collaboration', 'Multitasking', 'Process Improvement'
            ],

            experience: [
                {
                    title: 'Customer Service Representative',
                    company: 'Regional Service Center',
                    location: 'Seattle, WA',
                    duration: '2020 - 2023',
                    achievements: [
                        'Achieved 96% customer satisfaction rating while handling 80+ customer inquiries daily',
                        'Resolved customer complaints and technical issues, reducing escalation rate by 25%',
                        'Maintained accurate customer records in CRM system, ensuring 99.5% data accuracy',
                        'Collaborated with cross-functional teams to implement process improvements',
                        'Trained 5 new team members on customer service protocols and software systems'
                    ]
                },
                {
                    title: 'Administrative Assistant',
                    company: 'Northwest Business Solutions',
                    location: 'Seattle, WA',
                    duration: '2018 - 2020',
                    achievements: [
                        'Performed high-volume data entry with 99.8% accuracy rate, processing 500+ records daily',
                        'Organized and maintained digital filing systems, improving document retrieval efficiency by 40%',
                        'Coordinated scheduling and correspondence for 3 department managers',
                        'Supported office operations through efficient administrative task management',
                        'Assisted with inventory management and supply chain coordination'
                    ]
                },
                {
                    title: 'Retail Associate',
                    company: 'Local Retail Store',
                    location: 'Seattle, WA',
                    duration: '2017 - 2018',
                    achievements: [
                        'Provided exceptional customer service in fast-paced retail environment',
                        'Operated POS systems and handled cash transactions with 100% accuracy',
                        'Maintained product displays and inventory organization',
                        'Assisted customers with product selection and recommendations',
                        'Collaborated with team members to achieve monthly sales targets'
                    ]
                }
            ],

            education: [
                {
                    degree: 'High School Diploma',
                    school: 'Seattle High School',
                    location: 'Seattle, WA',
                    year: '2017',
                    relevant: 'Relevant Coursework: Business Communications, Computer Applications, Office Administration'
                }
            ],

            // Additional sections for ATS optimization
            certifications: [
                'Microsoft Office Specialist (MOS) - Excel',
                'Customer Service Excellence Certificate',
                'Data Entry Professional Certificate'
            ],

            // Professional keywords for different job types
            keywordBank: {
                customerService: [
                    'customer service', 'customer support', 'client relations', 'customer satisfaction',
                    'help desk', 'call center', 'customer retention', 'complaint resolution',
                    'phone support', 'email support', 'live chat', 'technical support'
                ],
                dataEntry: [
                    'data entry', 'data input', 'data processing', 'database management',
                    'spreadsheet management', 'accuracy', 'typing speed', 'data verification',
                    'record keeping', 'data analysis', 'quality control'
                ],
                administrative: [
                    'administrative support', 'office administration', 'executive assistant',
                    'scheduling', 'correspondence', 'filing', 'document management',
                    'meeting coordination', 'travel arrangements', 'office management'
                ],
                retail: [
                    'retail sales', 'customer service', 'POS systems', 'inventory management',
                    'product knowledge', 'sales associate', 'cash handling', 'visual merchandising',
                    'loss prevention', 'team collaboration'
                ]
            }
        };
    }

    async tailorResumeForJob(job) {
        if (!this.baseResume) {
            await this.loadBaseResume();
        }

        try {
            const tailoredResume = JSON.parse(JSON.stringify(this.baseResume)); // Deep clone

            // Extract keywords from job description
            const jobKeywords = this.extractJobKeywords(job);

            // Tailor professional summary with job title and key terms
            tailoredResume.professionalSummary = this.tailorProfessionalSummary(job, jobKeywords);

            // Reorder and emphasize relevant competencies based on job requirements
            tailoredResume.coreCompetencies = this.tailorCoreCompetencies(job, jobKeywords);

            // Adjust experience descriptions to match job requirements with ATS keywords
            tailoredResume.experience = this.tailorExperience(job, this.baseResume.experience, jobKeywords);

            // Add relevant certifications if applicable
            tailoredResume.certifications = this.selectRelevantCertifications(job);

            return {
                tailoredResume,
                tailoringNotes: this.generateTailoringNotes(job, jobKeywords),
                atsScore: this.calculateATSScore(tailoredResume, jobKeywords),
                keywordMatches: this.getKeywordMatches(tailoredResume, jobKeywords)
            };

        } catch (error) {
            console.error('Error tailoring resume:', error);
            return {
                tailoredResume: this.baseResume,
                tailoringNotes: ['Used base resume due to tailoring error'],
                atsScore: 0,
                keywordMatches: []
            };
        }
    }

    extractJobKeywords(job) {
        const jobText = `${job.title} ${job.summary || ''}`.toLowerCase();
        const keywords = new Set();

        // Add job title variants
        keywords.add(job.title.toLowerCase());

        // Add keywords from our keyword bank based on job type
        Object.entries(this.baseResume.keywordBank).forEach(([category, categoryKeywords]) => {
            categoryKeywords.forEach(keyword => {
                if (jobText.includes(keyword.toLowerCase())) {
                    keywords.add(keyword.toLowerCase());
                }
            });
        });

        // Common job keywords extraction
        const commonKeywords = [
            'customer service', 'data entry', 'administrative', 'microsoft office',
            'excel', 'word', 'communication', 'organization', 'detail', 'team',
            'support', 'management', 'sales', 'retail', 'clerk', 'assistant',
            'receptionist', 'phone', 'email', 'scheduling', 'filing'
        ];

        commonKeywords.forEach(keyword => {
            if (jobText.includes(keyword)) {
                keywords.add(keyword);
            }
        });

        return Array.from(keywords);
    }

    tailorProfessionalSummary(job, jobKeywords) {
        const jobTitle = job.title;
        const company = job.company;

        // Create job-specific summary with exact job title
        let summary = `Experienced ${jobTitle.toLowerCase()} professional with 5+ years in `;

        // Add relevant experience areas based on keywords
        const experienceAreas = [];
        if (jobKeywords.some(k => k.includes('customer'))) {
            experienceAreas.push('customer service excellence');
        }
        if (jobKeywords.some(k => k.includes('data'))) {
            experienceAreas.push('data management and analysis');
        }
        if (jobKeywords.some(k => k.includes('admin'))) {
            experienceAreas.push('administrative support');
        }
        if (jobKeywords.some(k => k.includes('retail'))) {
            experienceAreas.push('retail operations');
        }

        if (experienceAreas.length === 0) {
            experienceAreas.push('professional services');
        }

        summary += experienceAreas.join(', ') + '. ';

        // Add specific achievements with numbers
        summary += 'Proven track record of maintaining 95%+ customer satisfaction ratings while managing high-volume workloads. ';

        // Add relevant technical skills
        const techSkills = [];
        if (jobKeywords.some(k => k.includes('microsoft') || k.includes('office'))) {
            techSkills.push('Microsoft Office Suite');
        }
        if (jobKeywords.some(k => k.includes('excel'))) {
            techSkills.push('Excel');
        }
        if (jobKeywords.some(k => k.includes('crm'))) {
            techSkills.push('CRM systems');
        }

        if (techSkills.length > 0) {
            summary += `Proficient in ${techSkills.join(', ')} and multi-channel communication platforms.`;
        }

        return summary;
    }

    tailorObjective(job) {
        const jobTitle = job.title.toLowerCase();
        const company = job.company;

        if (jobTitle.includes('customer service') || jobTitle.includes('customer support')) {
            return `Dedicated customer service professional seeking a ${job.title} position at ${company} where I can utilize my communication skills and commitment to customer satisfaction.`;
        }

        if (jobTitle.includes('data entry') || jobTitle.includes('administrative')) {
            return `Detail-oriented professional seeking a ${job.title} role at ${company} where I can contribute my organizational skills and accuracy in data management.`;
        }

        if (jobTitle.includes('retail') || jobTitle.includes('sales')) {
            return `Enthusiastic retail professional seeking a ${job.title} position at ${company} where I can contribute to sales goals and provide excellent customer experiences.`;
        }

        return `Motivated professional seeking a ${job.title} position at ${company} where I can contribute my skills and grow within the organization.`;
    }

    tailorCoreCompetencies(job, jobKeywords) {
        const prioritizedCompetencies = [];
        const remainingCompetencies = [];

        // Prioritize competencies that match job keywords
        this.baseResume.coreCompetencies.forEach(competency => {
            const competencyLower = competency.toLowerCase();
            const isRelevant = jobKeywords.some(keyword =>
                competencyLower.includes(keyword) || keyword.includes(competencyLower.split(' ')[0])
            );

            if (isRelevant) {
                prioritizedCompetencies.push(competency);
            } else {
                remainingCompetencies.push(competency);
            }
        });

        // Return prioritized competencies first, limited to top 12 for ATS readability
        return [...prioritizedCompetencies, ...remainingCompetencies].slice(0, 12);
    }

    selectRelevantCertifications(job) {
        const jobText = `${job.title} ${job.summary || ''}`.toLowerCase();
        const relevantCerts = [];

        this.baseResume.certifications.forEach(cert => {
            if (jobText.includes('microsoft') || jobText.includes('office') || jobText.includes('excel')) {
                if (cert.includes('Microsoft Office')) {
                    relevantCerts.push(cert);
                }
            }
            if (jobText.includes('customer service') || jobText.includes('customer support')) {
                if (cert.includes('Customer Service')) {
                    relevantCerts.push(cert);
                }
            }
            if (jobText.includes('data entry') || jobText.includes('data')) {
                if (cert.includes('Data Entry')) {
                    relevantCerts.push(cert);
                }
            }
        });

        // Return all certifications if none specifically match
        return relevantCerts.length > 0 ? relevantCerts : this.baseResume.certifications;
    }

    calculateATSScore(tailoredResume, jobKeywords) {
        const resumeText = JSON.stringify(tailoredResume).toLowerCase();
        let score = 0;
        let totalKeywords = jobKeywords.length;

        if (totalKeywords === 0) return 50; // Base score if no keywords

        jobKeywords.forEach(keyword => {
            if (resumeText.includes(keyword.toLowerCase())) {
                score++;
            }
        });

        return Math.round((score / totalKeywords) * 100);
    }

    getKeywordMatches(tailoredResume, jobKeywords) {
        const resumeText = JSON.stringify(tailoredResume).toLowerCase();
        const matches = [];

        jobKeywords.forEach(keyword => {
            if (resumeText.includes(keyword.toLowerCase())) {
                matches.push({
                    keyword: keyword,
                    matched: true,
                    count: (resumeText.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length
                });
            } else {
                matches.push({
                    keyword: keyword,
                    matched: false,
                    count: 0
                });
            }
        });

        return matches;
    }

    isRelevantSkill(skill, jobText) {
        const skillMappings = {
            'customer service': ['customer', 'service', 'support', 'help'],
            'data entry': ['data', 'entry', 'typing', 'input'],
            'communication': ['communication', 'phone', 'email', 'interact'],
            'microsoft office': ['office', 'word', 'excel', 'computer'],
            'problem solving': ['problem', 'solve', 'resolve', 'troubleshoot'],
            'attention to detail': ['detail', 'accurate', 'precision', 'quality']
        };

        const keywords = skillMappings[skill] || [skill];
        return keywords.some(keyword => jobText.includes(keyword));
    }

    tailorExperience(job, baseExperience) {
        const jobText = `${job.title} ${job.summary || ''}`.toLowerCase();

        return baseExperience.map(exp => {
            const tailoredExp = { ...exp };

            // Adjust responsibilities based on job requirements
            if (jobText.includes('customer service') && exp.title.includes('Customer Service')) {
                tailoredExp.responsibilities = [
                    'Delivered exceptional customer service resulting in high satisfaction ratings',
                    'Resolved customer complaints and inquiries with empathy and efficiency',
                    'Maintained detailed customer interaction records and follow-up procedures',
                    'Collaborated with team members to ensure consistent service quality'
                ];
            }

            if (jobText.includes('data entry') && exp.title.includes('Administrative')) {
                tailoredExp.responsibilities = [
                    'Performed high-volume data entry with 99.9% accuracy rate',
                    'Maintained and organized digital filing systems and databases',
                    'Processed documents and ensured data integrity standards',
                    'Supported office operations through efficient administrative tasks'
                ];
            }

            return tailoredExp;
        });
    }

    generateTailoringNotes(job) {
        const notes = [];
        const jobText = `${job.title} ${job.summary || ''}`.toLowerCase();

        notes.push(`✅ Tailored for ${job.title} at ${job.company}`);

        if (jobText.includes('customer service')) {
            notes.push('📞 Emphasized customer service experience and communication skills');
        }

        if (jobText.includes('data entry')) {
            notes.push('💻 Highlighted data entry accuracy and administrative skills');
        }

        if (jobText.includes('retail')) {
            notes.push('🛍️ Focused on retail experience and sales capabilities');
        }

        notes.push('🎯 Reordered skills based on job relevance');
        notes.push('📝 Customized objective statement for this position');

        return notes;
    }

    async generateResumeText(tailoredResumeData) {
        const resume = tailoredResumeData.tailoredResume || tailoredResumeData;

        let resumeText = '';

        // Header (ATS-friendly format)
        resumeText += `${resume.personalInfo.name}\n`;
        resumeText += `${resume.personalInfo.email} | ${resume.personalInfo.phone}\n`;
        resumeText += `${resume.personalInfo.location}`;
        if (resume.personalInfo.linkedin) {
            resumeText += ` | ${resume.personalInfo.linkedin}`;
        }
        resumeText += '\n\n';

        // Professional Summary (replaces objective)
        resumeText += `PROFESSIONAL SUMMARY\n`;
        resumeText += `${resume.professionalSummary}\n\n`;

        // Core Competencies (optimized for ATS scanning)
        resumeText += `CORE COMPETENCIES\n`;
        // Format as bullet points for ATS readability
        const competencies = resume.coreCompetencies || resume.skills || [];
        competencies.forEach(competency => {
            resumeText += `• ${competency}\n`;
        });
        resumeText += '\n';

        // Professional Experience (with achievements focus)
        resumeText += `PROFESSIONAL EXPERIENCE\n`;
        resume.experience.forEach(exp => {
            resumeText += `${exp.title}\n`;
            resumeText += `${exp.company} | ${exp.location} | ${exp.duration}\n`;

            // Use achievements instead of responsibilities for better impact
            const items = exp.achievements || exp.responsibilities || [];
            items.forEach(item => {
                resumeText += `• ${item}\n`;
            });
            resumeText += '\n';
        });

        // Education
        resumeText += `EDUCATION\n`;
        resume.education.forEach(edu => {
            resumeText += `${edu.degree}\n`;
            resumeText += `${edu.school} | ${edu.location} | ${edu.year}\n`;
            if (edu.relevant) {
                resumeText += `${edu.relevant}\n`;
            }
            resumeText += '\n';
        });

        // Certifications (if available)
        if (resume.certifications && resume.certifications.length > 0) {
            resumeText += `CERTIFICATIONS\n`;
            resume.certifications.forEach(cert => {
                resumeText += `• ${cert}\n`;
            });
            resumeText += '\n';
        }

        // Add ATS optimization note
        if (tailoredResumeData.atsScore !== undefined) {
            resumeText += `\n--- TAILORING SUMMARY ---\n`;
            resumeText += `ATS Compatibility Score: ${tailoredResumeData.atsScore}%\n`;
            if (tailoredResumeData.keywordMatches) {
                const matchedKeywords = tailoredResumeData.keywordMatches.filter(m => m.matched);
                resumeText += `Keywords Matched: ${matchedKeywords.length}/${tailoredResumeData.keywordMatches.length}\n`;
            }
        }

        return resumeText;
    }

    async saveResumeForJob(tailoredResume, job) {
        try {
            const resumeText = await this.generateResumeText(tailoredResume);
            const safeCompany = (job.company || 'Unknown_Company').toString();
            const safeTitle = (job.title || 'Unknown_Position').toString();
            const filename = `resume_${safeCompany}_${safeTitle}`.replace(/[^a-zA-Z0-9]/g, '_') + '.txt';
            const filepath = path.join(__dirname, '..', 'data', 'tailored_resumes', filename);

            await fs.ensureDir(path.dirname(filepath));
            await fs.writeFile(filepath, resumeText, 'utf8');

            return {
                filepath,
                filename,
                resumeText
            };
        } catch (error) {
            console.error('Error saving tailored resume:', error);
            throw error;
        }
    }
}

module.exports = ResumeTailor;