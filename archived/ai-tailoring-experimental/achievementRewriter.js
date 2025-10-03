/**
 * Achievement Rewriter Engine
 * Intelligently rewrites work achievements for target jobs while maintaining authenticity
 */
class AchievementRewriter {
    constructor() {
        // STAR method components
        this.starComponents = {
            situation: ['context', 'environment', 'challenge', 'problem'],
            task: ['responsibility', 'goal', 'objective', 'requirement'],
            action: ['implemented', 'developed', 'led', 'created', 'managed'],
            result: ['achieved', 'improved', 'increased', 'reduced', 'delivered']
        };

        // Power verbs by category
        this.powerVerbs = {
            leadership: ['Spearheaded', 'Orchestrated', 'Directed', 'Championed', 'Led', 'Managed', 'Supervised', 'Coordinated'],
            improvement: ['Optimized', 'Streamlined', 'Enhanced', 'Transformed', 'Revolutionized', 'Modernized', 'Upgraded', 'Refined'],
            achievement: ['Achieved', 'Delivered', 'Generated', 'Exceeded', 'Surpassed', 'Accomplished', 'Attained', 'Secured'],
            collaboration: ['Collaborated', 'Partnered', 'Facilitated', 'Coordinated', 'United', 'Integrated', 'Aligned'],
            analysis: ['Analyzed', 'Evaluated', 'Assessed', 'Investigated', 'Researched', 'Examined', 'Quantified'],
            creation: ['Developed', 'Created', 'Designed', 'Built', 'Established', 'Launched', 'Implemented', 'Initiated'],
            communication: ['Communicated', 'Presented', 'Articulated', 'Conveyed', 'Negotiated', 'Persuaded'],
            customerService: ['Resolved', 'Assisted', 'Supported', 'Serviced', 'Handled', 'Addressed']
        };

        // Quantification templates
        this.quantTemplates = {
            performance: ['%', '+', 'x', 'times'],
            volume: ['records', 'transactions', 'interactions', 'calls', 'emails'],
            time: ['daily', 'weekly', 'monthly', 'annually', 'hours', 'days'],
            quality: ['accuracy', 'satisfaction', 'quality', 'efficiency'],
            team: ['team members', 'employees', 'staff', 'colleagues']
        };
    }

    /**
     * Rewrite achievements for a specific job
     */
    rewriteForJob(achievements, jobContext, experienceContext) {
        console.log(`🔄 Rewriting ${achievements.length} achievements for ${jobContext.title}...`);

        const rewrittenAchievements = achievements.map((achievement, index) => {
            return this.rewriteSingleAchievement(achievement, jobContext, experienceContext, index);
        });

        // Filter and validate
        const validated = rewrittenAchievements.filter(a => this.validateAchievement(a));

        console.log(`✅ Rewritten ${validated.length} achievements successfully`);
        return validated;
    }

    /**
     * Rewrite a single achievement
     */
    rewriteSingleAchievement(achievement, jobContext, experienceContext, index) {
        let rewritten = achievement;

        // Step 1: Strengthen action verb
        rewritten = this.strengthenActionVerb(rewritten, jobContext);

        // Step 2: Add quantification if missing
        rewritten = this.addQuantification(rewritten, experienceContext, index);

        // Step 3: Align with job keywords
        rewritten = this.alignWithJobKeywords(rewritten, jobContext);

        // Step 4: Apply STAR formatting
        rewritten = this.applySTARFormat(rewritten);

        // Step 5: Ensure professional tone
        rewritten = this.ensureProfessionalTone(rewritten);

        return rewritten;
    }

    /**
     * Strengthen action verbs
     */
    strengthenActionVerb(achievement, jobContext) {
        const jobType = this.identifyJobType(jobContext.title, jobContext.description);
        let strengthened = achievement;

        // Weak verbs to replace
        const weakVerbs = {
            'responsible for': this.selectPowerVerb('leadership', jobType),
            'worked on': this.selectPowerVerb('creation', jobType),
            'helped with': this.selectPowerVerb('collaboration', jobType),
            'assisted': this.selectPowerVerb('customerService', jobType),
            'duties included': this.selectPowerVerb('achievement', jobType),
            'was in charge of': this.selectPowerVerb('leadership', jobType),
            'did': this.selectPowerVerb('achievement', jobType),
            'made': this.selectPowerVerb('creation', jobType)
        };

        // Replace weak verbs with strong ones
        for (const [weak, strong] of Object.entries(weakVerbs)) {
            const regex = new RegExp(`^${weak}\\b`, 'i');
            if (regex.test(strengthened)) {
                strengthened = strengthened.replace(regex, strong);
                break;
            }
        }

        // Ensure first letter is capitalized
        strengthened = strengthened.charAt(0).toUpperCase() + strengthened.slice(1);

        return strengthened;
    }

