const fs = require('fs-extra');
const path = require('path');
const mammoth = require('mammoth');
const ResumeImprover = require('./resumeImprover');

class ResumeTailor {
    constructor() {
        this.baseResume = null;
        this.resumePath = process.env.RESUME_PATH || './matthew-nicholson-resume.docx';
        this.resumeImprover = new ResumeImprover();
    }

    async loadBaseResume() {
        try {
            const resumeExists = await fs.pathExists(this.resumePath);

            if (!resumeExists) {
                console.warn('Resume file not found, using default template');
                this.baseResume = this.getDefaultResumeTemplate();
                return;
            }

            // Parse the actual DOCX file
            const resumeData = await this.parseDocxResume(this.resumePath);
            if (resumeData) {
                this.baseResume = resumeData;
            } else {
                console.warn('Could not parse DOCX, using default template');
                this.baseResume = this.getDefaultResumeTemplate();
            }
        } catch (error) {
            console.error('Error loading base resume:', error);
            this.baseResume = this.getDefaultResumeTemplate();
        }
    }

    async parseDocxResume(filePath) {
        try {

            // Extract text from DOCX
            const result = await mammoth.extractRawText({ path: filePath });
            const resumeText = result.value;

            if (!resumeText) {
                console.warn('No text extracted from DOCX file');
                return null;
            }


            // Parse the resume text to extract structured data
            const parsedData = this.parseResumeText(resumeText);

            return parsedData;
        } catch (error) {
            console.error('Error parsing DOCX resume:', error);
            return null;
        }
    }

    parseResumeText(text) {

        // Extract all sections from the resume
        const personalInfo = this.extractPersonalInfo(text);
        const experience = this.extractWorkExperience(text);
        const education = this.extractEducation(text);
        const skills = this.extractSkills(text);
        const summary = this.extractSummary(text);
        const certifications = this.extractCertifications(text);

        const defaultTemplate = this.getDefaultResumeTemplate();

        // Merge extracted info with default template
        return {
            ...defaultTemplate,
            personalInfo: {
                ...defaultTemplate.personalInfo,
                ...personalInfo
            },
            experience: experience.length > 0 ? experience : defaultTemplate.experience,
            education: education.length > 0 ? education : defaultTemplate.education,
            coreCompetencies: skills.length > 0 ? skills : defaultTemplate.coreCompetencies,
            professionalSummary: summary || defaultTemplate.professionalSummary,
            certifications: certifications.length > 0 ? certifications : defaultTemplate.certifications
        };
    }

    extractPersonalInfo(text) {
        const personalInfo = {};

        // Extract phone number (various formats)
        const phonePatterns = [
            /(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
            /(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})/g,
            /\((\d{3})\)\s?(\d{3})[-.\s]?(\d{4})/g
        ];

        for (const pattern of phonePatterns) {
            const phoneMatch = text.match(pattern);
            if (phoneMatch && phoneMatch[0]) {
                personalInfo.phone = this.formatPhoneNumber(phoneMatch[0]);
                break;
            }
        }

        // Extract email
        const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
        const emailMatch = text.match(emailPattern);
        if (emailMatch && emailMatch[0]) {
            personalInfo.email = emailMatch[0];
        }

        // Extract name (first line that looks like a name)
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        for (const line of lines) {
            // Skip if line contains email or phone
            if (line.includes('@') || /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/.test(line)) {
                continue;
            }
            // Look for name pattern (2-4 words, first letters capitalized)
            if (/^[A-Z][a-z]+\s+[A-Z][a-z]+(\s+[A-Z][a-z]+){0,2}$/.test(line)) {
                personalInfo.name = line;
                break;
            }
        }

        return personalInfo;
    }

    formatPhoneNumber(phone) {
        // Clean the phone number
        const cleaned = phone.replace(/\D/g, '');

        // Format as +1-XXX-XXX-XXXX if it's a US number
        if (cleaned.length === 10) {
            return `+1-${cleaned.slice(0,3)}-${cleaned.slice(3,6)}-${cleaned.slice(6)}`;
        } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
            return `+${cleaned.slice(0,1)}-${cleaned.slice(1,4)}-${cleaned.slice(4,7)}-${cleaned.slice(7)}`;
        }

