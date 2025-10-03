const OpenAI = require('openai');

/**
 * AI Resume Editor - Multi-pass validation and polish for perfect resumes
 * This editor ensures formatting, grammar, ATS compatibility, and professional quality
 */
class AIResumeEditor {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    /**
     * Main editing pipeline: validates, polishes, and ensures ATS compatibility
     */
    async editAndValidate(resumeText, jobContext = null) {
        console.log('🔍 Starting AI Resume Editor validation pipeline...');

        const results = {
            originalText: resumeText,
            editedText: resumeText,
            validationIssues: [],
            improvements: [],
            atsScore: 0,
            qualityScore: 0,
            passed: false
        };

        try {
            // STEP 1: Format Validation (Rule-based)
            console.log('📋 Step 1: Format validation...');
            const formatValidation = this.validateFormat(resumeText);
            results.validationIssues.push(...formatValidation.issues);

            // Auto-fix formatting issues
            let cleanedText = this.autoFixFormatting(resumeText, formatValidation);

            // STEP 2: Content Polish (AI-powered)
            console.log('✨ Step 2: AI content polish...');
            const polishedText = await this.polishContent(cleanedText, jobContext);
            results.editedText = polishedText;

            // STEP 3: ATS Compatibility Check
            console.log('🤖 Step 3: ATS compatibility check...');
            const atsCheck = this.checkATSCompatibility(polishedText);
            results.atsScore = atsCheck.score;
            results.validationIssues.push(...atsCheck.issues);

            // STEP 4: Quality Scoring
            console.log('⭐ Step 4: Quality scoring...');
            const qualityScore = this.calculateQualityScore(polishedText, jobContext);
            results.qualityScore = qualityScore.score;
            results.improvements = qualityScore.improvements;

            // STEP 5: Final Validation
            results.passed = results.atsScore >= 85 && results.qualityScore >= 80;

            console.log(`✅ Editor pipeline complete! ATS Score: ${results.atsScore}, Quality: ${results.qualityScore}`);

            return results;

        } catch (error) {
            console.error('❌ Error in AI Resume Editor:', error.message);
            // Return original text if editing fails
            results.editedText = resumeText;
            results.validationIssues.push(`Editor error: ${error.message}`);
            return results;
        }
    }