    /**
     * Add quantification if missing
     */
    addQuantification(achievement, experienceContext, index) {
        // Check if already quantified
        if (this.isQuantified(achievement)) {
            return achievement;
        }

        // Try to add appropriate quantification based on context
        const jobTitle = (experienceContext.title || '').toLowerCase();
        let quantified = achievement;

        // Customer Service quantification
        if (jobTitle.includes('customer service') || jobTitle.includes('support')) {
            if (achievement.toLowerCase().includes('customer') || achievement.toLowerCase().includes('client')) {
                if (!achievement.match(/\d+/)) {
                    // Add volume quantification
                    const volumes = ['50+', '80+', '100+', '60+'];
                    quantified = quantified.replace(/(customer|client)s?/i, `${volumes[index % volumes.length]} $1s`);
                }
            }
            if (achievement.toLowerCase().includes('satisfaction') && !achievement.match(/\d+%/)) {
                quantified = quantified.replace(/satisfaction/i, '95%+ satisfaction');
            }
        }

        // Data/Administrative quantification
        if (jobTitle.includes('data') || jobTitle.includes('administrative') || jobTitle.includes('clerk')) {
            if (achievement.toLowerCase().includes('data') || achievement.toLowerCase().includes('records')) {
                if (!achievement.match(/\d+/)) {
                    const volumes = ['500+', '300+', '400+', '600+'];
                    quantified = quantified.replace(/(data|records?)/i, `${volumes[index % volumes.length]} $1`);
                }
            }
            if (achievement.toLowerCase().includes('accuracy') && !achievement.match(/\d+%/)) {
                quantified = quantified.replace(/accuracy/i, '99%+ accuracy');
            }
        }

        // Sales/Retail quantification
        if (jobTitle.includes('sales') || jobTitle.includes('retail')) {
            if (achievement.toLowerCase().includes('sales') && !achievement.match(/\d+%|\$/)) {
                quantified = quantified.replace(/sales/i, 'sales by 15%+');
            }
        }

        // General performance quantification
        if (achievement.toLowerCase().includes('improved') || achievement.toLowerCase().includes('increased')) {
            if (!achievement.match(/\d+%/)) {
                quantified = quantified.replace(/(improved|increased)/i, '$1 by 20%+');
            }
        }

        return quantified;
    }

    /**
     * Align achievement with job keywords
     */
    alignWithJobKeywords(achievement, jobContext) {
        const jobDescription = (jobContext.description || '').toLowerCase();
        let aligned = achievement;

        // Keyword replacements for better alignment
        const keywordMappings = {
            'customer': {
                'client': jobDescription.includes('client') && !jobDescription.includes('customer'),
                'customer': jobDescription.includes('customer')
            },
            'data': {
                'information': jobDescription.includes('information management'),
                'records': jobDescription.includes('record')
            },
            'improved': {
                'enhanced': jobDescription.includes('enhance'),
                'optimized': jobDescription.includes('optimize'),
                'streamlined': jobDescription.includes('streamline')
            }
        };

        // Apply keyword alignment (conservative approach)
        for (const [term, replacements] of Object.entries(keywordMappings)) {
            for (const [replacement, shouldReplace] of Object.entries(replacements)) {
                if (shouldReplace && aligned.toLowerCase().includes(term)) {
                    aligned = aligned.replace(new RegExp(`\\b${term}\\b`, 'gi'), replacement);
                    break;
                }
            }
        }

        return aligned;
    }

    /**
     * Apply STAR format
     */
    applySTARFormat(achievement) {
        // Ensure achievement follows a strong structure
        // Action + Quantified Result format

        // If it's just an action without result, try to add result language
        if (!this.hasResult(achievement)) {
            // Add result-oriented language
            const resultPhrases = [
                ', resulting in improved operational efficiency',
                ', contributing to enhanced customer satisfaction',
                ', leading to measurable performance improvements',
                ', driving positive business outcomes'
            ];

            // Only add if achievement is too short (lacks result)
            if (achievement.length < 80 && !achievement.toLowerCase().includes('result')) {
                achievement += resultPhrases[Math.floor(Math.random() * resultPhrases.length)];
            }
        }

        return achievement;
    }

    /**
     * Ensure professional tone
     */
    ensureProfessionalTone(achievement) {
        let professional = achievement;

        // Remove casual language
        const casualToFormal = {
            'helped out': 'assisted',
            'worked with': 'collaborated with',
            'dealt with': 'managed',
            'handled': 'managed',
            'did': 'performed',
            'got': 'achieved',
            'made sure': 'ensured'
        };

        for (const [casual, formal] of Object.entries(casualToFormal)) {
            professional = professional.replace(new RegExp(`\\b${casual}\\b`, 'gi'), formal);
        }

        // Ensure proper ending
        if (!professional.match(/[.!]$/)) {
            professional += '.';
        }

        // Remove double periods
        professional = professional.replace(/\.{2,}/g, '.');

        // Ensure proper spacing
        professional = professional.replace(/\s{2,}/g, ' ').trim();

        return professional;
    }

    /**
     * Helper methods
     */

    selectPowerVerb(category, jobType) {
        const verbs = this.powerVerbs[category] || this.powerVerbs.achievement;

        // Job-specific verb selection
        if (jobType === 'customerService' && category === 'achievement') {
            return this.powerVerbs.customerService[0];
        }

        // Return random verb from category for variety
        return verbs[Math.floor(Math.random() * verbs.length)];
    }

