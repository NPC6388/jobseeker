/**
 * Advanced Keyword Optimizer
 * Semantic keyword matching, density optimization, and strategic placement
 */
class KeywordOptimizer {
    constructor() {
        // Industry-specific keyword databases
        this.keywordDatabases = {
            customerService: {
                primary: ['customer service', 'client relations', 'customer satisfaction', 'customer support'],
                secondary: ['help desk', 'call center', 'customer retention', 'conflict resolution', 'customer care'],
                technical: ['CRM', 'ticketing systems', 'live chat', 'phone support', 'email support'],
                soft: ['communication', 'empathy', 'active listening', 'problem solving', 'patience']
            },
            administrative: {
                primary: ['administrative support', 'office administration', 'data entry', 'record keeping'],
                secondary: ['scheduling', 'document management', 'filing', 'correspondence', 'database management'],
                technical: ['Microsoft Office', 'Excel', 'Word', 'Outlook', 'calendar management'],
                soft: ['attention to detail', 'organization', 'time management', 'multitasking']
            },
            dataEntry: {
                primary: ['data entry', 'data input', 'data processing', 'database management'],
                secondary: ['typing speed', 'accuracy', 'data verification', 'spreadsheet management'],
                technical: ['Excel', 'database systems', 'data analysis', 'quality control'],
                soft: ['attention to detail', 'accuracy', 'efficiency', 'focus']
            },
            retail: {
                primary: ['retail sales', 'customer service', 'merchandising', 'inventory management'],
                secondary: ['POS systems', 'cash handling', 'product knowledge', 'visual merchandising'],
                technical: ['point of sale', 'inventory systems', 'sales tracking'],
                soft: ['customer engagement', 'sales skills', 'teamwork', 'communication']
            }
        };

        // Semantic keyword groups (synonyms and related terms)
        this.semanticGroups = {
            'managed': ['led', 'directed', 'supervised', 'coordinated', 'oversaw'],
            'improved': ['enhanced', 'optimized', 'streamlined', 'upgraded', 'refined'],
            'achieved': ['accomplished', 'attained', 'delivered', 'exceeded', 'surpassed'],
            'customer service': ['client service', 'customer support', 'client relations', 'customer care'],
            'data entry': ['data input', 'data processing', 'data management'],
            'communication': ['interpersonal skills', 'verbal communication', 'written communication'],
            'organization': ['organizational skills', 'time management', 'planning', 'scheduling']
        };

        // Target keyword density
        this.targetDensity = {
            min: 2.0, // 2% minimum
            optimal: 3.0, // 3% optimal
            max: 4.5 // 4.5% maximum (avoid keyword stuffing)
        };
    }

    /**
     * Extract and score keywords from job description
     */
    analyzeJobKeywords(jobDescription, jobTitle) {
        const keywords = {
            critical: [],    // Must-have keywords
            important: [],   // Should-have keywords
            supporting: []   // Nice-to-have keywords
        };

        const text = `${jobTitle} ${jobDescription}`.toLowerCase();

        // Identify job category
        const category = this.identifyJobCategory(jobTitle, jobDescription);

        if (category && this.keywordDatabases[category]) {
            const db = this.keywordDatabases[category];

            // Critical keywords (primary)
            keywords.critical = db.primary.filter(keyword =>
                text.includes(keyword.toLowerCase())
            );

            // Important keywords (secondary + technical)
            keywords.important = [
                ...db.secondary.filter(keyword => text.includes(keyword.toLowerCase())),
                ...db.technical.filter(keyword => text.includes(keyword.toLowerCase()))
            ];

            // Supporting keywords (soft skills)
            keywords.supporting = db.soft.filter(keyword =>
                text.includes(keyword.toLowerCase())
            );
        }

        // Extract additional keywords from job description
        const extractedKeywords = this.extractKeywordsFromText(text);
        keywords.important.push(...extractedKeywords.filter(k =>
            !keywords.critical.includes(k) && !keywords.supporting.includes(k)
        ));

        // Remove duplicates
        keywords.critical = [...new Set(keywords.critical)];
        keywords.important = [...new Set(keywords.important)];
        keywords.supporting = [...new Set(keywords.supporting)];

        console.log(`🔍 Keyword Analysis: ${keywords.critical.length} critical, ${keywords.important.length} important, ${keywords.supporting.length} supporting`);

        return keywords;
    }

