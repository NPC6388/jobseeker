const mammoth = require('mammoth');
const fs = require('fs-extra');
const path = require('path');

/**
 * Honest Resume Tailor - No Fabrication, No Buzzwords
 *
 * This class tailors resumes by:
 * 1. Using ONLY real information from the base resume
 * 2. Reordering content based on relevance to the job
 * 3. Highlighting matching skills and experience
 * 4. NO fake metrics, NO fabricated achievements
 */
class HonestResumeTailor {
    constructor(resumePath = './matthew-nicholson-resume.docx') {
        this.resumePath = resumePath;
        this.baseResume = null;
    }

    async loadBaseResume() {
        try {
            const resumeExists = await fs.pathExists(this.resumePath);

            if (!resumeExists) {
                throw new Error(`Resume file not found: ${this.resumePath}`);
            }

            // Extract text from DOCX
            const result = await mammoth.extractRawText({ path: this.resumePath });
            const resumeText = result.value;

            if (!resumeText) {
                throw new Error('No text extracted from DOCX file');
            }

            // Parse the resume text to extract REAL structured data
            this.baseResume = this.parseResumeText(resumeText);

            console.log('✅ Base resume loaded successfully');
            console.log(`   - ${this.baseResume.experience.length} jobs found`);
            console.log(`   - ${this.baseResume.skills.length} skills found`);
            console.log(`   - ${this.baseResume.certifications.length} certifications found`);

        } catch (error) {
            console.error('❌ Error loading base resume:', error);
            throw error;
        }
    }

    parseResumeText(text) {
        const resume = {
            personalInfo: this.extractPersonalInfo(text),
            summary: this.extractSummary(text),
            skills: this.extractSkills(text),
            experience: this.extractWorkExperience(text),
            education: this.extractEducation(text),
            certifications: this.extractCertifications(text)
        };

        return resume;
    }

    extractPersonalInfo(text) {
        const info = {};
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);

        // Extract name (usually first line)
        for (const line of lines.slice(0, 5)) {
            if (/^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(line) && !line.includes('@')) {
                info.name = line;
                break;
            }
        }

