const fs = require('fs-extra');
const path = require('path');

class ResumeImprover {
    constructor() {
        this.bestPractices = {
            // 2025 ATS Best Practices based on research
            format: {
                fileType: '.docx preferred over PDF for maximum ATS compatibility',
                fonts: ['Arial', 'Calibri', 'Times New Roman', 'Helvetica'],
                fontSize: { min: 10, max: 12 },
                margins: '1-inch margins recommended',
                length: '1-2 pages optimal for ATS processing'
            },
            structure: {
                sections: [
                    'Contact Information',
                    'Professional Summary',
                    'Core Competencies/Skills',
                    'Professional Experience',
                    'Education',
                    'Certifications (if applicable)'
                ],
                standardHeaders: [
                    'Professional Summary', 'Work Experience', 'Professional Experience',
                    'Education', 'Skills', 'Core Competencies', 'Certifications'
                ]
            },
            keywords: {
                repetition: { min: 2, max: 3, note: 'Use important keywords 2-3 times throughout resume' },
                exactMatch: 'Use exact wording from job descriptions, not synonyms',
                placement: 'Include keywords in summary, skills, and experience sections'
            },
            avoid: [
                'Headers and footers for important information',
                'Text boxes and columns',
                'Images and graphics',
                'Tables for layout',
                'Fancy fonts or formatting',
                'Keyword stuffing',
                'Misspelled words',
                'Abbreviations without full terms'
            ]
        };
    }

    async analyzeResume(resumeText, targetJobDescription = '') {
        console.log('🔍 Analyzing resume for best practices compliance...');

        const analysis = {
            score: 0,
            maxScore: 100,
            issues: [],
            recommendations: [],
            strengths: [],
            keywordAnalysis: {},
            sectionAnalysis: {}
        };

        // Analyze different aspects
        this.analyzeStructure(resumeText, analysis);
        this.analyzeContent(resumeText, analysis);
        this.analyzeKeywords(resumeText, targetJobDescription, analysis);
        this.analyzeLength(resumeText, analysis);
        this.analyzeFormatting(resumeText, analysis);

        // Calculate final score
        analysis.score = Math.max(0, Math.min(100, analysis.score));

        console.log(`📊 Resume analysis complete. Score: ${analysis.score}/100`);
        return analysis;
    }

    analyzeStructure(resumeText, analysis) {
        const lines = resumeText.split('\n').map(line => line.trim()).filter(line => line.length > 0);

        // Check for standard section headers
        const foundSections = [];
        const standardHeaders = this.bestPractices.structure.standardHeaders;

        for (const line of lines) {
            const lineLower = line.toLowerCase();
            for (const header of standardHeaders) {
                if (lineLower.includes(header.toLowerCase())) {
                    foundSections.push(header);
                    break;
                }
            }
        }

        analysis.sectionAnalysis.foundSections = [...new Set(foundSections)];
        analysis.sectionAnalysis.missingSections = standardHeaders.filter(
            header => !foundSections.some(found =>
                found.toLowerCase().includes(header.toLowerCase())
            )
        );

        // Score based on sections found
        const sectionScore = (foundSections.length / standardHeaders.length) * 20;
        analysis.score += sectionScore;

        if (foundSections.length >= 4) {
            analysis.strengths.push(`✅ Good section structure with ${foundSections.length} standard sections`);
        } else {
            analysis.issues.push(`❌ Missing key sections. Found only: ${foundSections.join(', ')}`);
            analysis.recommendations.push(`📝 Add missing sections: ${analysis.sectionAnalysis.missingSections.join(', ')}`);
        }

        // Check for professional summary
        if (foundSections.some(s => s.toLowerCase().includes('summary'))) {
            analysis.score += 10;
            analysis.strengths.push('✅ Includes professional summary section');
        } else {
            analysis.issues.push('❌ Missing professional summary section');
            analysis.recommendations.push('📝 Add a professional summary at the top (2-3 sentences highlighting key qualifications)');
        }
    }