    /**
     * Rule-based format validation
     */
    validateFormat(resumeText) {
        const issues = [];
        const warnings = [];

        // Check for required sections
        const requiredSections = [
            'PROFESSIONAL SUMMARY',
            'CORE COMPETENCIES',
            'PROFESSIONAL EXPERIENCE',
            'EDUCATION'
        ];

        for (const section of requiredSections) {
            if (!resumeText.includes(section)) {
                issues.push({
                    severity: 'error',
                    message: `Missing required section: ${section}`,
                    fix: `Add ${section} section`
                });
            }
        }

        // Check for contact information
        if (!this.hasEmail(resumeText)) {
            issues.push({
                severity: 'error',
                message: 'Missing email address',
                fix: 'Add email in contact section'
            });
        }

        if (!this.hasPhone(resumeText)) {
            issues.push({
                severity: 'error',
                message: 'Missing phone number',
                fix: 'Add phone number in contact section'
            });
        }

        // Check for ATS-problematic characters
        const problematicChars = /[^\w\s\-.,():;'"!?@#$%&*+=\/\\|•\n]/g;
        const matches = resumeText.match(problematicChars);
        if (matches && matches.length > 5) {
            warnings.push({
                severity: 'warning',
                message: `Found ${matches.length} special characters that may cause ATS issues`,
                fix: 'Remove or replace special characters with standard ones'
            });
        }

        // Check line length (too long lines can break in ATS)
        const lines = resumeText.split('\n');
        const longLines = lines.filter(line => line.length > 120);
        if (longLines.length > 0) {
            warnings.push({
                severity: 'warning',
                message: `${longLines.length} lines exceed 120 characters`,
                fix: 'Break long lines into multiple shorter lines'
            });
        }

        return {
            issues: [...issues, ...warnings],
            hasErrors: issues.some(i => i.severity === 'error')
        };
    }

    /**
     * Auto-fix common formatting issues
     */
    autoFixFormatting(resumeText, validation) {
        let fixed = resumeText;

        // Fix multiple consecutive spaces
        fixed = fixed.replace(/[ \t]{2,}/g, ' ');

        // Normalize line breaks (max 2 consecutive)
        fixed = fixed.replace(/\n{4,}/g, '\n\n\n');

        // Remove trailing spaces
        fixed = fixed.replace(/[ \t]+$/gm, '');

        // Ensure section headers have proper spacing
        const sectionHeaders = [
            'PROFESSIONAL SUMMARY',
            'CORE COMPETENCIES',
            'PROFESSIONAL EXPERIENCE',
            'EDUCATION',
            'CERTIFICATIONS'
        ];

        for (const header of sectionHeaders) {
            // Ensure blank line before and after section headers
            const headerRegex = new RegExp(`([^\\n])(${header})([^\\n])`, 'g');
            fixed = fixed.replace(headerRegex, `$1\n\n${header}\n\n$3`);
        }

        // Fix bullet point formatting (ensure consistent bullets)
        fixed = fixed.replace(/^[-*]\s/gm, '• ');

        console.log('🔧 Applied formatting auto-fixes');
        return fixed;
    }

    /**
     * AI-powered content polish
     */
    async polishContent(resumeText, jobContext) {
        try {
            const systemPrompt = `You are an expert resume editor specializing in ATS optimization and professional writing.
Your job is to polish resume content while maintaining 100% factual accuracy.

CRITICAL RULES:
1. NEVER add or fabricate any information not in the original resume
2. Only improve grammar, word choice, and professional tone
3. Strengthen action verbs and eliminate passive voice
4. Ensure consistent formatting and professional language
5. Keep all numbers, dates, and facts exactly as provided
6. Maintain the EXACT same resume structure and sections
7. PRESERVE ALL LINE BREAKS AND FORMATTING - keep newlines exactly as they are
8. Do NOT merge sections or lines together

SPECIFIC TASKS:
- Fix any grammar or spelling errors
- Replace weak verbs with strong action verbs
- Ensure consistent tense (past tense for previous roles, present for current)
- Remove redundant or filler words
- Ensure professional tone throughout
- Fix capitalization and punctuation
- Ensure bullet points are parallel in structure
- KEEP all section breaks, line breaks, and spacing intact

FORMATTING REQUIREMENTS:
- Each section header (PROFESSIONAL SUMMARY, CORE COMPETENCIES, PROFESSIONAL EXPERIENCE, EDUCATION, CERTIFICATIONS) must be on its own line
- Each section header MUST have 2 blank lines before it (except the first one)
- Each bullet point must be on its own line starting with •
- Company/job info must remain properly formatted across lines
- Preserve all blank lines between sections
- EDUCATION section must be SEPARATE from PROFESSIONAL EXPERIENCE - never merge them
- CERTIFICATIONS section must be SEPARATE from EDUCATION - never merge them

CRITICAL: Do NOT merge any sections together. Keep PROFESSIONAL EXPERIENCE and EDUCATION as completely separate sections.

Return ONLY the polished resume text with NO additional commentary.`;

            const userPrompt = `Polish this resume while maintaining all factual information:

${resumeText}

${jobContext ? `\nJob Context: This resume is being tailored for a ${jobContext.title} position.` : ''}

Remember: Only polish the language and formatting. Do not add any new information.`;

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3, // Low temperature for consistency
                max_tokens: 3000
            });

            let polished = completion.choices[0].message.content.trim();

            // Count bullet points in original vs polished
            const originalBullets = (resumeText.match(/^•/gm) || []).length;
            const polishedBullets = (polished.match(/^•/gm) || []).length;

            // If AI removed bullets or merged content, reject the polish
            if (polishedBullets < originalBullets * 0.8) {
                console.warn(`⚠️ AI removed too many bullets (${polishedBullets}/${originalBullets}), using original`);
                return resumeText;
            }

            // Safety check: ensure proper line breaks
            if (!polished.includes('\n\n')) {
                console.warn('⚠️ AI removed line breaks, restoring from original');
                return resumeText;
            }

            // Check for merged paragraphs (bullet points should be on separate lines)
            if (polished.includes('• ') && !polished.includes('\n• ')) {
                console.warn('⚠️ AI merged bullet points, restoring from original');
                return resumeText;
            }

            // Ensure all section headers are on their own lines
            const sections = ['PROFESSIONAL SUMMARY', 'CORE COMPETENCIES', 'PROFESSIONAL EXPERIENCE', 'EDUCATION', 'CERTIFICATIONS'];

            // Check for critical section separation issues
            const hasEducation = polished.includes('EDUCATION');
            const hasProfExp = polished.includes('PROFESSIONAL EXPERIENCE');

            if (hasEducation && hasProfExp) {
                const profExpIndex = polished.indexOf('PROFESSIONAL EXPERIENCE');
                const educationIndex = polished.indexOf('EDUCATION');

                // Education should come AFTER Professional Experience
                if (educationIndex < profExpIndex) {
                    console.warn('⚠️ AI reordered sections incorrectly, using original');
                    return resumeText;
                }

                // Check that there are line breaks between them
                const textBetween = polished.substring(profExpIndex, educationIndex);
                if (!textBetween.includes('\n\n')) {
                    console.warn('⚠️ AI merged EDUCATION into PROFESSIONAL EXPERIENCE, using original');
                    return resumeText;
                }
            }

            for (const section of sections) {
                // Count occurrences - should only appear once
                const count = (polished.match(new RegExp(section, 'g')) || []).length;
                if (count > 1) {
                    console.warn(`⚠️ Duplicate section header: ${section}`);
                    // Remove duplicates except first occurrence
                    let firstFound = false;
                    polished = polished.replace(new RegExp(section, 'g'), (match) => {
                        if (!firstFound) {
                            firstFound = true;
                            return match;
                        }
                        return '';
                    });
                }

                // Add line breaks around section headers if missing
                polished = polished.replace(new RegExp(`([^\\n])(${section})`, 'g'), `$1\n\n${section}`);
                polished = polished.replace(new RegExp(`(${section})([^\\n])`, 'g'), `${section}\n\n$2`);
            }

            console.log('✨ Content polished successfully');
            return polished;

        } catch (error) {
            console.error('⚠️ Content polish failed, using original:', error.message);
            return resumeText; // Fallback to original
        }
    }

    /**
     * ATS compatibility checker
     */
    checkATSCompatibility(resumeText) {
        const issues = [];
        let score = 100;

        // Check 1: Standard section headers
        const standardHeaders = ['PROFESSIONAL SUMMARY', 'CORE COMPETENCIES', 'PROFESSIONAL EXPERIENCE', 'EDUCATION'];
        const missingHeaders = standardHeaders.filter(h => !resumeText.includes(h));
        if (missingHeaders.length > 0) {
            score -= missingHeaders.length * 10;
            issues.push({
                severity: 'error',
                message: `Non-standard or missing section headers: ${missingHeaders.join(', ')}`,
                impact: -10 * missingHeaders.length
            });
        }

        // Check 2: Complex formatting (tables, columns, text boxes)
        if (resumeText.includes('\t\t') || /\s{10,}/.test(resumeText)) {
            score -= 15;
            issues.push({
                severity: 'error',
                message: 'Detected complex formatting (tables/columns) that may break in ATS',
                impact: -15
            });
        }

        // Check 3: Contact information placement
        const firstLines = resumeText.split('\n').slice(0, 10).join('\n');
        if (!this.hasEmail(firstLines) || !this.hasPhone(firstLines)) {
            score -= 10;
            issues.push({
                severity: 'warning',
                message: 'Contact information should be in the first few lines',
                impact: -10
            });
        }

        // Check 4: Action verb usage
        const actionVerbCount = this.countActionVerbs(resumeText);
        if (actionVerbCount < 5) {
            score -= 10;
            issues.push({
                severity: 'warning',
                message: `Only ${actionVerbCount} action verbs found. Aim for 10+ for impact.`,
                impact: -10
            });
        }

        // Check 5: Quantified achievements
        const numberCount = (resumeText.match(/\d+(\.\d+)?%|\d+\+|\d+ (percent|years?|months?|customers?|projects?)/gi) || []).length;
        if (numberCount < 3) {
            score -= 5;
            issues.push({
                severity: 'warning',
                message: `Only ${numberCount} quantified achievements. Add more metrics.`,
                impact: -5
            });
        }

        // Check 6: Length check
        const wordCount = resumeText.split(/\s+/).length;
        if (wordCount < 300 || wordCount > 900) {
            score -= 5;
            issues.push({
                severity: 'warning',
                message: `Resume length (${wordCount} words) not optimal. Target 400-800 words.`,
                impact: -5
            });
        }

        return {
            score: Math.max(0, score),
            issues,
            passed: score >= 85
        };
    }

    /**
     * Quality scoring system
     */
    calculateQualityScore(resumeText, jobContext) {
        let score = 0;
        const improvements = [];

        // Professional Summary Quality (max 20 points)
        if (this.hasProfessionalSummary(resumeText)) {
            const summary = this.extractSection(resumeText, 'PROFESSIONAL SUMMARY');
            if (summary.length > 100 && summary.length < 400) {
                score += 20;
            } else if (summary.length > 50) {
                score += 10;
                improvements.push('Professional summary could be more concise (2-3 sentences)');
            }
        } else {
            improvements.push('Add a professional summary section');
        }

        // Core Competencies Quality (max 15 points)
        if (this.hasSection(resumeText, 'CORE COMPETENCIES')) {
            const competencies = this.extractSection(resumeText, 'CORE COMPETENCIES');
            const skillCount = (competencies.match(/•/g) || []).length;
            if (skillCount >= 8 && skillCount <= 15) {
                score += 15;
            } else if (skillCount > 0) {
                score += 8;
                improvements.push(`Optimize competencies count (currently ${skillCount}, target 8-12)`);
            }
        } else {
            improvements.push('Add core competencies section');
        }

        // Experience Quality (max 30 points)
        const actionVerbCount = this.countActionVerbs(resumeText);
        score += Math.min(15, actionVerbCount * 1.5);

        const quantifiedCount = (resumeText.match(/\d+(\.\d+)?%|\d+\+/g) || []).length;
        score += Math.min(15, quantifiedCount * 3);

        if (actionVerbCount < 10) {
            improvements.push(`Add more action verbs (currently ${actionVerbCount}, target 10+)`);
        }
        if (quantifiedCount < 5) {
            improvements.push(`Add more quantified achievements (currently ${quantifiedCount}, target 5+)`);
        }

        // Formatting Quality (max 20 points)
        const formatScore = this.scoreFormatting(resumeText);
        score += formatScore;
        if (formatScore < 15) {
            improvements.push('Improve formatting consistency and structure');
        }

        // Keyword Optimization (max 15 points - if job context provided)
        if (jobContext) {
            const keywordScore = this.scoreKeywordMatch(resumeText, jobContext);
            score += keywordScore;
            if (keywordScore < 10) {
                improvements.push('Add more job-relevant keywords');
            }
        } else {
            score += 10; // Default score if no job context
        }

        return {
            score: Math.min(100, Math.round(score)),
            improvements,
            breakdown: {
                summary: this.hasProfessionalSummary(resumeText) ? 20 : 0,
                competencies: 15,
                experience: actionVerbCount + quantifiedCount,
                formatting: formatScore,
                keywords: jobContext ? this.scoreKeywordMatch(resumeText, jobContext) : 10
            }
        };
    }

    // ===== HELPER METHODS =====

    hasEmail(text) {
        return /[\w\.-]+@[\w\.-]+\.\w+/.test(text);
    }

    hasPhone(text) {
        return /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(text);
    }

    hasProfessionalSummary(text) {
        return text.includes('PROFESSIONAL SUMMARY');
    }

    hasSection(text, sectionName) {
        return text.includes(sectionName);
    }

    extractSection(text, sectionName) {
        const sections = text.split(/\n\n+/);
        const sectionIndex = sections.findIndex(s => s.includes(sectionName));
        if (sectionIndex >= 0 && sectionIndex < sections.length - 1) {
            return sections[sectionIndex + 1];
        }
        return '';
    }

    countActionVerbs(text) {
        const actionVerbs = [
            'achieved', 'administered', 'analyzed', 'collaborated', 'coordinated', 'created',
            'delivered', 'developed', 'directed', 'enhanced', 'exceeded', 'executed',
            'facilitated', 'generated', 'improved', 'increased', 'led', 'managed',
            'optimized', 'organized', 'performed', 'processed', 'reduced', 'resolved',
            'spearheaded', 'streamlined', 'supervised', 'supported', 'transformed'
        ];

        const textLower = text.toLowerCase();
        return actionVerbs.filter(verb => textLower.includes(verb)).length;
    }

    scoreFormatting(text) {
        let score = 0;

        // Consistent spacing
        if (!/\n{4,}/.test(text)) score += 5;

        // Proper bullet points
        const bulletLines = text.split('\n').filter(line => line.trim().startsWith('•'));
        if (bulletLines.length > 5) score += 5;

        // Section structure
        const sectionCount = ['PROFESSIONAL SUMMARY', 'CORE COMPETENCIES', 'PROFESSIONAL EXPERIENCE', 'EDUCATION']
            .filter(s => text.includes(s)).length;
        score += sectionCount * 2.5;

        return Math.min(20, score);
    }

    scoreKeywordMatch(resumeText, jobContext) {
        if (!jobContext || !jobContext.description) return 10;

        const jobText = jobContext.description.toLowerCase();
        const resumeLower = resumeText.toLowerCase();

        // Extract important keywords from job
        const keywords = this.extractKeywords(jobText);
        const matchCount = keywords.filter(k => resumeLower.includes(k)).length;

        const matchRate = keywords.length > 0 ? (matchCount / keywords.length) : 0;
        return Math.round(matchRate * 15);
    }

    extractKeywords(text) {
        const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'];
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3 && !commonWords.includes(w));

        // Return unique keywords
        return [...new Set(words)].slice(0, 20);
    }

    /**
     * Generate detailed validation report
     */
    generateReport(results) {
        const report = {
            summary: `Resume ${results.passed ? 'PASSED' : 'NEEDS IMPROVEMENT'}`,
            atsScore: results.atsScore,
            qualityScore: results.qualityScore,
            issues: results.validationIssues,
            improvements: results.improvements,
            recommendation: this.getRecommendation(results)
        };

        return report;
    }

    getRecommendation(results) {
        if (results.atsScore >= 90 && results.qualityScore >= 90) {
            return 'Excellent! Resume is ready for submission.';
        } else if (results.atsScore >= 85 && results.qualityScore >= 80) {
            return 'Good quality. Consider implementing suggested improvements.';
        } else if (results.atsScore >= 70) {
            return 'Resume needs improvements for optimal ATS performance.';
        } else {
            return 'Critical issues detected. Resume requires significant revision.';
        }
    }
}

module.exports = AIResumeEditor;
