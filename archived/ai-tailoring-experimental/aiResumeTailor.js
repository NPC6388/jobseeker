const OpenAI = require('openai');

/**
 * AI-Powered Resume Tailor
 * Creates highly customized, ATS-optimized resumes for each specific job
 */
class AIResumeTailor {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    /**
     * Generate a completely tailored resume for a specific job using AI
     */
    async generateTailoredResume(baseResume, job) {
        console.log(`🤖 Using AI to tailor resume for: ${job.title} at ${job.company}`);

        try {
            const prompt = this.buildTailoringPrompt(baseResume, job);

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert resume writer and career coach specializing in ATS optimization.
Your task is to tailor resumes to match specific job descriptions while maintaining authenticity and truthfulness.
CRITICAL RULES:
1. NEVER fabricate experience, skills, or achievements not present in the original resume
2. Reframe and emphasize existing experience to align with the job requirements
3. Use keywords from the job description naturally throughout the resume
4. Optimize for ATS (Applicant Tracking Systems) by using standard formatting
5. Keep the resume concise (1-2 pages) and impactful
6. Use strong action verbs and quantify achievements when possible
7. Maintain professional tone and proper grammar`
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 2500
            });

            const tailoredResumeText = completion.choices[0].message.content;

            console.log('✅ AI-tailored resume generated successfully');

            return {
                resumeText: tailoredResumeText,
                tokensUsed: completion.usage.total_tokens,
                model: 'gpt-4o-mini'
            };

        } catch (error) {
            console.error('❌ Error generating AI-tailored resume:', error.message);
            throw error;
        }
    }

    /**
     * Build the prompt for AI resume tailoring
     */
    buildTailoringPrompt(baseResume, job) {
        const resumeText = this.formatResumeForPrompt(baseResume);
        const jobDescription = job.description || job.summary || 'No job description available';

        return `I need you to tailor this resume for a specific job application.

JOB DETAILS:
- Position: ${job.title}
- Company: ${job.company}
- Location: ${job.location}

JOB DESCRIPTION:
${jobDescription}

CURRENT RESUME:
${resumeText}

INSTRUCTIONS:
Create a tailored version of this resume that:
1. Emphasizes the most relevant experience and skills for this specific job
2. Incorporates key terms and phrases from the job description naturally
3. Reorders or rephrases bullet points to highlight job-relevant achievements
4. Adds a professional summary specifically crafted for this role
5. Maintains all factual information from the original resume (do NOT fabricate)
6. Is optimized for ATS systems
7. Uses strong action verbs and quantified achievements
8. Is formatted in a clean, professional ATS-friendly format

OUTPUT FORMAT:
Provide the complete tailored resume as plain text with clear section headers.
Use this structure:

[FULL NAME]
[Contact Information]

PROFESSIONAL SUMMARY
[2-3 lines specifically tailored to this job]

CORE COMPETENCIES
[Relevant skills with keywords from job description]

PROFESSIONAL EXPERIENCE
[Work experience with tailored bullet points emphasizing job-relevant achievements]

EDUCATION
[Education details]

CERTIFICATIONS & CREDENTIALS (if applicable)
[Relevant certifications]

Return ONLY the resume text, no additional commentary.`;
    }

    /**
     * Format the base resume for the prompt
     */
    formatResumeForPrompt(resume) {
        let formatted = '';

        // Personal Info
        if (resume.personalInfo) {
            formatted += `${resume.personalInfo.name || 'Candidate Name'}\n`;
            if (resume.personalInfo.email) formatted += `Email: ${resume.personalInfo.email}\n`;
            if (resume.personalInfo.phone) formatted += `Phone: ${resume.personalInfo.phone}\n`;
            if (resume.personalInfo.location) formatted += `Location: ${resume.personalInfo.location}\n`;
            formatted += '\n';
        }

        // Professional Summary
        if (resume.professionalSummary) {
            formatted += `SUMMARY:\n${resume.professionalSummary}\n\n`;
        }

        // Core Competencies
        if (resume.coreCompetencies && resume.coreCompetencies.length > 0) {
            formatted += `SKILLS:\n${resume.coreCompetencies.join(', ')}\n\n`;
        }

        // Experience
        if (resume.experience && resume.experience.length > 0) {
            formatted += 'EXPERIENCE:\n';
            resume.experience.forEach(exp => {
                formatted += `\n${exp.title} at ${exp.company}\n`;
                formatted += `${exp.dates}\n`;
                if (exp.location) formatted += `${exp.location}\n`;
                if (exp.achievements && exp.achievements.length > 0) {
                    exp.achievements.forEach(achievement => {
                        formatted += `• ${achievement}\n`;
                    });
                }
            });
            formatted += '\n';
        }

        // Education
        if (resume.education && resume.education.length > 0) {
            formatted += 'EDUCATION:\n';
            resume.education.forEach(edu => {
                formatted += `${edu.degree} - ${edu.institution}\n`;
                if (edu.graduationYear) formatted += `Graduated: ${edu.graduationYear}\n`;
                if (edu.gpa) formatted += `GPA: ${edu.gpa}\n`;
            });
            formatted += '\n';
        }

        // Certifications
        if (resume.certifications && resume.certifications.length > 0) {
            formatted += 'CERTIFICATIONS:\n';
            resume.certifications.forEach(cert => {
                formatted += `• ${cert}\n`;
            });
        }

        return formatted;
    }

    /**
     * Generate a tailored cover letter for a specific job
     */
    async generateCoverLetter(baseResume, job) {
        console.log(`📝 Using AI to generate cover letter for: ${job.title} at ${job.company}`);

        try {
            const prompt = `Generate a professional cover letter for this job application:

JOB DETAILS:
- Position: ${job.title}
- Company: ${job.company}
- Location: ${job.location}

JOB DESCRIPTION:
${job.description || job.summary || 'No description available'}

CANDIDATE BACKGROUND:
${this.formatResumeForPrompt(baseResume)}

INSTRUCTIONS:
Create a compelling, professional cover letter that:
1. Is 3-4 paragraphs (250-350 words)
2. Shows genuine interest in the role and company
3. Highlights 2-3 most relevant qualifications from the resume
4. Explains why the candidate is a great fit for this specific role
5. Maintains a professional yet personable tone
6. Includes a clear call to action
7. Is formatted properly with date, greeting, body, and closing

OUTPUT FORMAT:
[Date]

Hiring Manager
${job.company}

Dear Hiring Manager,

[Cover letter content]

Sincerely,
${baseResume.personalInfo?.name || 'Candidate Name'}

Return ONLY the cover letter text, no additional commentary.`;

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert career coach specializing in writing compelling cover letters that get interviews.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.8,
                max_tokens: 800
            });

            const coverLetter = completion.choices[0].message.content;

            console.log('✅ AI cover letter generated successfully');

            return {
                coverLetter: coverLetter,
                tokensUsed: completion.usage.total_tokens,
                model: 'gpt-4o-mini'
            };

        } catch (error) {
            console.error('❌ Error generating AI cover letter:', error.message);
            throw error;
        }
    }
}

module.exports = AIResumeTailor;