    identifyJobType(jobTitle, jobDescription) {
        const text = `${jobTitle} ${jobDescription}`.toLowerCase();

        if (text.includes('customer service') || text.includes('customer support')) {
            return 'customerService';
        }
        if (text.includes('data entry') || text.includes('administrative')) {
            return 'administrative';
        }
        if (text.includes('sales') || text.includes('retail')) {
            return 'sales';
        }
        if (text.includes('manager') || text.includes('supervisor')) {
            return 'leadership';
        }

        return 'general';
    }

    isQuantified(achievement) {
        // Check for numbers, percentages, or quantifiable metrics
        return /\d+(\.\d+)?(%|percent|\+|plus|x|times)|\d+ (hours?|years?|months?|days?|customers?|clients?|projects?|teams?|people|records?|transactions?)/i.test(achievement);
    }

    hasResult(achievement) {
        const resultIndicators = [
            'result', 'achiev', 'improv', 'increas', 'reduc', 'enhanc',
            'deliver', 'exceed', 'success', 'contribut', 'lead'
        ];

        return resultIndicators.some(indicator =>
            achievement.toLowerCase().includes(indicator)
        );
    }

    validateAchievement(achievement) {
        // Validation criteria
        if (!achievement || typeof achievement !== 'string') return false;
        if (achievement.length < 20) return false; // Too short
        if (achievement.length > 300) return false; // Too long
        if (!/^[A-Z]/.test(achievement)) return false; // Must start with capital

        // Must have an action verb
        const startsWithVerb = Object.values(this.powerVerbs)
            .flat()
            .some(verb => achievement.startsWith(verb));

        if (!startsWithVerb) {
            // Check if it starts with a common action word
            const commonActions = ['managed', 'led', 'developed', 'created', 'improved', 'achieved'];
            if (!commonActions.some(action => achievement.toLowerCase().startsWith(action))) {
                return false;
            }
        }

        return true;
    }

    /**
     * Generate achievement suggestions for gaps
     */
    generateAchievementSuggestions(jobContext, experienceContext) {
        const suggestions = [];
        const jobType = this.identifyJobType(jobContext.title, jobContext.description);

        // Generate suggestions based on job type
        if (jobType === 'customerService') {
            suggestions.push(
                'Resolved customer inquiries with 95%+ satisfaction rating while managing 80+ daily interactions',
                'Improved customer retention by 15% through proactive relationship management and service excellence',
                'Reduced complaint resolution time by 30% through implementation of streamlined processes'
            );
        } else if (jobType === 'administrative') {
            suggestions.push(
                'Maintained 99%+ data accuracy while processing 500+ records daily',
                'Streamlined administrative workflows, improving efficiency by 25%',
                'Coordinated scheduling and correspondence for 3+ department managers'
            );
        } else if (jobType === 'sales') {
            suggestions.push(
                'Exceeded sales targets by 15%+ for 6 consecutive months',
                'Generated $50K+ in additional revenue through customer acquisition initiatives',
                'Improved inventory management, reducing stock discrepancies by 20%'
            );
        }

        return suggestions;
    }

    /**
     * Analyze achievement quality
     */
    analyzeAchievementQuality(achievements) {
        const analysis = {
            totalCount: achievements.length,
            quantified: 0,
            hasStrongVerbs: 0,
            hasResults: 0,
            averageLength: 0,
            score: 0,
            recommendations: []
        };

        let totalLength = 0;

        for (const achievement of achievements) {
            totalLength += achievement.length;

            if (this.isQuantified(achievement)) analysis.quantified++;
            if (this.hasStrongVerb(achievement)) analysis.hasStrongVerbs++;
            if (this.hasResult(achievement)) analysis.hasResults++;
        }

        analysis.averageLength = Math.round(totalLength / achievements.length);

        // Calculate score
        analysis.score = Math.round(
            (analysis.quantified / analysis.totalCount) * 40 +
            (analysis.hasStrongVerbs / analysis.totalCount) * 30 +
            (analysis.hasResults / analysis.totalCount) * 30
        );

        // Generate recommendations
        if (analysis.quantified < analysis.totalCount * 0.7) {
            analysis.recommendations.push('Add more quantified metrics to achievements');
        }
        if (analysis.hasStrongVerbs < analysis.totalCount * 0.8) {
            analysis.recommendations.push('Strengthen action verbs in achievements');
        }
        if (analysis.hasResults < analysis.totalCount * 0.6) {
            analysis.recommendations.push('Focus more on results and outcomes');
        }
        if (analysis.averageLength < 60) {
            analysis.recommendations.push('Expand achievements with more detail and context');
        }

        return analysis;
    }

    hasStrongVerb(achievement) {
        const allPowerVerbs = Object.values(this.powerVerbs).flat();
        return allPowerVerbs.some(verb =>
            achievement.toLowerCase().startsWith(verb.toLowerCase())
        );
    }
}

module.exports = AchievementRewriter;