        // Extract email
        const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) info.email = emailMatch[0];

        // Extract phone
        const phoneMatch = text.match(/(\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
        if (phoneMatch) info.phone = phoneMatch[0];

        // Extract location (look for city, state pattern)
        const locationMatch = text.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})/);
        if (locationMatch) info.location = locationMatch[0];

        // Extract LinkedIn
        const linkedinMatch = text.match(/linkedin\.com\/in\/[a-zA-Z0-9-]+/);
        if (linkedinMatch) info.linkedin = linkedinMatch[0];

        return info;
    }

    extractSummary(text) {
        const summaryMatch = text.match(/(?:PROFESSIONAL\s+SUMMARY|SUMMARY|OBJECTIVE)[:\s]+(.*?)(?=\n\n|\nPROFESSIONAL|EXPERIENCE|SKILLS|EDUCATION)/is);
        return summaryMatch ? summaryMatch[1].trim() : null;
    }

    extractSkills(text) {
        const skills = [];

        // Look for skills section with more flexible pattern
        const skillsMatch = text.match(/(?:SKILLS|COMPETENCIES|CORE COMPETENCIES)[:\s]+(.*?)(?=\n\n[A-Z][A-Z]|PROFESSIONAL\s+EXPERIENCE|EXPERIENCE|EDUCATION)/is);

        if (skillsMatch) {
            const skillsText = skillsMatch[1];
            // Extract bullets, newlines, or comma-separated skills
            const skillItems = skillsText
                .split(/[•\n,]/)
                .map(s => s.trim())
                .filter(s => s && s.length > 2 && !s.match(/^\d/)); // Filter out numbers
            skills.push(...skillItems);
        }

        // Also extract skills from experience section as fallback
        if (skills.length < 3) {
            const commonSkills = [
                'Customer Service', 'Data Entry', 'Microsoft Office', 'Excel', 'Word',
                'Communication', 'Administrative', 'CRM', 'Database', 'Management',
                'Leadership', 'Problem Solving', 'Organization', 'Attention to Detail'
            ];

            commonSkills.forEach(skill => {
                const regex = new RegExp(skill, 'i');
                if (regex.test(text) && !skills.some(s => s.toLowerCase().includes(skill.toLowerCase()))) {
                    skills.push(skill);
                }
            });
        }

        return [...new Set(skills)]; // Remove duplicates
    }

    extractWorkExperience(text) {
        const experience = [];
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);

        let inExperienceSection = false;
        let currentJob = null;
        let nextLineIsTitle = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Detect experience section start
            if (/professional\s+experience/i.test(line)) {
                inExperienceSection = true;
                continue;
            }

            // Detect section end
            if (inExperienceSection && /^(education|skills|certifications|awards|licenses|credentials)/i.test(line)) {
                if (currentJob && currentJob.achievements.length > 0) {
                    experience.push(currentJob);
                }
                break;
            }

            if (inExperienceSection) {
                // Company/location/dates line (has dates, typically formatted like "COMPANY, Location	2019 -- 2021")
                if (/\d{4}/.test(line) && (line.includes('\t') || line.includes('  ') || /[A-Z]{2,}.*\d{4}/.test(line))) {
                    // Save previous job if exists
                    if (currentJob && currentJob.achievements.length > 0) {
                        experience.push(currentJob);
                    }

                    // Parse company, location, duration
                    // Format: "COMPANY, Location	YYYY -- YYYY" or "COMPANY, Location	YYYY"
                    const dateMatch = line.match(/(\d{4}[\s\-–]+\d{4}|\d{4})/);
                    const duration = dateMatch ? dateMatch[0] : '';

                    const beforeDate = line.substring(0, line.lastIndexOf(duration)).trim();
                    const parts = beforeDate.split(',').map(p => p.trim());

                    currentJob = {
                        title: '', // Will be filled in next line
                        company: parts[0] || '',
                        location: parts[1] || '',
                        duration: duration,
                        achievements: []
                    };
                    nextLineIsTitle = true;
                }
                // Job title line (comes after company line)
                else if (nextLineIsTitle && line.length > 3 && !line.startsWith('•')) {
                    if (currentJob) {
                        currentJob.title = line;
                    }
                    nextLineIsTitle = false;
                }
                // Achievement/description lines
                else if (currentJob && line.length > 20) {
                    currentJob.achievements.push(line);
                }
            }
        }

        if (currentJob && currentJob.achievements.length > 0) {
            experience.push(currentJob);
        }

        return experience;
    }

    extractEducation(text) {
        const education = [];
        const eduMatch = text.match(/EDUCATION.*?(?=\n\n[A-Z]|$)/is);

        if (eduMatch) {
            const eduText = eduMatch[0];
            const lines = eduText.split('\n').map(l => l.trim()).filter(l => l && !/^EDUCATION/i.test(l));

            let currentEdu = null;
            for (const line of lines) {
                if (line.includes('|')) {
                    const parts = line.split('|').map(p => p.trim());
                    education.push({
                        degree: currentEdu || parts[0],
                        school: parts[0],
                        location: parts[1] || '',
                        year: parts[2] || parts[parts.length-1]
                    });
                    currentEdu = null;
                } else {
                    currentEdu = line;
                }
            }
        }

        return education;
    }

    extractCertifications(text) {
        const certifications = [];
        const certMatch = text.match(/(?:CERTIFICATIONS?|LICENSES?)[:\s]+(.*?)(?=\n\n[A-Z]|$)/is);

        if (certMatch) {
            const certText = certMatch[1];
            const certItems = certText.split(/[•\n]/).map(c => c.trim()).filter(c => c && c.length > 3);
            certifications.push(...certItems);
        }

        return certifications;
    }

    /**
     * Tailor resume for a specific job - HONEST APPROACH
     * - Uses only real information
     * - Reorders based on relevance
     * - Matches skills to job requirements
     */
    async tailorResumeForJob(job) {
        if (!this.baseResume) {
            await this.loadBaseResume();
        }

        console.log(`\n📋 Tailoring resume for: ${job.title} at ${job.company}`);

        // Extract job keywords (simple, honest approach)
        const jobKeywords = this.extractJobKeywords(job);
        console.log(`   - Found ${jobKeywords.length} relevant keywords in job posting`);

        // Match skills to job
        const matchedSkills = this.matchSkillsToJob(this.baseResume.skills, jobKeywords);
        const unmatchedSkills = this.baseResume.skills.filter(s => !matchedSkills.includes(s));

        // Reorder skills: matched first, then others
        const orderedSkills = [...matchedSkills, ...unmatchedSkills];

        // Score and reorder experience by relevance
        const scoredExperience = this.scoreExperienceRelevance(this.baseResume.experience, jobKeywords);

        // Create professional summary highlighting matching experience
        const tailoredSummary = this.createTailoredSummary(job, matchedSkills, scoredExperience);

        // Build tailored resume
        const tailoredResume = {
            personalInfo: this.baseResume.personalInfo,
            professionalSummary: tailoredSummary,
            coreCompetencies: orderedSkills.slice(0, 12), // Top 12 most relevant
            experience: scoredExperience.map(se => se.job),
            education: this.baseResume.education,
            certifications: this.baseResume.certifications
        };

        // Generate resume text
        const resumeText = this.generateResumeText(tailoredResume, job);

        console.log(`✅ Resume tailored successfully`);
        console.log(`   - ${matchedSkills.length}/${this.baseResume.skills.length} skills match job requirements`);
        console.log(`   - Most relevant experience: ${scoredExperience[0]?.job.title || 'N/A'}`);

        return {
            tailoredResume: {
                ...tailoredResume,
                resumeText
            },
            metrics: {
                matchedSkills: matchedSkills.length,
                totalSkills: this.baseResume.skills.length,
                matchPercentage: Math.round((matchedSkills.length / this.baseResume.skills.length) * 100)
            }
        };
    }

    extractJobKeywords(job) {
        const text = `${job.title} ${job.description || job.summary || ''}`.toLowerCase();
        const keywords = [];

        // Common skill patterns
        const skillPatterns = [
            /customer service/gi, /data entry/gi, /microsoft office/gi, /excel/gi,
            /administrative/gi, /communication/gi, /problem solving/gi, /team/gi,
            /crm/gi, /typing/gi, /accuracy/gi, /detail/gi, /phone/gi
        ];

        skillPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) {
                keywords.push(...matches.map(m => m.toLowerCase()));
            }
        });

        return [...new Set(keywords)]; // Remove duplicates
    }

    matchSkillsToJob(skills, jobKeywords) {
        const matched = [];

        skills.forEach(skill => {
            const skillLower = skill.toLowerCase();
            for (const keyword of jobKeywords) {
                if (skillLower.includes(keyword) || keyword.includes(skillLower)) {
                    matched.push(skill);
                    break;
                }
            }
        });

        return matched;
    }

    scoreExperienceRelevance(experience, jobKeywords) {
        return experience.map(job => {
            let score = 0;
            const jobText = `${job.title} ${job.company} ${job.achievements.join(' ')}`.toLowerCase();

            // Score based on keyword matches
            jobKeywords.forEach(keyword => {
                const matches = (jobText.match(new RegExp(keyword, 'gi')) || []).length;
                score += matches;
            });

            return { job, score };
        }).sort((a, b) => b.score - a.score); // Most relevant first
    }

    createTailoredSummary(job, matchedSkills, scoredExperience) {
        const topSkills = matchedSkills.slice(0, 3).join(', ');
        const relevantExp = scoredExperience[0]?.job;

        let summary = '';

        if (relevantExp) {
            summary = `Experienced professional with background in ${relevantExp.title.toLowerCase()}`;
        } else {
            summary = `Professional with diverse experience`;
        }

        if (matchedSkills.length > 0) {
            summary += ` and expertise in ${topSkills}`;
        }

        summary += `. Seeking to contribute skills and experience to ${job.title} role at ${job.company}.`;

        return summary;
    }

    generateResumeText(tailoredResume, job) {
        let text = '';

        // Header
        const info = tailoredResume.personalInfo;
        text += `${info.name || 'Name'}\n`;
        text += `${info.phone || 'Phone'}\n`;
        text += `${info.email || 'Email'} | ${info.location || 'Location'}`;
        if (info.linkedin) text += ` | ${info.linkedin}`;
        text += '\n\n\n';

        // Professional Summary
        text += 'PROFESSIONAL SUMMARY\n\n';
        text += tailoredResume.professionalSummary + '\n\n\n';

        // Core Competencies
        text += 'CORE COMPETENCIES\n\n';
        tailoredResume.coreCompetencies.forEach(skill => {
            text += `• ${skill}\n`;
        });
        text += '\n\n';

        // Professional Experience
        text += 'PROFESSIONAL EXPERIENCE\n\n';
        tailoredResume.experience.forEach((exp, index) => {
            text += `${exp.title}\n`;
            text += `${exp.company} | ${exp.location} | ${exp.duration}\n`;
            exp.achievements.forEach(achievement => {
                text += `• ${achievement}\n`;
            });
            if (index < tailoredResume.experience.length - 1) {
                text += '\n';
            }
        });
        text += '\n\n';

        // Education
        text += 'EDUCATION\n\n';
        tailoredResume.education.forEach(edu => {
            text += `${edu.degree}\n`;
            text += `${edu.school} | ${edu.location} | ${edu.year}\n`;
        });
        text += '\n\n';

        // Certifications
        if (tailoredResume.certifications && tailoredResume.certifications.length > 0) {
            text += 'CERTIFICATIONS\n\n';
            tailoredResume.certifications.forEach(cert => {
                text += `• ${cert}\n`;
            });
            text += '\n\n';
        }

        return text;
    }
}

module.exports = HonestResumeTailor;