    analyzeContent(resumeText, analysis) {
        const wordCount = resumeText.split(/\s+/).length;
        const lines = resumeText.split('\n').filter(line => line.trim().length > 0);

        // Check content length
        if (wordCount >= 200 && wordCount <= 800) {
            analysis.score += 15;
            analysis.strengths.push(`✅ Good content length (${wordCount} words)`);
        } else if (wordCount < 200) {
            analysis.issues.push(`❌ Resume too short (${wordCount} words)`);
            analysis.recommendations.push('📝 Add more detailed experience descriptions and achievements');
        } else {
            analysis.issues.push(`❌ Resume too long (${wordCount} words)`);
            analysis.recommendations.push('📝 Condense content to 600-800 words for optimal ATS processing');
        }

        // Check for quantified achievements
        const quantifiedPattern = /\d+(\.\d+)?(%|percent|\+|plus|hours?|years?|months?|days?|customers?|clients?|projects?|teams?|people|staff|million|thousand|k\b)/gi;
        const quantifiedMatches = resumeText.match(quantifiedPattern) || [];

        if (quantifiedMatches.length >= 3) {
            analysis.score += 10;
            analysis.strengths.push(`✅ Good use of quantified achievements (${quantifiedMatches.length} found)`);
        } else {
            analysis.issues.push('❌ Insufficient quantified achievements');
            analysis.recommendations.push('📝 Add specific numbers, percentages, and metrics to demonstrate impact');
        }

        // Check for action verbs
        const actionVerbs = [
            'achieved', 'managed', 'led', 'developed', 'created', 'implemented', 'improved',
            'increased', 'reduced', 'streamlined', 'coordinated', 'supervised', 'trained',
            'collaborated', 'analyzed', 'resolved', 'optimized', 'facilitated', 'executed'
        ];

        const actionVerbCount = actionVerbs.filter(verb =>
            new RegExp(`\\b${verb}`, 'gi').test(resumeText)
        ).length;

        if (actionVerbCount >= 5) {
            analysis.score += 10;
            analysis.strengths.push(`✅ Strong use of action verbs (${actionVerbCount} different verbs)`);
        } else {
            analysis.issues.push('❌ Limited use of strong action verbs');
            analysis.recommendations.push('📝 Start bullet points with strong action verbs like "achieved," "managed," "implemented"');
        }
    }

    analyzeKeywords(resumeText, targetJobDescription, analysis) {
        if (!targetJobDescription || targetJobDescription.trim().length === 0) {
            analysis.recommendations.push('📝 Provide a target job description for keyword optimization analysis');
            return;
        }

        const resumeWords = this.extractKeywords(resumeText);
        const jobWords = this.extractKeywords(targetJobDescription);

        // Find matching keywords
        const matchingKeywords = resumeWords.filter(word =>
            jobWords.some(jobWord => jobWord.toLowerCase() === word.toLowerCase())
        );

        // Find important job keywords missing from resume
        const importantJobKeywords = jobWords.filter(word =>
            word.length > 3 && // Skip short words
            !['and', 'the', 'for', 'with', 'you', 'will', 'are', 'have'].includes(word.toLowerCase())
        );

        const missingKeywords = importantJobKeywords.filter(keyword =>
            !resumeWords.some(resumeWord => resumeWord.toLowerCase() === keyword.toLowerCase())
        );

        analysis.keywordAnalysis = {
            matchingKeywords: matchingKeywords.slice(0, 20), // Top 20
            missingKeywords: missingKeywords.slice(0, 15), // Top 15 missing
            matchPercentage: Math.round((matchingKeywords.length / Math.max(importantJobKeywords.length, 1)) * 100)
        };

        // Score based on keyword matching
        if (analysis.keywordAnalysis.matchPercentage >= 40) {
            analysis.score += 20;
            analysis.strengths.push(`✅ Good keyword matching (${analysis.keywordAnalysis.matchPercentage}%)`);
        } else if (analysis.keywordAnalysis.matchPercentage >= 20) {
            analysis.score += 10;
            analysis.issues.push(`⚠️ Moderate keyword matching (${analysis.keywordAnalysis.matchPercentage}%)`);
        } else {
            analysis.issues.push(`❌ Low keyword matching (${analysis.keywordAnalysis.matchPercentage}%)`);
        }

        if (missingKeywords.length > 0) {
            analysis.recommendations.push(`📝 Consider adding these job-relevant keywords: ${missingKeywords.slice(0, 10).join(', ')}`);
        }
    }

