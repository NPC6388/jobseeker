const OpenAI = require('openai');

class DocumentEditor {
    constructor() {
        this.hasApiKey = !!process.env.OPENAI_API_KEY;
        if (this.hasApiKey) {
            this.openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY
            });
            this.model = 'gpt-4';
        }
    }

    /**
     * Review and edit a resume for quality, accuracy, and professional presentation
     */
    async reviewAndEditResume(resumeText, jobDescription = null) {
        // Fallback mode when no API key is available
        if (!this.hasApiKey) {
            return this.fallbackResumeReview(resumeText);
        }

        try {
            const systemPrompt = `You are a professional resume editor with expertise in crafting compelling, accurate, and ATS-friendly resumes. Your role is to review and improve resumes while maintaining factual accuracy.

CRITICAL GUIDELINES:
- NEVER add fabricated information, fake companies, or false experience
- NEVER add specific metrics unless they exist in the original
- NEVER create fictional achievements or responsibilities
- DO improve grammar, formatting, and professional language
- DO enhance existing content with better word choices and structure
- DO ensure consistency in formatting and style
- DO check for typos, grammatical errors, and awkward phrasing
- DO optimize for ATS compatibility
- DO maintain the authentic voice and experience level

Your review should focus on:
1. Grammar and spelling corrections
2. Professional language enhancement
3. Formatting consistency
4. ATS optimization
5. Clarity and readability improvements
6. Removing redundant information
7. Better organization and flow`;

            const userPrompt = `Please review and edit this resume for professional quality, accuracy, and effectiveness:

${resumeText}

${jobDescription ? `\nTarget Job Description:\n${jobDescription}` : ''}

Return the edited resume with the following JSON structure:
{
    "editedResume": "the improved resume text",
    "editorNotes": "summary of changes made and reasons",
    "qualityScore": 85,
    "recommendations": ["specific suggestions for further improvement"]
}`;

            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                max_tokens: 3000
            });

            const result = JSON.parse(response.choices[0].message.content);

            return {
                success: true,
                ...result,
                originalLength: resumeText.length,
                editedLength: result.editedResume.length
            };

        } catch (error) {
            console.error('❌ Error in resume review:', error);
            return {
                success: false,
                error: error.message,
                editedResume: resumeText, // Return original if editing fails
                editorNotes: 'Editing failed - original resume returned',
                qualityScore: 0,
                recommendations: ['Manual review recommended due to editing error']
            };
        }
    }

    /**
     * Review and edit a cover letter for professionalism and effectiveness
     */
    async reviewAndEditCoverLetter(coverLetterText, jobDescription = null, companyName = null) {
        // Fallback mode when no API key is available
        if (!this.hasApiKey) {
            return this.fallbackCoverLetterReview(coverLetterText);
        }

        try {
            const systemPrompt = `You are a professional cover letter editor specializing in creating compelling, personalized cover letters that grab attention while maintaining authenticity.

CRITICAL GUIDELINES:
- NEVER fabricate specific achievements or experiences not mentioned in the original
- NEVER add false claims about the applicant's background
- DO improve professional tone and language
- DO enhance the structure and flow
- DO ensure proper business letter formatting
- DO customize language to match the company/role when job description provided
- DO check grammar, spelling, and punctuation
- DO make the letter more engaging and persuasive
- DO maintain the applicant's authentic voice and experience level

Your review should focus on:
1. Professional tone and language
2. Compelling opening and closing
3. Clear structure and flow
4. Grammar and spelling corrections
5. Customization for the target role/company
6. Persuasive but truthful content
7. Proper business letter formatting`;

            const userPrompt = `Please review and edit this cover letter for professional quality and effectiveness:

${coverLetterText}

${jobDescription ? `\nTarget Job Description:\n${jobDescription}` : ''}
${companyName ? `\nCompany Name: ${companyName}` : ''}

Return the edited cover letter with the following JSON structure:
{
    "editedCoverLetter": "the improved cover letter text",
    "editorNotes": "summary of changes made and reasons",
    "qualityScore": 85,
    "recommendations": ["specific suggestions for further improvement"]
}`;

            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                max_tokens: 2000
            });

            const result = JSON.parse(response.choices[0].message.content);

            return {
                success: true,
                ...result,
                originalLength: coverLetterText.length,
                editedLength: result.editedCoverLetter.length
            };

        } catch (error) {
            console.error('❌ Error in cover letter review:', error);
            return {
                success: false,
                error: error.message,
                editedCoverLetter: coverLetterText, // Return original if editing fails
                editorNotes: 'Editing failed - original cover letter returned',
                qualityScore: 0,
                recommendations: ['Manual review recommended due to editing error']
            };
        }
    }

    /**
     * Quick quality check for documents
     */
    async quickQualityCheck(text, documentType = 'resume') {
        try {
            const issues = [];

            // Basic checks
            if (text.length < 200) {
                issues.push('Document appears too short for professional standards');
            }

            // Check for common issues
            if (text.toLowerCase().includes('lorem ipsum')) {
                issues.push('Contains placeholder text');
            }

            if (text.toLowerCase().includes('educational institution')) {
                issues.push('Contains template placeholders');
            }

            // Check for formatting issues
            if (text.includes('  ')) {
                issues.push('Contains multiple consecutive spaces');
            }

            // Check for basic grammar issues
            const sentences = text.split('. ');
            const shortSentences = sentences.filter(s => s.length < 10).length;
            if (shortSentences > sentences.length * 0.3) {
                issues.push('Many sentences appear incomplete or too short');
            }

            return {
                qualityScore: Math.max(0, 100 - (issues.length * 15)),
                issues: issues,
                recommendReview: issues.length > 2
            };

        } catch (error) {
            console.error('❌ Error in quality check:', error);
            return {
                qualityScore: 0,
                issues: ['Quality check failed'],
                recommendReview: true
            };
        }
    }

    /**
     * Fallback resume review when no OpenAI API key is available
     */
    fallbackResumeReview(resumeText) {
        const qualityCheck = this.quickQualityCheck(resumeText, 'resume');

        // Basic text improvements without AI
        let editedText = resumeText
            .replace(/\\n/g, '\n') // Convert escaped newlines to actual newlines
            .replace(/\s{2,}/g, ' ') // Remove multiple spaces
            .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
            .replace(/white city, or/gi, 'White City, OR') // Fix location
            .replace(/([A-Z\s&]{3,})\n/g, '$1\n\n') // Add spacing after section headers
            .trim();

        return {
            success: true,
            editedResume: editedText,
            editorNotes: 'Basic formatting applied (OpenAI API key not configured for advanced editing)',
            qualityScore: qualityCheck.qualityScore,
            recommendations: [
                'Configure OpenAI API key for advanced AI-powered editing',
                'Manual review recommended for professional optimization',
                ...(Array.isArray(qualityCheck.issues) ? qualityCheck.issues : [])
            ]
        };
    }

    /**
     * Fallback cover letter review when no OpenAI API key is available
     */
    fallbackCoverLetterReview(coverLetterText) {
        const qualityCheck = this.quickQualityCheck(coverLetterText, 'cover letter');

        // Basic text improvements without AI
        let editedText = coverLetterText
            .replace(/\\n/g, '\n') // Convert escaped newlines to actual newlines
            .replace(/\s{2,}/g, ' ') // Remove multiple spaces
            .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
            .trim();

        return {
            success: true,
            editedCoverLetter: editedText,
            editorNotes: 'Basic formatting applied (OpenAI API key not configured for advanced editing)',
            qualityScore: qualityCheck.qualityScore,
            recommendations: [
                'Configure OpenAI API key for advanced AI-powered editing',
                'Manual review recommended for professional optimization',
                ...(Array.isArray(qualityCheck.issues) ? qualityCheck.issues : [])
            ]
        };
    }
}

module.exports = DocumentEditor;