    /**
     * Calculate keyword density in resume
     */
    calculateKeywordDensity(resumeText, keywords) {
        const words = resumeText.split(/\s+/).length;
        const resumeLower = resumeText.toLowerCase();

        const densityReport = {
            critical: {},
            important: {},
            supporting: {},
            overall: 0,
            recommendations: []
        };

        let totalKeywordOccurrences = 0;

        // Analyze critical keywords
        for (const keyword of keywords.critical) {
            const occurrences = this.countKeywordOccurrences(resumeLower, keyword);
            densityReport.critical[keyword] = {
                count: occurrences,
                density: (occurrences / words) * 100,
                status: this.getKeywordStatus(occurrences)
            };
            totalKeywordOccurrences += occurrences;

            if (occurrences === 0) {
                densityReport.recommendations.push({
                    priority: 'high',
                    message: `Add critical keyword: "${keyword}" (currently missing)`
                });
            } else if (occurrences === 1) {
                densityReport.recommendations.push({
                    priority: 'medium',
                    message: `Increase frequency of "${keyword}" (target: 2-3 occurrences)`
                });
            }
        }

        // Analyze important keywords
        for (const keyword of keywords.important.slice(0, 10)) { // Top 10 important keywords
            const occurrences = this.countKeywordOccurrences(resumeLower, keyword);
            densityReport.important[keyword] = {
                count: occurrences,
                density: (occurrences / words) * 100,
                status: this.getKeywordStatus(occurrences)
            };
            totalKeywordOccurrences += occurrences;

            if (occurrences === 0 && keywords.important.indexOf(keyword) < 5) {
                densityReport.recommendations.push({
                    priority: 'medium',
                    message: `Consider adding: "${keyword}"`
                });
            }
        }

        densityReport.overall = (totalKeywordOccurrences / words) * 100;

        // Overall density recommendations
        if (densityReport.overall < this.targetDensity.min) {
            densityReport.recommendations.unshift({
                priority: 'high',
                message: `Keyword density too low (${densityReport.overall.toFixed(1)}%). Target: ${this.targetDensity.optimal}%`
            });
        } else if (densityReport.overall > this.targetDensity.max) {
            densityReport.recommendations.unshift({
                priority: 'high',
                message: `Keyword density too high (${densityReport.overall.toFixed(1)}%). Risk of keyword stuffing.`
            });
        }

        return densityReport;
    }

    /**
     * Optimize resume with strategic keyword placement
     */
    optimizeKeywordPlacement(resumeText, keywords, densityReport) {
        let optimized = resumeText;
        const placementStrategy = this.createPlacementStrategy(keywords, densityReport);

        console.log('🎯 Strategic keyword optimization in progress...');

        // 1. Enhance Professional Summary with missing critical keywords
        optimized = this.enhanceProfessionalSummary(optimized, placementStrategy.summaryKeywords);

        // 2. Optimize Core Competencies section
        optimized = this.optimizeCompetencies(optimized, placementStrategy.competencyKeywords);

        // 3. Enhance Experience section with contextual keywords
        optimized = this.enhanceExperience(optimized, placementStrategy.experienceKeywords);

        console.log('✅ Keyword optimization complete');
        return optimized;
    }

    /**
     * Create strategic placement plan
     */
    createPlacementStrategy(keywords, densityReport) {
        const strategy = {
            summaryKeywords: [],
            competencyKeywords: [],
            experienceKeywords: []
        };

        // Critical keywords with 0 occurrences → add to summary
        for (const [keyword, data] of Object.entries(densityReport.critical)) {
            if (data.count === 0) {
                strategy.summaryKeywords.push(keyword);
            } else if (data.count === 1) {
                strategy.experienceKeywords.push(keyword);
            }
        }

        // Important keywords → add to competencies if missing
        for (const [keyword, data] of Object.entries(densityReport.important)) {
            if (data.count === 0) {
                strategy.competencyKeywords.push(keyword);
            }
        }

        return strategy;
    }

    /**
     * Enhance professional summary with keywords
     */
    enhanceProfessionalSummary(resumeText, keywords) {
        if (keywords.length === 0) return resumeText;

        const summaryMatch = resumeText.match(/(PROFESSIONAL SUMMARY\n\n)([\s\S]*?)(\n\n)/);
        if (!summaryMatch) return resumeText;

        let summary = summaryMatch[2];
        const summaryLower = summary.toLowerCase();

        // Add missing keywords naturally
        for (const keyword of keywords.slice(0, 3)) { // Limit to 3 keywords to avoid stuffing
            if (!summaryLower.includes(keyword.toLowerCase())) {
                // Add keyword naturally to summary
                summary += ` with expertise in ${keyword}`;
            }
        }

        return resumeText.replace(summaryMatch[0], `${summaryMatch[1]}${summary}${summaryMatch[3]}`);
    }