        return phone; // Return original if we can't format it
    }

    extractWorkExperience(text) {
        const experience = [];

        // Find the Professional Experience section more precisely
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        let inExperienceSection = false;
        let i = 0;

        // Find the start of experience section
        while (i < lines.length) {
            if (lines[i].toLowerCase().includes('professional experience')) {
                inExperienceSection = true;
                i++;
                break;
            }
            i++;
        }

        if (!inExperienceSection) {
            return experience;
        }

        // Define section headers to detect
        const possibleSectionHeaders = ['education', 'skills', 'certifications', 'awards', 'achievements', 'licenses'];

        // Process each line looking for job entries
        while (i < lines.length) {
            const line = lines[i];
            const lineLower = line.toLowerCase();

            // Stop if we hit another major section (check for actual section headers)
            if (this.isActualSectionHeader(line, possibleSectionHeaders)) {
                break;
            }

            // Look for company name with dates pattern (your resume format)
            if (this.isCompanyLine(line)) {
                const job = this.parseMatthewJobEntry(lines, i);
                if (job) {
                    experience.push(job);

                    // Skip ahead past this job entry to avoid re-processing the title/description lines
                    // Find the next company line or section end
                    let skipTo = i + 1;
                    while (skipTo < lines.length) {
                        const nextLine = lines[skipTo];
                        const nextLineLower = nextLine.toLowerCase();

                        // Check if this is a real section header or another company line
                        if (this.isCompanyLine(nextLine) || this.isActualSectionHeader(nextLine, possibleSectionHeaders)) {
                            break;
                        }
                        skipTo++;
                    }
                    i = skipTo - 1; // Will be incremented at end of loop
                }
            }

            i++;
        }

        return experience;
    }

    isCompanyLine(line) {
        // Your resume format: "Company Name, Location	YYYY -- YYYY" or "Company Name	YYYY and YYYY"
        return /\t.*\d{4}/.test(line) || // Has tab followed by year
               /\d{4}\s*(--|-|and)\s*\d{4}/.test(line) || // Has year range
               /\d{4}\s*(--|-)\s*\d{4}/.test(line);
    }

    isActualSectionHeader(line, possibleSectionHeaders) {
        // Check if line is an actual section header (not just contains the keyword)
        const lineTrimmed = line.trim().toLowerCase();

        // Check for common section header patterns
        return possibleSectionHeaders.some(header => {
            // Check if line starts with the header word and looks like a section title
            if (lineTrimmed.startsWith(header.toLowerCase())) {
                // Must be either:
                // 1. Just the header word with optional colon/punctuation
                // 2. Header word followed by common section title words
                const sectionPattern = new RegExp(`^${header}\\s*(:.*|\\s+(and|&|/|-).*|\\s*$)`, 'i');
                return sectionPattern.test(lineTrimmed);
            }
            return false;
        });
    }

    parseMatthewJobEntry(lines, startIndex) {
        const companyLine = lines[startIndex];

        // Parse company name and dates from the first line
        let company = '';
        let duration = '';
        let title = '';

        // Split by tab to separate company from dates
        if (companyLine.includes('\t')) {
            const parts = companyLine.split('\t');
            company = parts[0].trim();
            duration = parts[1] ? parts[1].trim() : '';
        } else {
            // Fallback: try to split by date pattern
            const dateMatch = companyLine.match(/(\d{4}.*)$/);
            if (dateMatch) {
                company = companyLine.replace(dateMatch[0], '').trim();
                duration = dateMatch[0].trim();
            } else {
                company = companyLine;
            }
        }

        // Clean up company name (remove location if present)
        company = company.replace(/,\s*[A-Z]{2,}$/, ''); // Remove ", CA" etc.
        company = company.replace(/,\s*PNW$/, ''); // Remove ", PNW" specific case


        // Look ahead for job title (next non-empty line that's not a bullet point)
        let titleIndex = startIndex + 1;
        while (titleIndex < lines.length) {
            const nextLine = lines[titleIndex].trim();

            // Stop if we hit another company line
            if (this.isCompanyLine(nextLine)) {
                break;
            }

            // Stop if we hit major section headers
            if (nextLine.toLowerCase().includes('education') ||
                nextLine.toLowerCase().includes('skills') ||
                nextLine.toLowerCase().includes('certifications')) {
                break;
            }

            // Skip empty lines
            if (nextLine.length === 0) {
                titleIndex++;
                continue;
            }

            // Skip lines that start with bullet points or are clearly descriptions
            if (nextLine.startsWith('•') || nextLine.startsWith('-') || nextLine.startsWith('*')) {
                titleIndex++;
                continue;
            }

            // Skip very long lines that are clearly descriptions
            if (nextLine.length > 80) {
                titleIndex++;
                continue;
            }

            // This should be the job title
            title = nextLine;
            break;
        }

        // Collect achievements/responsibilities
        const achievements = [];
        let achievementIndex = title ? titleIndex + 1 : startIndex + 1;

        while (achievementIndex < lines.length) {
            const line = lines[achievementIndex].trim();

            // Stop if we hit another company or major section
            if (this.isCompanyLine(line) ||
                line.toLowerCase().includes('education') ||
                line.toLowerCase().includes('skills') ||
                line.toLowerCase().includes('certifications')) {
                break;
            }

            // Collect bullet points and substantial descriptions
            if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
                achievements.push(line.substring(1).trim());
            } else if (line.length > 30 && !line.includes('\t') && !this.isCompanyLine(line)) {
                // Long lines that are likely descriptions
                achievements.push(line);
            }

            achievementIndex++;
        }

        // Set default title if not found based on company
        if (!title) {
            if (company.toLowerCase().includes('gecko')) {
                title = 'Founder and Owner';
            } else if (company.toLowerCase().includes('dolab') || company.toLowerCase().includes('lightning')) {
                title = 'Construction Project Manager';
            } else {
                title = 'Professional';
            }
        }

        const result = {
            title: title || 'Professional',
            company: company || 'Company',
            location: '', // Location is usually part of company line
            duration: duration || 'Duration',
            achievements: achievements.length > 0 ? achievements : [`Worked as ${title} at ${company}`]
        };

        return result;
    }

    looksLikeJobTitle(line) {
        // Job titles often contain certain keywords or patterns
        const jobIndicators = [
            'specialist', 'associate', 'representative', 'coordinator', 'manager',
            'assistant', 'clerk', 'technician', 'operator', 'supervisor',
            'analyst', 'officer', 'advisor', 'consultant', 'administrator'
        ];

        const lineLower = line.toLowerCase();

        // Check for job indicators
        if (jobIndicators.some(indicator => lineLower.includes(indicator))) {
            return true;
        }

        // Check for company indicators (lines with "at", "inc", "llc", "corp", etc.)
        if (lineLower.includes(' at ') || lineLower.includes('inc') || lineLower.includes('llc') || lineLower.includes('corp')) {
            return true;
        }

        // Check for date patterns (2019-2023, 2019 - Present, etc.)
        if (/\d{4}/.test(line)) {
            return true;
        }

        return false;
    }

    parseJobEntry(lines, startIndex) {
        const job = {
            title: '',
            company: '',
            location: '',
            duration: '',
            achievements: []
        };

        // Extract job title and company from the first few lines
        for (let i = startIndex; i < Math.min(startIndex + 3, lines.length); i++) {
            const line = lines[i];

            if (line.includes(' at ')) {
                // Format: "Job Title at Company Name"
                const parts = line.split(' at ');
                job.title = parts[0].trim();
                job.company = parts[1].trim();
            } else if (line.includes('|') || line.includes('•')) {
                // Format: "Job Title | Company Name" or "Job Title • Company Name"
                const parts = line.split(/[|•]/);
                if (parts.length >= 2) {
                    job.title = parts[0].trim();
                    job.company = parts[1].trim();
                }
            } else if (/\d{4}/.test(line)) {
                // Line with dates
                job.duration = this.extractDuration(line);
            } else if (!job.title && line.length > 0) {
                // First non-empty line is likely the job title
                job.title = line;
            } else if (!job.company && line.length > 0 && !job.title.includes(line)) {
                // Second line might be company
                job.company = line;
            }
        }

        // Extract achievements/responsibilities (bullet points)
        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('•') || line.startsWith('-') || line.startsWith('*')) {
                job.achievements.push(line.substring(1).trim());
            } else if (line.length > 50 && !job.title.includes(line) && !job.company.includes(line)) {
                // Long lines that aren't title/company might be descriptions
                job.achievements.push(line);
            }
        }

        // Set defaults if not found
        job.title = job.title || 'Position';
        job.company = job.company || 'Company';
        job.location = job.location || 'Location';
        job.duration = job.duration || 'Duration';

        return job;
    }

    extractDuration(line) {
        // Extract date ranges like "2019 - 2023", "2019-Present", "Jan 2019 - Dec 2023"
        const datePatterns = [
            /(\d{4})\s*[-–]\s*(\d{4})/,  // 2019 - 2023
            /(\d{4})\s*[-–]\s*(present|current)/i,  // 2019 - Present
            /(\w+\s+\d{4})\s*[-–]\s*(\w+\s+\d{4})/,  // Jan 2019 - Dec 2023
            /(\w+\s+\d{4})\s*[-–]\s*(present|current)/i  // Jan 2019 - Present
        ];

        for (const pattern of datePatterns) {
            const match = line.match(pattern);
            if (match) {
                return match[0];
            }
        }

        // Fallback: look for any 4-digit year
        const yearMatch = line.match(/\d{4}/);
        return yearMatch ? yearMatch[0] : 'Duration';
    }

    extractEducation(text) {
        const education = [];

        const sections = text.split(/\n\s*\n/);
        let inEducationSection = false;

        for (const section of sections) {
            const sectionLower = section.toLowerCase();

            if (sectionLower.includes('education') || sectionLower.includes('academic')) {
                inEducationSection = true;
                continue;
            }

            if (inEducationSection && (sectionLower.includes('experience') || sectionLower.includes('skills'))) {
                break;
            }

            if (inEducationSection && section.trim().length > 0) {
                const lines = section.split('\n').map(line => line.trim()).filter(line => line.length > 0);

                for (const line of lines) {
                    if (this.looksLikeEducation(line)) {
                        const edu = this.parseEducationEntry(line);
                        if (edu) {
                            education.push(edu);
                        }
                    }
                }
            }
        }

        return education;
    }

    looksLikeEducation(line) {
        const educationKeywords = [
            'degree', 'bachelor', 'master', 'diploma',
            'university', 'college', 'school', 'institute', 'academy'
        ];

        const lineLower = line.toLowerCase();

        // Check if it's a professional certification (not education)
        const professionalCertificationPatterns = [
            'certified scrum master', 'csm', 'pmp', 'project management professional',
            'certified', 'certification'
        ];

        // If it looks like a professional certification, don't treat as education
        if (professionalCertificationPatterns.some(pattern => lineLower.includes(pattern))) {
            return false;
        }

        // Special case: "certificate" in education context (like "Certificate in...")
        // vs professional certification context
        if (lineLower.includes('certificate')) {
            // If it's a university/school certificate program, it's education
            if (educationKeywords.some(keyword => lineLower.includes(keyword))) {
                return true;
            }
            // Otherwise, it's likely a professional certification, not education
            return false;
        }

        return educationKeywords.some(keyword => lineLower.includes(keyword));
    }

    parseEducationEntry(line) {
        // Parse education line to extract degree, school, location, and year
        const year = this.extractYear(line);

        // Try to extract school name and location from common patterns
        let school = '';
        let location = '';
        let degree = line;

        // Pattern: "Degree, School Name, City, State"
        if (line.includes(',')) {
            const parts = line.split(',').map(part => part.trim());
            if (parts.length >= 3) {
                degree = parts[0];
                school = parts[1];
                location = parts.slice(2).join(', ');
            }
        }

        // If we can't parse properly, use the default template data
        if (!school && !location) {
            return {
                degree: 'High School Diploma',
                school: 'St. Helens High School',
                location: 'St. Helens, OR',
                year: '2010'
            };
        }

        return {
            degree: degree || line,
            school: school || 'High School',
            location: location || 'Oregon',
            year: year || '2010'
        };
    }

    extractYear(text) {
        const yearMatch = text.match(/\d{4}/);
        return yearMatch ? yearMatch[0] : null;
    }

    extractSkills(text) {
        const skills = new Set(); // Use Set to avoid duplicates

        // First try to find explicit skills section
        const sections = text.split(/\n\s*\n/);
        let foundExplicitSkills = false;

        for (const section of sections) {
            const sectionLower = section.toLowerCase();

            if (sectionLower.includes('skills') || sectionLower.includes('competencies') || sectionLower.includes('abilities')) {
                foundExplicitSkills = true;

                // Extract skills from this section
                const lines = section.split('\n').map(line => line.trim()).filter(line => line.length > 0);

                for (const line of lines) {
                    if (!line.toLowerCase().includes('skills') && !line.toLowerCase().includes('competencies')) {
                        // Split by common delimiters
                        const lineSkills = line.split(/[,•\-\|]/).map(skill => skill.trim()).filter(skill => skill.length > 2);
                        lineSkills.forEach(skill => skills.add(skill));
                    }
                }
                break;
            }
        }

        // If no explicit skills section found, extract from summary and job descriptions
        if (!foundExplicitSkills) {

            // Extract skills from your professional summary and job descriptions
            const skillKeywords = [
                'sales', 'project management', 'business development', 'real estate',
                'construction', 'marketing', 'production', 'communication',
                'customer service', 'leadership', 'team management', 'problem solving',
                'relationship building', 'negotiation', 'planning', 'organization',
                'deadline management', 'quality control', 'vendor management',
                'budget management', 'staff supervision', 'training', 'compliance',
                'microsoft office', 'excel', 'word', 'powerpoint', 'email',
                'phone communication', 'data entry', 'filing', 'scheduling',
                'multitasking', 'attention to detail', 'time management'
            ];

            const textLower = text.toLowerCase();

            skillKeywords.forEach(skill => {
                if (textLower.includes(skill.toLowerCase())) {
                    // Capitalize first letter of each word for display
                    const formattedSkill = skill.split(' ')
                        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                        .join(' ');
                    skills.add(formattedSkill);
                }
            });

            // Add specific skills based on your background
            if (textLower.includes('film production')) skills.add('Film Production');
            if (textLower.includes('self-defense')) skills.add('Self-Defense Training');
            if (textLower.includes('carpentry')) skills.add('Carpentry');
            if (textLower.includes('remodeling')) skills.add('Home Remodeling');
            if (textLower.includes('financing')) skills.add('Financing');
            if (textLower.includes('festival')) skills.add('Event Management');
            if (textLower.includes('contractor')) skills.add('Contract Management');
        }

        const skillsArray = Array.from(skills);
        return skillsArray.slice(0, 25); // Return up to 25 skills
    }

    extractSummary(text) {

        const sections = text.split(/\n\s*\n/);

        for (const section of sections) {
            const sectionLower = section.toLowerCase();

            if (sectionLower.includes('summary') || sectionLower.includes('profile') || sectionLower.includes('objective')) {
                const lines = section.split('\n').map(line => line.trim()).filter(line => line.length > 0);

                // Find the actual summary text (skip headers)
                for (const line of lines) {
                    if (!line.toLowerCase().includes('summary') && !line.toLowerCase().includes('profile') && line.length > 50) {
                        return line;
                    }
                }
            }
        }

        // Look for the first substantial paragraph after contact info
        for (let i = 1; i < sections.length; i++) {
            const section = sections[i];
            if (section.length > 100 && !section.toLowerCase().includes('experience') && !section.toLowerCase().includes('education')) {
                return section.replace(/\n/g, ' ').trim();
            }
        }

        return null;
    }

    extractCertifications(text) {

        const certifications = [];
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        // Look for certification section
        let inCertificationSection = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineLower = line.toLowerCase();

            // Check if we've entered a certification section
            if (lineLower.includes('certification') || lineLower.includes('credentials') || lineLower.includes('licenses')) {
                // Skip lines that are actually section headers about other things
                if (lineLower.includes('education') || lineLower.includes('experience') || lineLower.includes('professional')) {
                    continue;
                }
                inCertificationSection = true;
                continue;
            }

            // If we're in a certification section, extract certifications
            if (inCertificationSection) {
                // Stop if we hit another major section
                if (this.isActualSectionHeader(line, ['education', 'skills', 'experience', 'achievements', 'awards'])) {
                    break;
                }

                // Extract actual certifications (skip PMI memberships and fake certs)
                if (line.length > 3 && !line.startsWith('•') && !line.startsWith('-')) {
                    // Skip professional organization memberships and union memberships (they're not certifications)
                    if ((lineLower.includes('pmi') && (lineLower.includes('member') || lineLower.includes('membership'))) ||
                        (lineLower.includes('iatse')) ||
                        (lineLower.includes('union') && lineLower.includes('member'))) {
                        continue;
                    }

                    // Skip educational credentials (they belong in education, not certifications)
                    if (lineLower.includes('high school diploma') ||
                        lineLower.includes('diploma') ||
                        lineLower.includes('degree')) {
                        continue;
                    }

                    // Skip known fake certifications
                    const fakeCertifications = [
                        'Microsoft Office Specialist (MOS) - Excel',
                        'Customer Service Excellence Certificate',
                        'Data Entry Professional Certificate'
                    ];

                    if (fakeCertifications.some(fake => line.includes(fake))) {
                        continue;
                    }

                    // Add legitimate certifications
                    certifications.push(line);
                }
            }
        }

        return certifications;
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
            professionalSummary: 'Dedicated professional with experience in client relations, data management, and administrative support. Strong background in project management, team coordination, and process improvement. Skilled in Microsoft Office Suite, database systems, and multi-channel communication platforms.',

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
                    school: 'St. Helens High School',
                    location: 'St. Helens, OR',
                    year: '2010'
                }
            ],

            // Additional sections for ATS optimization
            certifications: [],

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

            // Generate resume text for comprehensive analysis
            const resumeText = this.generateResumeText(tailoredResume, job);
            const jobDescription = `${job.title} ${job.company} ${job.description} ${job.requirements || ''}`.trim();

            // Perform comprehensive best practices analysis
            const comprehensiveAnalysis = await this.resumeImprover.analyzeResume(resumeText, jobDescription);

            // Apply best practices improvements to the tailored resume
            const optimizedResume = await this.applyBestPracticesImprovements(tailoredResume, comprehensiveAnalysis, job);

            // Generate final optimized resume text
            const optimizedResumeText = this.generateResumeText(optimizedResume, job);
            const finalAnalysis = await this.resumeImprover.analyzeResume(optimizedResumeText, jobDescription);

            return {
                tailoredResume: optimizedResume
            };

        } catch (error) {
            console.error('Error tailoring resume:', error);
            return {
                tailoredResume: this.baseResume
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
        let summary = `Experienced ${jobTitle.toLowerCase()} professional with background in `;

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

        // Add relevant professional strengths based on actual experience
        summary += 'Experienced in process improvement, team coordination, and achieving operational efficiency. ';

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
        // Only use actual certifications from the parsed resume, not fabricated ones
        if (!this.baseResume.certifications || !Array.isArray(this.baseResume.certifications)) {
            return [];
        }

        // Filter out any fake certifications that shouldn't be in the resume
        const fakeCertifications = [
            'Microsoft Office Specialist (MOS) - Excel',
            'Customer Service Excellence Certificate',
            'Data Entry Professional Certificate'
        ];

        const actualCertifications = this.baseResume.certifications.filter(cert =>
            !fakeCertifications.some(fake => cert.includes(fake))
        );

        // Return only the actual certifications from the user's resume
        return actualCertifications;
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

    tailorExperience(job, baseExperience, jobKeywords) {

        // Score each job based on relevance to target position
        const scoredExperience = baseExperience.map(exp => ({
            ...exp,
            relevanceScore: this.calculateJobRelevance(exp, job, jobKeywords)
        }));

        // Sort by relevance score (most relevant first)
        scoredExperience.sort((a, b) => b.relevanceScore - a.relevanceScore);

        // Take top 3-4 most relevant experiences
        const relevantExperience = scoredExperience.slice(0, 4);


        // Enhance the selected experiences with tailored descriptions
        return relevantExperience.map(exp => {
            const tailoredExp = { ...exp };

            // Use original achievements if available, otherwise generate tailored ones
            if (exp.achievements && exp.achievements.length > 0) {
                tailoredExp.achievements = this.enhanceAchievements(exp.achievements, job, jobKeywords);
            } else {
                tailoredExp.achievements = this.generateTailoredAchievements(exp, job, jobKeywords);
            }

            // Remove the relevance score from the final output
            delete tailoredExp.relevanceScore;

            return tailoredExp;
        });
    }

    calculateJobRelevance(experience, targetJob, jobKeywords) {
        let score = 0;
        const expText = `${experience.title} ${experience.company} ${experience.achievements?.join(' ') || ''}`.toLowerCase();
        const targetText = `${targetJob.title} ${targetJob.summary || ''}`.toLowerCase();


        // Determine job categories for better matching
        const targetCategory = this.categorizeJob(targetJob.title, targetJob.summary);
        const experienceCategory = this.categorizeJob(experience.title, experience.company);


        // Category matching (primary scoring factor)
        if (targetCategory === experienceCategory) {
            score += 80; // High bonus for same category
        } else if (this.areRelatedCategories(targetCategory, experienceCategory)) {
            score += 40; // Medium bonus for related categories
        } else {
            // Penalty for unrelated categories
            score -= 20;
        }

        // Direct title keyword matching (secondary factor)
        const titleMatches = this.countTitleKeywordMatches(experience.title, targetJob.title);
        score += titleMatches * 15;
        if (titleMatches > 0) {
        }

        // Transferable skills bonus (for different categories)
        if (targetCategory !== experienceCategory) {
            const transferablePoints = this.getTransferableSkillsScore(experience, targetJob);
            score += transferablePoints;
            if (transferablePoints > 0) {
            }
        }

        // Industry/company type matching
        if (this.hasSimilarIndustry(experience.company, targetJob.company)) {
            score += 20;
        }

        // Keyword matching from job description (lower weight)
        let keywordMatches = 0;
        jobKeywords.forEach(keyword => {
            if (expText.includes(keyword.toLowerCase())) {
                keywordMatches++;
                score += 5;
            }
        });
        if (keywordMatches > 0) {
        }

        // Recency bonus (but lower weight than relevance)
        if (experience.duration && experience.duration.toLowerCase().includes('present')) {
            score += 10;
        } else if (experience.duration && /202[0-9]/.test(experience.duration)) {
            score += 8;
        } else if (experience.duration && /201[5-9]/.test(experience.duration)) {
            score += 5;
        }

        // Ensure minimum score of 0
        score = Math.max(0, score);

        return score;
    }

    categorizeJob(title, description = '') {
        const text = `${title} ${description}`.toLowerCase();

        // Define job categories with comprehensive keywords
        const categories = {
            'retail': ['retail', 'cashier', 'sales associate', 'store', 'front end', 'checkout', 'customer service', 'safeway', 'grocery', 'supermarket', 'walmart', 'target'],
            'customer_service': ['customer service', 'customer support', 'call center', 'help desk', 'client relations', 'customer care', 'support specialist'],
            'administrative': ['administrative', 'admin', 'assistant', 'secretary', 'receptionist', 'office', 'clerical', 'data entry', 'clerk'],
            'construction': ['construction', 'contractor', 'builder', 'carpentry', 'project manager', 'foreman', 'building', 'renovation'],
            'management': ['manager', 'director', 'supervisor', 'lead', 'coordinator', 'team lead', 'founder', 'owner', 'ceo', 'president'],
            'real_estate': ['real estate', 'property', 'realtor', 'broker', 'investment', 'mortgage', 'leasing'],
            'food_service': ['restaurant', 'food service', 'server', 'waiter', 'bartender', 'cook', 'chef', 'food prep'],
            'healthcare': ['healthcare', 'medical', 'nurse', 'doctor', 'clinic', 'hospital', 'patient care'],
            'education': ['teacher', 'instructor', 'professor', 'tutor', 'education', 'school', 'training'],
            'finance': ['finance', 'accounting', 'bookkeeper', 'financial', 'bank', 'credit', 'loan'],
            'technology': ['software', 'developer', 'programmer', 'it', 'technical', 'computer', 'system'],
            'manufacturing': ['manufacturing', 'factory', 'production', 'assembly', 'warehouse', 'logistics'],
            'entertainment': ['festival', 'event', 'entertainment', 'music', 'production', 'media']
        };

        // Find the best matching category
        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return category;
            }
        }

        return 'general'; // Fallback category
    }

    areRelatedCategories(category1, category2) {
        // Define relationships between job categories
        const relatedGroups = [
            ['retail', 'customer_service', 'food_service'], // Customer-facing roles
            ['administrative', 'customer_service'], // Office/support roles
            ['construction', 'management'], // Project-based work
            ['real_estate', 'management'], // Business/sales roles
            ['healthcare', 'customer_service'], // People-focused roles
            ['technology', 'administrative'] // Office-based technical roles
        ];

        return relatedGroups.some(group =>
            group.includes(category1) && group.includes(category2)
        );
    }

    countTitleKeywordMatches(experienceTitle, targetTitle) {
        const expWords = experienceTitle.toLowerCase().split(/\s+/);
        const targetWords = targetTitle.toLowerCase().split(/\s+/);

        // Important job title keywords that indicate similar roles
        const importantKeywords = [
            'customer', 'service', 'assistant', 'associate', 'representative', 'specialist',
            'manager', 'coordinator', 'clerk', 'admin', 'administrative', 'data', 'entry',
            'retail', 'sales', 'cashier', 'front', 'end', 'support', 'help', 'desk'
        ];

        let matches = 0;
        for (const keyword of importantKeywords) {
            const inExp = expWords.some(word => word.includes(keyword));
            const inTarget = targetWords.some(word => word.includes(keyword));
            if (inExp && inTarget) {
                matches++;
            }
        }

        return matches;
    }

    getTransferableSkillsScore(experience, targetJob) {
        const expText = `${experience.title} ${experience.company} ${experience.achievements?.join(' ') || ''}`.toLowerCase();
        const targetText = `${targetJob.title} ${targetJob.summary || ''}`.toLowerCase();

        // Transferable skills that apply across job categories
        const transferableSkills = {
            'communication': ['communication', 'customer', 'client', 'people', 'team', 'collaboration'],
            'leadership': ['leadership', 'manager', 'supervisor', 'lead', 'train', 'mentor', 'coordinate'],
            'problem_solving': ['problem', 'solve', 'resolve', 'troubleshoot', 'analyze', 'improve'],
            'organization': ['organize', 'manage', 'coordinate', 'schedule', 'plan', 'detail', 'accurate'],
            'sales': ['sales', 'sell', 'revenue', 'target', 'goal', 'performance', 'achieve'],
            'technical': ['computer', 'software', 'system', 'technology', 'database', 'digital']
        };

        let score = 0;
        for (const [skill, keywords] of Object.entries(transferableSkills)) {
            const hasSkillInExp = keywords.some(keyword => expText.includes(keyword));
            const needsSkillInTarget = keywords.some(keyword => targetText.includes(keyword));

            if (hasSkillInExp && needsSkillInTarget) {
                score += 10; // Bonus for having transferable skills the target job needs
            }
        }

        return score;
    }

    containsSimilarTitles(expTitle, targetTitle) {
        // This method is now handled by countTitleKeywordMatches
        return this.countTitleKeywordMatches(expTitle, targetTitle) > 0;
    }

    hasSimilarIndustry(expCompany, targetCompany) {
        // Industry keywords that suggest similar work environments
        const retailKeywords = ['store', 'shop', 'retail', 'walmart', 'target', 'costco', 'safeway'];
        const serviceKeywords = ['service', 'support', 'help', 'call', 'center'];
        const officeKeywords = ['office', 'corporate', 'business', 'admin'];

        const expLower = expCompany.toLowerCase();
        const targetLower = targetCompany.toLowerCase();

        return retailKeywords.some(keyword => expLower.includes(keyword) && targetLower.includes(keyword)) ||
               serviceKeywords.some(keyword => expLower.includes(keyword) && targetLower.includes(keyword)) ||
               officeKeywords.some(keyword => expLower.includes(keyword) && targetLower.includes(keyword));
    }

    extractSkillsFromJob(job) {
        const jobText = `${job.title} ${job.summary || ''}`.toLowerCase();
        const skills = [];

        // Common job skills to look for
        const skillKeywords = [
            'customer service', 'data entry', 'microsoft office', 'excel', 'communication',
            'multitasking', 'organization', 'problem solving', 'teamwork', 'cash handling',
            'inventory', 'scheduling', 'filing', 'phone', 'email', 'computer', 'typing'
        ];

        skillKeywords.forEach(skill => {
            if (jobText.includes(skill)) {
                skills.push(skill);
            }
        });

        return skills;
    }

    extractSkillsFromExperience(experience) {
        const expText = `${experience.title} ${experience.achievements?.join(' ') || ''}`.toLowerCase();
        const skills = [];

        const skillKeywords = [
            'customer service', 'data entry', 'microsoft office', 'excel', 'communication',
            'multitasking', 'organization', 'problem solving', 'teamwork', 'cash handling',
            'inventory', 'scheduling', 'filing', 'phone', 'email', 'computer', 'typing'
        ];

        skillKeywords.forEach(skill => {
            if (expText.includes(skill)) {
                skills.push(skill);
            }
        });

        return skills;
    }

    enhanceAchievements(originalAchievements, job, jobKeywords) {
        // Enhance existing achievements by incorporating job keywords where relevant
        return originalAchievements.map(achievement => {
            let enhanced = achievement;

            // Add specific metrics or keywords that match the job
            jobKeywords.forEach(keyword => {
                if (enhanced.toLowerCase().includes(keyword.toLowerCase())) {
                    // Achievement already contains the keyword - good!
                    return;
                }

                // Try to enhance with relevant keywords
                if (keyword === 'customer service' && enhanced.toLowerCase().includes('customer')) {
                    enhanced = enhanced.replace(/customer/i, 'customer service');
                }
            });

            return enhanced;
        });
    }

    generateTailoredAchievements(experience, job, jobKeywords) {
        // Generate achievements based on the job title and target role
        const achievements = [];
        const jobType = job.title.toLowerCase();

        if (jobType.includes('customer service')) {
            achievements.push(
                `Provided excellent customer service while working as ${experience.title}`,
                `Handled customer inquiries and resolved issues efficiently`,
                `Maintained positive customer relationships and satisfaction`
            );
        } else if (jobType.includes('data entry') || jobType.includes('administrative')) {
            achievements.push(
                `Performed accurate data entry and administrative tasks as ${experience.title}`,
                `Maintained organized records and filing systems`,
                `Supported office operations and workflow efficiency`
            );
        } else if (jobType.includes('retail') || jobType.includes('sales')) {
            achievements.push(
                `Assisted customers and maintained store operations as ${experience.title}`,
                `Handled transactions and inventory management`,
                `Contributed to team goals and store performance`
            );
        } else {
            // Generic achievements based on experience
            achievements.push(
                `Successfully fulfilled responsibilities as ${experience.title}`,
                `Demonstrated reliability and strong work ethic`,
                `Collaborated effectively with team members and management`
            );
        }

        return achievements;
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

    generateResumeText(tailoredResumeData, targetJob = null) {
        const resume = tailoredResumeData.tailoredResume || tailoredResumeData;

        // Ensure resume has required fields with defaults
        if (!resume || !resume.personalInfo) {
            throw new Error('Invalid resume data: missing personal information');
        }

        let resumeText = '';

        // Header (ATS-friendly format)
        resumeText += `${resume.personalInfo.name || 'Name Not Provided'}\n`;
        resumeText += `${resume.personalInfo.email || 'Email Not Provided'} | ${resume.personalInfo.phone || 'Phone Not Provided'}\n`;
        resumeText += `${resume.personalInfo.location || 'Location Not Provided'}`;
        if (resume.personalInfo.linkedin) {
            resumeText += ` | ${resume.personalInfo.linkedin}`;
        }
        resumeText += '\n\n';

        // Professional Summary (replaces objective)
        resumeText += `PROFESSIONAL SUMMARY\n`;
        const summary = resume.professionalSummary || 'Dedicated professional seeking opportunities in customer service and administrative roles.';
        resumeText += `${summary}\n\n`;

        // Determine optimal section order based on job type
        const sectionOrder = this.determineSectionOrder(targetJob, resume);

        // Generate sections in optimal order
        sectionOrder.forEach(sectionType => {
            switch (sectionType) {
                case 'competencies':
                    resumeText += this.generateCompetenciesSection(resume, targetJob);
                    break;
                case 'experience':
                    resumeText += this.generateExperienceSection(resume, targetJob);
                    break;
                case 'education':
                    resumeText += this.generateEducationSection(resume);
                    break;
                case 'certifications':
                    resumeText += this.generateCertificationsSection(resume);
                    break;
                case 'achievements':
                    resumeText += this.generateAchievementsSection(resume);
                    break;
            }
        });

        // No AI or tailoring evidence in final resume

        return resumeText;
    }

    async saveResumeForJob(tailoredResume, job) {
        try {
            const resumeText = this.generateResumeText(tailoredResume, job);
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

    async applyBestPracticesImprovements(resume, analysis, job) {

        const improvedResume = JSON.parse(JSON.stringify(resume)); // Deep clone

        try {
            // Apply keyword optimization improvements
            if (analysis.keywordAnalysis && analysis.keywordAnalysis.missingKeywords) {
                improvedResume.professionalSummary = this.enhanceSummaryWithKeywords(
                    resume.professionalSummary,
                    analysis.keywordAnalysis.missingKeywords.slice(0, 5),
                    job
                );
            }

            // Enhance experience descriptions with action verbs and quantified achievements
            improvedResume.experience = this.enhanceExperienceWithBestPractices(
                resume.experience,
                analysis.recommendations,
                job
            );

            // Optimize core competencies based on analysis
            improvedResume.coreCompetencies = this.optimizeCoreCompetencies(
                resume.coreCompetencies,
                analysis.keywordAnalysis?.missingKeywords || [],
                job
            );

            // Ensure ATS-friendly formatting suggestions are noted
            improvedResume.atsOptimizationNotes = analysis.recommendations
                .filter(rec => rec.includes('ATS') || rec.includes('FORMAT') || rec.includes('CRITICAL'))
                .slice(0, 5);

            return improvedResume;

        } catch (error) {
            console.error('Error applying best practices improvements:', error);
            return resume; // Return original if improvement fails
        }
    }

    enhanceSummaryWithKeywords(summary, missingKeywords, job) {
        if (!summary || missingKeywords.length === 0) return summary;

        // Strategically incorporate 2-3 missing keywords into the summary
        const validProfessionalKeywords = ['customer service', 'data entry', 'administrative', 'microsoft office', 'excel', 'communication', 'organization', 'detail-oriented', 'team collaboration', 'problem solving', 'multitasking', 'time management', 'computer skills', 'database management'];

        const relevantKeywords = missingKeywords
            .filter(keyword => keyword.length > 3)
            .filter(keyword => validProfessionalKeywords.some(valid => keyword.toLowerCase().includes(valid.toLowerCase()) || valid.toLowerCase().includes(keyword.toLowerCase())))
            .slice(0, 3);

        let enhancedSummary = summary;

        // Add keywords naturally at the end only if we have valid professional keywords
        if (relevantKeywords.length > 0) {
            const keywordPhrase = `with expertise in ${relevantKeywords.join(', ')}`;
            if (!enhancedSummary.toLowerCase().includes('expertise in')) {
                enhancedSummary += ` ${keywordPhrase}`;
            }
        }

        // Ensure job title appears in summary (2025 best practice)
        if (job.title && !enhancedSummary.toLowerCase().includes(job.title.toLowerCase())) {
            enhancedSummary = `${job.title} professional ` + enhancedSummary.toLowerCase().replace(/^[a-z]/, match => match.toUpperCase());
        }

        return enhancedSummary;
    }

    enhanceExperienceWithBestPractices(experience, recommendations, job) {
        if (!experience || !Array.isArray(experience)) return experience;

        return experience.map(exp => {
            const enhancedExp = { ...exp };

            // Enhance achievements with stronger action verbs
            if (enhancedExp.achievements && Array.isArray(enhancedExp.achievements)) {
                enhancedExp.achievements = enhancedExp.achievements.map(achievement => {
                    let enhanced = achievement;

                    // Replace weak phrases with strong action verbs
                    enhanced = enhanced.replace(/^responsible for/i, 'Led');
                    enhanced = enhanced.replace(/^worked on/i, 'Developed');
                    enhanced = enhanced.replace(/^helped with/i, 'Contributed to');
                    enhanced = enhanced.replace(/^assisted/i, 'Supported');
                    enhanced = enhanced.replace(/^duties included/i, 'Achieved');

                    return enhanced;
                });
            }

            return enhancedExp;
        });
    }

    optimizeCoreCompetencies(competencies, missingKeywords, job) {
        if (!competencies || !Array.isArray(competencies)) return competencies;

        const optimizedCompetencies = [...competencies];

        // Add relevant missing keywords as competencies (max 3)
        const relevantMissingKeywords = missingKeywords
            .filter(keyword =>
                keyword.length > 3 &&
                !competencies.some(comp => comp.toLowerCase().includes(keyword.toLowerCase()))
            )
            .slice(0, 3);

        optimizedCompetencies.push(...relevantMissingKeywords);

        // Ensure job-specific skills are prioritized (move to front)
        const jobKeywords = this.extractJobKeywords(job);
        const prioritizedCompetencies = [];
        const remainingCompetencies = [...optimizedCompetencies];

        // Move matching keywords to front
        jobKeywords.forEach(keyword => {
            const matchingIndex = remainingCompetencies.findIndex(comp =>
                comp.toLowerCase().includes(keyword.toLowerCase())
            );
            if (matchingIndex >= 0) {
                prioritizedCompetencies.push(remainingCompetencies.splice(matchingIndex, 1)[0]);
            }
        });

        return [...prioritizedCompetencies, ...remainingCompetencies].slice(0, 12); // Limit to 12 total
    }

    generateEnhancedTailoringNotes(job, jobKeywords, analysis) {
        const baseNotes = this.generateTailoringNotes(job, jobKeywords);

        // Keep tailoring notes clean and natural
        const jobTitle = job.title || 'the position';
        const jobCompany = job.company || 'this company';

        const enhancedNotes = [
            `Resume tailored for ${jobTitle} position at ${jobCompany}.`,
            '',
            'Key Adjustments Made:',
            '• Emphasized relevant experience and skills',
            '• Highlighted qualifications matching job requirements',
            '• Focused on achievements most applicable to this role',
            '• Organized sections to prioritize relevant content',
            ''
        ];

        return enhancedNotes;
    }

    determineSectionOrder(targetJob, resume) {
        // Default order for most positions
        let defaultOrder = ['competencies', 'experience', 'education', 'certifications'];

        if (!targetJob) return defaultOrder;

        const jobTitle = targetJob.title?.toLowerCase() || '';
        const jobSummary = targetJob.summary?.toLowerCase() || '';
        const jobText = `${jobTitle} ${jobSummary}`;

        // For entry-level or skill-focused positions, emphasize competencies
        if (jobText.includes('entry level') || jobText.includes('no experience') ||
            jobText.includes('data entry') || jobText.includes('administrative')) {
            return ['competencies', 'education', 'experience', 'certifications'];
        }

        // For management or leadership roles, emphasize experience
        if (jobText.includes('manager') || jobText.includes('lead') ||
            jobText.includes('supervisor') || jobText.includes('director')) {
            return ['experience', 'competencies', 'certifications', 'education'];
        }

        // For technical roles with certification requirements
        if (jobText.includes('certified') || jobText.includes('license') ||
            jobText.includes('pmp') || jobText.includes('scrum')) {
            return ['competencies', 'certifications', 'experience', 'education'];
        }

        // For recent graduates or education-focused roles
        if (jobText.includes('graduate') || jobText.includes('degree required') ||
            jobText.includes('education') || jobText.includes('teaching')) {
            return ['education', 'competencies', 'experience', 'certifications'];
        }

        return defaultOrder;
    }

    generateCompetenciesSection(resume, targetJob = null) {
        let section = `CORE COMPETENCIES\n`;
        let competencies = resume.coreCompetencies || resume.skills || [];

        // If we have job context, intelligently rewrite competencies to match
        if (targetJob) {
            competencies = this.transformCompetenciesForJob(competencies, targetJob);
        }

        competencies.forEach(competency => {
            section += `• ${competency}\n`;
        });
        section += '\n';
        return section;
    }

    generateExperienceSection(resume, targetJob = null) {
        let section = `PROFESSIONAL EXPERIENCE\n`;
        let experience = resume.experience || [];

        // Transform experience descriptions for the target job
        if (targetJob) {
            experience = this.transformExperienceForJob(experience, targetJob);
        }

        experience.forEach(exp => {
            section += `${exp.title || 'Position'}\n`;
            section += `${exp.company || 'Company'} | ${exp.location || 'Location'} | ${exp.duration || 'Duration'}\n`;

            // Use achievements instead of responsibilities for better impact
            const items = exp.achievements || exp.responsibilities || [];
            items.forEach(item => {
                section += `• ${item}\n`;
            });
            section += '\n';
        });
        return section;
    }

    generateEducationSection(resume) {
        let section = `\nEDUCATION & CREDENTIALS\n`;
        section += `${'='.repeat(25)}\n`;

        // Add education
        const education = resume.education || [];
        education.forEach(edu => {
            section += `${edu.degree || 'High School Diploma'}\n`;
            section += `${edu.school || 'St. Helens High School'} | ${edu.location || 'St. Helens, OR'} | ${edu.year || '2010'}\n`;
            if (edu.relevant) {
                section += `${edu.relevant}\n`;
            }
            section += '\n';
        });

        // Add certifications to the same section
        if (resume.certifications && resume.certifications.length > 0) {
            const validCertifications = resume.certifications.filter(cert => {
                const certLower = cert.toLowerCase();
                // Filter out redundant PMI memberships since we have the full chapter names
                return !(certLower.includes('pmi-portland member') ||
                        certLower.includes('pmi-la member') ||
                        certLower.includes('iatse') && certLower.includes('member'));
            });

            validCertifications.forEach(cert => {
                section += `${cert}\n\n`;
            });
        }

        return section;
    }

    generateCertificationsSection(resume) {
        // Certifications are now included in the Education section
        return '';
    }

    generateAchievementsSection(resume) {
        // This would be for a separate achievements section if needed
        // For now, achievements are included in experience
        return '';
    }

    transformCompetenciesForJob(competencies, targetJob) {
        const jobTitle = (targetJob.title || '').toLowerCase();
        const jobDesc = (targetJob.description || '').toLowerCase();
        const jobReqs = (targetJob.requirements || '').toLowerCase();
        const fullJobText = `${jobTitle} ${jobDesc} ${jobReqs}`;

        // Define competency transformations based on job type
        const transformationMap = {
            // Customer Service roles
            'customer service': {
                'project management': 'Customer Relationship Management',
                'leadership': 'Team Leadership & Customer Advocacy',
                'problem solving': 'Customer Problem Resolution',
                'communication': 'Exceptional Customer Communication',
                'data analysis': 'Customer Data Analysis & Insights',
                'database management': 'Customer Database Management',
                'process improvement': 'Customer Experience Optimization'
            },
            // Administrative roles
            'administrative': {
                'project management': 'Office Administration & Project Coordination',
                'leadership': 'Administrative Team Leadership',
                'problem solving': 'Administrative Problem Resolution',
                'communication': 'Professional Administrative Communication',
                'data analysis': 'Administrative Data Management',
                'database management': 'Records & Database Administration',
                'process improvement': 'Administrative Process Optimization'
            },
            // Data Entry roles
            'data entry': {
                'project management': 'Data Project Management',
                'leadership': 'Data Quality Leadership',
                'problem solving': 'Data Accuracy & Quality Control',
                'communication': 'Data Documentation & Reporting',
                'data analysis': 'Data Entry & Analysis',
                'database management': 'Database Data Entry & Management',
                'process improvement': 'Data Entry Process Improvement'
            },
            // Office roles
            'office': {
                'project management': 'Office Project Coordination',
                'leadership': 'Office Team Leadership',
                'problem solving': 'Office Operations Problem Solving',
                'communication': 'Professional Office Communication',
                'data analysis': 'Office Data & Reporting',
                'database management': 'Office Database Management',
                'process improvement': 'Office Efficiency Optimization'
            },
            // Retail roles
            'retail': {
                'project management': 'Retail Operations Management',
                'leadership': 'Sales Team Leadership',
                'problem solving': 'Customer Service Problem Resolution',
                'communication': 'Customer Sales Communication',
                'data analysis': 'Sales Data Analysis',
                'database management': 'Customer Database Management',
                'process improvement': 'Sales Process Improvement'
            }
        };

        // Find the best matching job category
        let activeTransforms = {};
        for (const [jobType, transforms] of Object.entries(transformationMap)) {
            if (fullJobText.includes(jobType)) {
                activeTransforms = { ...activeTransforms, ...transforms };
            }
        }

        // Transform competencies
        return competencies.map(comp => {
            const compLower = comp.toLowerCase();

            // Check for exact matches first
            for (const [key, value] of Object.entries(activeTransforms)) {
                if (compLower.includes(key)) {
                    return value;
                }
            }

            // Add job-specific qualifiers to generic skills
            if (fullJobText.includes('customer service') || fullJobText.includes('customer')) {
                if (compLower.includes('communication')) return 'Customer Communication Excellence';
                if (compLower.includes('problem')) return 'Customer Problem Resolution';
                if (compLower.includes('attention')) return 'Customer Detail Attention';
            }

            if (fullJobText.includes('data') || fullJobText.includes('administrative')) {
                if (compLower.includes('accuracy')) return 'Data Accuracy & Quality Control';
                if (compLower.includes('organization')) return 'Administrative Organization';
                if (compLower.includes('efficiency')) return 'Administrative Efficiency';
            }

            // Return original if no transformation applies
            return comp;
        });
    }

    transformExperienceForJob(experiences, targetJob) {
        const jobTitle = (targetJob.title || '').toLowerCase();
        const jobDesc = (targetJob.description || '').toLowerCase();
        const jobReqs = (targetJob.requirements || '').toLowerCase();
        const fullJobText = `${jobTitle} ${jobDesc} ${jobReqs}`;

        return experiences.map(exp => {
            // Create a copy to avoid mutating original
            const transformedExp = JSON.parse(JSON.stringify(exp));

            // Transform responsibilities/achievements based on job requirements
            if (transformedExp.responsibilities) {
                transformedExp.responsibilities = transformedExp.responsibilities.map(resp => {
                    return this.transformResponsibilityForJob(resp, fullJobText);
                });
            }

            if (transformedExp.achievements) {
                transformedExp.achievements = transformedExp.achievements.map(achievement => {
                    return this.transformResponsibilityForJob(achievement, fullJobText);
                });
            }

            return transformedExp;
        });
    }

    transformResponsibilityForJob(responsibility, fullJobText) {
        const respLower = responsibility.toLowerCase();

        // Customer service transformations
        if (fullJobText.includes('customer service') || fullJobText.includes('customer')) {
            if (respLower.includes('managed') && respLower.includes('project')) {
                return responsibility.replace(/managed.*project/i, 'Managed customer experience improvement projects');
            }
            if (respLower.includes('led') && respLower.includes('team')) {
                return responsibility.replace(/led.*team/i, 'Led customer service team initiatives');
            }
            if (respLower.includes('database') || respLower.includes('data')) {
                return responsibility.replace(/database|data/gi, 'customer data');
            }
            if (respLower.includes('process') && respLower.includes('improve')) {
                return responsibility.replace(/process.*improve/i, 'customer service process improvements');
            }
        }

        // Administrative transformations
        if (fullJobText.includes('administrative') || fullJobText.includes('office')) {
            if (respLower.includes('managed') && respLower.includes('project')) {
                return responsibility.replace(/managed.*project/i, 'Managed administrative coordination projects');
            }
            if (respLower.includes('led') && respLower.includes('team')) {
                return responsibility.replace(/led.*team/i, 'Led administrative team operations');
            }
            if (respLower.includes('database') || respLower.includes('data')) {
                return responsibility.replace(/database|data/gi, 'administrative records and data');
            }
        }

        // Data entry transformations
        if (fullJobText.includes('data entry') || fullJobText.includes('data')) {
            if (respLower.includes('managed') && respLower.includes('database')) {
                return responsibility.replace(/managed.*database/i, 'Managed data entry database operations');
            }
            if (respLower.includes('accuracy') || respLower.includes('quality')) {
                return responsibility + ' with focus on data accuracy';
            }
        }

        // Return original if no specific transformation applies
        return responsibility;
    }
}

module.exports = ResumeTailor;