    analyzeLength(resumeText, analysis) {
        const lines = resumeText.split('\n').filter(line => line.trim().length > 0);
        const estimatedPages = Math.ceil(lines.length / 45); // Rough estimate

        if (estimatedPages <= 2) {
            analysis.score += 10;
            analysis.strengths.push(`✅ Appropriate length (≈${estimatedPages} page${estimatedPages > 1 ? 's' : ''})`);
        } else {
            analysis.issues.push(`❌ Resume too long (≈${estimatedPages} pages)`);
            analysis.recommendations.push('📝 Condense to 1-2 pages for optimal ATS processing');
        }
    }

    analyzeFormatting(resumeText, analysis) {
        // Check for potential formatting issues in text
        const problematicPatterns = [
            { pattern: /\t{2,}/, issue: 'Multiple tabs detected (may indicate table formatting)' },
            { pattern: /\s{10,}/, issue: 'Excessive spacing detected (may indicate formatting issues)' },
            { pattern: /[^\w\s\-.,():;'"!?@#$%&*+=\/\\]/g, issue: 'Special characters that may cause ATS parsing issues' }
        ];

        let formatScore = 15; // Start with full points

        for (const { pattern, issue } of problematicPatterns) {
            if (pattern.test(resumeText)) {
                formatScore -= 5;
                analysis.issues.push(`❌ ${issue}`);
            }
        }

        analysis.score += Math.max(0, formatScore);

        // Check for standard contact information
        const emailPattern = /[\w\.-]+@[\w\.-]+\.\w+/;
        const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;

        if (emailPattern.test(resumeText)) {
            analysis.strengths.push('✅ Email address found');
        } else {
            analysis.issues.push('❌ No email address detected');
        }

        if (phonePattern.test(resumeText)) {
            analysis.strengths.push('✅ Phone number found');
        } else {
            analysis.issues.push('❌ No phone number detected');
        }
    }

    extractKeywords(text) {
        // Extract meaningful keywords from text
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2)
            .filter(word => !this.isStopWord(word));

        // Return unique words
        return [...new Set(words)];
    }

    isStopWord(word) {
        const stopWords = [
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
            'below', 'between', 'among', 'throughout', 'despite', 'towards', 'upon', 'concerning',
            'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
            'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
            'must', 'shall', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she',
            'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her',
            'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs'
        ];
        return stopWords.includes(word.toLowerCase());
    }

    generateImprovementSuggestions(analysis) {
        const suggestions = {
            immediate: [],
            longTerm: [],
            atsOptimization: []
        };

        // Immediate fixes
        if (analysis.issues.some(issue => issue.includes('contact'))) {
            suggestions.immediate.push('Add complete contact information (email, phone, location)');
        }

        if (analysis.issues.some(issue => issue.includes('summary'))) {
            suggestions.immediate.push('Add a professional summary highlighting your key qualifications');
        }

        // Long-term improvements
        if (analysis.issues.some(issue => issue.includes('quantified'))) {
            suggestions.longTerm.push('Add specific metrics and achievements (percentages, numbers, timeframes)');
        }

        if (analysis.issues.some(issue => issue.includes('action verbs'))) {
            suggestions.longTerm.push('Rewrite bullet points to start with strong action verbs');
        }

        // ATS Optimization
        if (analysis.keywordAnalysis.matchPercentage < 30) {
            suggestions.atsOptimization.push('Incorporate more job-relevant keywords naturally throughout your resume');
        }

        if (analysis.issues.some(issue => issue.includes('sections'))) {
            suggestions.atsOptimization.push('Use standard section headers (Professional Experience, Skills, Education)');
        }

        return suggestions;
    }

    async generateImprovedResume(originalResume, analysis, targetJob = null) {
        console.log('🔄 Generating improved resume based on analysis...');

        // This would implement actual resume improvement logic
        // For now, return recommendations
        const improvements = {
            summary: 'Based on the analysis, here are the key areas for improvement:',
            priorityFixes: analysis.recommendations.slice(0, 5),
            score: analysis.score,
            potentialScore: Math.min(100, analysis.score + 30),
            nextSteps: [
                'Review and implement priority fixes',
                'Add quantified achievements where possible',
                'Optimize keywords for target job descriptions',
                'Ensure all sections use standard headers',
                'Save in .docx format for best ATS compatibility'
            ]
        };

        return improvements;
    }
}

module.exports = ResumeImprover;