    /**
     * Optimize competencies section
     */
    optimizeCompetencies(resumeText, keywords) {
        if (keywords.length === 0) return resumeText;

        const competenciesMatch = resumeText.match(/(CORE COMPETENCIES\n\n)([\s\S]*?)(\n\n)/);
        if (!competenciesMatch) return resumeText;

        let competencies = competenciesMatch[2];
        const existingCompetencies = competencies.toLowerCase();

        // Add missing keywords as competencies
        for (const keyword of keywords) {
            if (!existingCompetencies.includes(keyword.toLowerCase())) {
                // Format keyword as competency
                const formattedKeyword = this.formatAsCompetency(keyword);
                competencies += `• ${formattedKeyword}\n`;
            }
        }

        return resumeText.replace(competenciesMatch[0], `${competenciesMatch[1]}${competencies}${competenciesMatch[3]}`);
    }

    /**
     * Enhance experience section with keywords
     */
    enhanceExperience(resumeText, keywords) {
        // This is more conservative - only suggests, doesn't auto-add
        // to avoid fabricating experience
        return resumeText;
    }

    /**
     * Semantic keyword matching
     */
    findSemanticMatches(keyword, resumeText) {
        const resumeLower = resumeText.toLowerCase();
        const matches = [];

        // Check if keyword exists
        if (resumeLower.includes(keyword.toLowerCase())) {
            matches.push({ keyword, type: 'exact' });
        }

        // Check semantic group for synonyms
        for (const [primary, synonyms] of Object.entries(this.semanticGroups)) {
            if (primary.toLowerCase() === keyword.toLowerCase()) {
                for (const synonym of synonyms) {
                    if (resumeLower.includes(synonym.toLowerCase())) {
                        matches.push({ keyword: synonym, type: 'semantic' });
                    }
                }
            }
        }

        return matches;
    }

    /**
     * Helper methods
     */

    identifyJobCategory(jobTitle, jobDescription) {
        const text = `${jobTitle} ${jobDescription}`.toLowerCase();

        if (text.includes('customer service') || text.includes('customer support')) {
            return 'customerService';
        } else if (text.includes('administrative') || text.includes('office') || text.includes('admin')) {
            return 'administrative';
        } else if (text.includes('data entry') || text.includes('data input')) {
            return 'dataEntry';
        } else if (text.includes('retail') || text.includes('sales associate')) {
            return 'retail';
        }

        return null;
    }

    extractKeywordsFromText(text) {
        const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'];
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 3 && !stopWords.includes(w));

        // Count frequency
        const frequency = {};
        for (const word of words) {
            frequency[word] = (frequency[word] || 0) + 1;
        }

        // Return words that appear 2+ times, sorted by frequency
        return Object.entries(frequency)
            .filter(([_, count]) => count >= 2)
            .sort((a, b) => b[1] - a[1])
            .map(([word, _]) => word)
            .slice(0, 15);
    }

    countKeywordOccurrences(text, keyword) {
        const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g');
        const matches = text.match(regex);
        return matches ? matches.length : 0;
    }

    getKeywordStatus(count) {
        if (count === 0) return 'missing';
        if (count === 1) return 'low';
        if (count <= 3) return 'good';
        if (count <= 5) return 'optimal';
        return 'high';
    }

    formatAsCompetency(keyword) {
        // Convert keyword to proper competency format
        return keyword
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Generate keyword optimization report
     */
    generateOptimizationReport(keywords, densityReport) {
        const report = {
            summary: {
                totalKeywords: keywords.critical.length + keywords.important.length,
                criticalKeywords: keywords.critical.length,
                overallDensity: densityReport.overall.toFixed(2) + '%',
                status: this.getDensityStatus(densityReport.overall)
            },
            keywordCoverage: {
                critical: this.calculateCoverage(keywords.critical, densityReport.critical),
                important: this.calculateCoverage(keywords.important, densityReport.important)
            },
            recommendations: densityReport.recommendations,
            topMissingKeywords: this.getTopMissingKeywords(keywords, densityReport)
        };

        return report;
    }

    calculateCoverage(keywords, densityData) {
        if (keywords.length === 0) return 100;

        const present = keywords.filter(k => {
            const data = densityData[k];
            return data && data.count > 0;
        }).length;

        return Math.round((present / keywords.length) * 100);
    }

    getTopMissingKeywords(keywords, densityReport) {
        const missing = [];

        // Critical keywords missing
        for (const keyword of keywords.critical) {
            if (densityReport.critical[keyword]?.count === 0) {
                missing.push({ keyword, priority: 'critical' });
            }
        }

        // Important keywords missing
        for (const keyword of keywords.important.slice(0, 5)) {
            if (densityReport.important[keyword]?.count === 0) {
                missing.push({ keyword, priority: 'important' });
            }
        }

        return missing.slice(0, 10);
    }

    getDensityStatus(density) {
        if (density < this.targetDensity.min) return 'too_low';
        if (density > this.targetDensity.max) return 'too_high';
        if (density >= this.targetDensity.optimal - 0.5 && density <= this.targetDensity.optimal + 0.5) {
            return 'optimal';
        }
        return 'good';
    }
}

module.exports = KeywordOptimizer;
