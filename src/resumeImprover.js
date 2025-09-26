const fs = require('fs-extra');
const path = require('path');

class ResumeImprover {
    constructor() {
        this.bestPractices = {
            // 2024-2025 ATS Best Practices based on latest industry research
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

        const analysis = {
            score: 0,
            maxScore: 100,
            issues: [],
            recommendations: [],
            strengths: [],
            keywordAnalysis: {},
            sectionAnalysis: {}
        };

        // Comprehensive 2024 analysis based on latest research
        this.analyzeStructure(resumeText, analysis);
        this.analyzeContent(resumeText, analysis);
        this.analyzeKeywords(resumeText, targetJobDescription, analysis);
        this.analyzeLength(resumeText, analysis);
        this.analyzeFormatting(resumeText, analysis);
        this.analyzeATSCompatibility(resumeText, analysis);
        this.analyzeProfessionalPresence(resumeText, analysis);
        this.analyzeWritingQuality(resumeText, analysis);
        this.generateExtensiveRecommendations(analysis, targetJobDescription);

        // Calculate final score
        analysis.score = Math.max(0, Math.min(100, analysis.score));

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
            analysis.recommendations.push(`📝 HIGH PRIORITY: Add these job-relevant keywords: ${missingKeywords.slice(0, 8).join(', ')}`);
            analysis.recommendations.push(`💡 TIP: Include both full terms and common abbreviations (e.g., "Search Engine Optimization (SEO)")`);
            analysis.recommendations.push(`🎯 KEYWORD STRATEGY: Use important keywords 2-3 times throughout your resume for optimal ATS scoring`);
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

    analyzeATSCompatibility(resumeText, analysis) {

        // Check file format indicators
        if (resumeText.includes('\t\t') || resumeText.includes('     ')) {
            analysis.issues.push('⚠️ CRITICAL: Table or column formatting detected - may cause ATS parsing errors');
            analysis.recommendations.push('🔧 IMMEDIATE FIX: Remove tables, text boxes, and multi-column layouts');
        }

        // Check for ATS-friendly elements
        const hasStandardSections = ['experience', 'education', 'skills'].every(section =>
            resumeText.toLowerCase().includes(section)
        );

        if (hasStandardSections) {
            analysis.score += 8;
            analysis.strengths.push('✅ Uses ATS-friendly standard section headers');
        } else {
            analysis.issues.push('❌ CRITICAL: Non-standard section headers detected');
            analysis.recommendations.push('🔧 Use standard headers: "Professional Experience", "Education", "Skills", "Professional Summary"');
        }

        // Check for exact job title matching (research shows 10.6x more likely to get interview)
        analysis.recommendations.push('🎯 PRO TIP: Include the exact job title from job postings in your resume (increases interview chances by 1060%)');
        analysis.recommendations.push('📊 2024 RESEARCH: Resumes with exact job titles are 10.6x more likely to get interviews');
    }

    analyzeProfessionalPresence(resumeText, analysis) {

        // Check for LinkedIn profile
        const hasLinkedIn = /linkedin\.com|linked.?in/i.test(resumeText);
        if (hasLinkedIn) {
            analysis.score += 5;
            analysis.strengths.push('✅ LinkedIn profile included');
        } else {
            analysis.recommendations.push('🌐 Add your LinkedIn profile URL for enhanced professional presence');
        }

        // Check for personal branding elements
        const hasProfessionalSummary = resumeText.toLowerCase().includes('summary');
        if (hasProfessionalSummary) {
            analysis.score += 5;
        } else {
            analysis.recommendations.push('📝 Add a compelling professional summary (2-3 sentences showcasing your unique value proposition)');
        }

        // Industry-specific recommendations
        analysis.recommendations.push('💼 INDUSTRY TIP: Tailor your resume for each application - generic resumes have 47% lower success rates');
    }

    analyzeWritingQuality(resumeText, analysis) {

        // Check for passive vs active voice
        const passiveIndicators = ['was responsible for', 'duties included', 'worked on', 'helped with'];
        let passiveCount = 0;

        passiveIndicators.forEach(indicator => {
            const matches = resumeText.toLowerCase().split(indicator).length - 1;
            passiveCount += matches;
        });

        if (passiveCount > 2) {
            analysis.issues.push(`❌ IMPACT ISSUE: Found ${passiveCount} instances of passive language`);
            analysis.recommendations.push('💪 IMPACT IMPROVEMENT: Replace passive phrases with strong action verbs ("Led team of 5" vs "Was responsible for team")');
            analysis.recommendations.push('🎯 ACTION VERBS: Use "Achieved", "Delivered", "Transformed", "Spearheaded", "Optimized"');
        } else {
            analysis.score += 8;
            analysis.strengths.push('✅ Strong use of active voice and action-oriented language');
        }

        // Check for results-oriented language
        const resultWords = ['increased', 'decreased', 'improved', 'reduced', 'grew', 'expanded', 'achieved', 'exceeded'];
        const resultCount = resultWords.filter(word =>
            new RegExp(`\\b${word}`, 'gi').test(resumeText)
        ).length;

        if (resultCount >= 3) {
            analysis.score += 10;
            analysis.strengths.push(`✅ Results-oriented language (${resultCount} impact words found)`);
        } else {
            analysis.recommendations.push('📈 RESULTS FOCUS: Add more results-oriented language showing your impact and achievements');
        }
    }

    generateExtensiveRecommendations(analysis, targetJobDescription) {

        // Priority-based recommendations from 2024 research
        const priorityRecommendations = [
            '🔥 CRITICAL SUCCESS FACTOR: Save resume as .docx format (not PDF) for maximum ATS compatibility',
            '⚡ INSTANT IMPACT: Use exact keywords from job descriptions 2-3 times throughout your resume',
            '📊 PROVEN STRATEGY: Include specific metrics and percentages ("Increased sales by 23%" vs "Increased sales")',
            '🎯 2024 BEST PRACTICE: Create a "Core Competencies" section with 8-12 relevant hard skills',
            '💡 EXPERT TIP: Use standard section headers - avoid creative titles that confuse ATS systems',
            '🔍 ATS OPTIMIZATION: Ensure important keywords appear in summary, skills, AND experience sections',
            '📈 IMPACT MULTIPLIER: Start each bullet point with quantifiable achievements, not job duties',
            '🎨 FORMAT CRITICAL: Avoid headers, footers, text boxes, tables, and multiple columns',
            '⭐ DIFFERENTIATION: Include industry-specific certifications and technical skills',
            '🚀 CAREER ADVANCEMENT: Showcase leadership and growth trajectory in previous roles'
        ];

        // Add priority recommendations to the beginning
        analysis.recommendations = [...priorityRecommendations, ...analysis.recommendations];

        // Add 2025-specific insights based on latest research
        analysis.recommendations.push('📊 2025 CRITICAL: 99.7% of recruiters now use keyword filters in their ATS to sort applicants');
        analysis.recommendations.push('🤖 AI TREND: Companies increasingly use AI to optimize ATS systems - your resume must be AI-friendly');
        analysis.recommendations.push('🎯 PROVEN STRATEGY: 75%+ keyword match rate results in 40% higher interview rates');
        analysis.recommendations.push('💼 2025 INSIGHT: Minimalist, clean design is the top trend - avoid graphics and complex formatting');
        analysis.recommendations.push('📈 SUCCESS METRIC: Include both acronyms and full phrases (e.g., \"SEO\" and \"Search Engine Optimization\")');
        analysis.recommendations.push('🔥 MARKET REALITY: Reverse chronological format is most ATS-compatible - use this structure');
        analysis.recommendations.push('⚡ 2025 REQUIREMENT: Quantifiable results focus - ATS systems now prioritize measurable achievements');

        // Industry-agnostic best practices for 2024
        const universalTips = [
            '🏆 ACHIEVEMENT FRAMEWORK: Use STAR method (Situation, Task, Action, Result) for bullet points',
            '🎪 VISUAL HIERARCHY: Use consistent bullet points and spacing for easy scanning',
            '🔗 SKILLS INTEGRATION: Weave soft skills into achievement stories rather than listing separately',
            '📱 MODERN CONTACT: Include LinkedIn, remove outdated elements like "References available upon request"',
            '🎓 EDUCATION STRATEGY: List education after experience unless you\'re a recent graduate',
            '⚡ KEYWORD DENSITY: Aim for 2-4% keyword density to avoid over-optimization penalties',
            '🎯 TAILORING RULE: Customize at least 30% of your resume content for each application',
            '📝 PROOFREADING: Zero tolerance for typos - they cause instant rejection in ATS systems'
        ];

        analysis.recommendations.push(...universalTips);

        // Score-based specific guidance
        if (analysis.score < 60) {
            analysis.recommendations.unshift('🚨 URGENT: Your resume needs significant improvements for ATS success');
            analysis.recommendations.splice(1, 0, '⚠️ PRIORITY: Focus on the CRITICAL and HIGH PRIORITY items first');
        } else if (analysis.score < 75) {
            analysis.recommendations.unshift('📈 GOOD FOUNDATION: Your resume is decent but needs optimization for competitive advantage');
        } else {
            analysis.recommendations.unshift('🌟 STRONG RESUME: You have a solid foundation - focus on fine-tuning for specific roles');
        }
    }

    generateImprovementSuggestions(analysis) {
        const suggestions = {
            critical: [],
            immediate: [],
            longTerm: [],
            atsOptimization: [],
            modernization: []
        };

        // Critical fixes (ATS failures)
        if (analysis.issues.some(issue => issue.includes('CRITICAL'))) {
            suggestions.critical.push('Fix ATS-breaking formatting issues immediately');
            suggestions.critical.push('Convert to .docx format and remove complex layouts');
        }

        // Immediate wins
        if (analysis.issues.some(issue => issue.includes('contact'))) {
            suggestions.immediate.push('Add complete contact information with LinkedIn profile');
        }

        if (analysis.issues.some(issue => issue.includes('summary'))) {
            suggestions.immediate.push('Add compelling professional summary with exact job title keywords');
        }

        // Long-term strategic improvements
        if (analysis.issues.some(issue => issue.includes('quantified'))) {
            suggestions.longTerm.push('Quantify every achievement with specific metrics and percentages');
            suggestions.longTerm.push('Research industry benchmarks to contextualize your achievements');
        }

        // 2024 ATS optimization strategies
        suggestions.atsOptimization.push('Implement semantic keyword strategy (related terms and synonyms)');
        suggestions.atsOptimization.push('Create role-specific resume versions for different job types');
        suggestions.atsOptimization.push('Use ATS testing tools to validate formatting before applications');

        // Modern resume trends for 2024
        suggestions.modernization.push('Add remote work and collaboration skills if applicable');
        suggestions.modernization.push('Include AI/automation experience where relevant');
        suggestions.modernization.push('Showcase continuous learning and adaptability');

        return suggestions;
    }

    async generateImprovedResume(originalResume, analysis, targetJob = null) {

        const improvements = {
            summary: '🎯 COMPREHENSIVE RESUME OPTIMIZATION REPORT - Based on 2024 ATS Research',
            currentScore: analysis.score,
            targetScore: Math.min(100, analysis.score + 35),
            criticalFixes: analysis.recommendations.filter(rec => rec.includes('CRITICAL')).slice(0, 3),
            priorityFixes: analysis.recommendations.filter(rec => rec.includes('HIGH PRIORITY')).slice(0, 5),
            quickWins: analysis.recommendations.filter(rec => rec.includes('INSTANT IMPACT')).slice(0, 4),
            strategicImprovements: analysis.recommendations.filter(rec => rec.includes('PROVEN STRATEGY')).slice(0, 6),
            researchInsights: analysis.recommendations.filter(rec => rec.includes('2024') || rec.includes('RESEARCH')),
            actionPlan: {
                week1: [
                    '🔧 Fix all CRITICAL ATS compatibility issues',
                    '📝 Add professional summary with exact job title keywords',
                    '📊 Save resume as .docx format',
                    '🎯 Implement top 5 missing keywords from target job'
                ],
                week2: [
                    '📈 Add quantified achievements to all experience entries',
                    '💪 Replace passive language with strong action verbs',
                    '🏆 Create Core Competencies section with 8-12 skills',
                    '🔍 Optimize keyword density (2-4% of total content)'
                ],
                ongoing: [
                    '🎯 Customize 30% of resume content for each application',
                    '📱 Keep skills section updated with emerging technologies',
                    '🌐 Maintain active LinkedIn profile alignment',
                    '📊 Track application success rates and adjust strategy'
                ]
            },
            industryBenchmarks: {
                targetKeywordMatch: '75%+ (Currently: ' + (analysis.keywordAnalysis?.matchPercentage || 0) + '%)',
                idealWordCount: '600-800 words (Currently: ' + originalResume.split(/\s+/).length + ' words)',
                recommendedSections: 6,
                quantifiedAchievements: 'Minimum 5-8 per resume'
            },
            nextSteps: [
                '🚀 PHASE 1: Address all critical ATS compatibility issues',
                '⚡ PHASE 2: Implement high-impact keyword optimization',
                '📈 PHASE 3: Enhance content with quantified achievements',
                '🎯 PHASE 4: Test and refine for specific job applications',
                '📊 PHASE 5: Monitor performance and iterate monthly'
            ],
            successMetrics: [
                'ATS compatibility score: 90%+',
                'Keyword match rate: 75%+',
                'Interview request rate: 15%+ improvement',
                'Application-to-response time: Under 2 weeks',
                'Overall resume effectiveness: 80%+ score'
            ]
        };

        return improvements;
    }
}

module.exports = ResumeImprover;