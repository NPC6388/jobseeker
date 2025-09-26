class JobFilter {
    constructor() {
        this.excludedKeywords = [
            'senior', 'sr.', 'lead', 'manager', 'director', 'executive',
            'full-time', 'fulltime', 'full time',
            'night shift', 'overnight', 'graveyard',
            'weekend only', 'weekends only',
            'travel required', '50% travel', 'extensive travel'
        ];

        this.requiredKeywords = [
            'part-time', 'part time', 'parttime',
            'day shift', 'days', 'morning',
            'flexible', 'flex'
        ];

        this.dayShiftIndicators = [
            'day shift', 'days', 'morning', '9am', '8am', '7am',
            'business hours', 'standard hours', 'regular hours'
        ];
    }

    filterJobs(jobs) {

        const filtered = jobs.filter(job => {
            return this.isPartTimeJob(job) &&
                   this.isDayShiftJob(job) &&
                   this.isNotExcluded(job) &&
                   this.meetsLocationRequirement(job);
        });

        return filtered;
    }

    isPartTimeJob(job) {
        const text = `${job.title} ${job.summary || ''} ${job.description || ''}`.toLowerCase();

        // Check for part-time indicators
        const hasPartTimeKeyword = this.requiredKeywords.some(keyword =>
            text.includes(keyword.toLowerCase())
        );

        // Exclude full-time jobs
        const isFullTime = text.includes('full-time') ||
                          text.includes('fulltime') ||
                          text.includes('full time') ||
                          text.includes('40 hours') ||
                          text.includes('40+ hours');

        return hasPartTimeKeyword && !isFullTime;
    }

    isDayShiftJob(job) {
        const text = `${job.title} ${job.summary || ''} ${job.description || ''}`.toLowerCase();

        // Check for day shift indicators
        const hasDayShiftKeyword = this.dayShiftIndicators.some(indicator =>
            text.includes(indicator.toLowerCase())
        );

        // Exclude night shifts
        const isNightShift = text.includes('night') ||
                           text.includes('overnight') ||
                           text.includes('graveyard') ||
                           text.includes('11pm') ||
                           text.includes('midnight') ||
                           text.includes('3rd shift');

        // If no specific shift mentioned, assume it could be day shift
        const noShiftMentioned = !hasDayShiftKeyword && !isNightShift;

        return (hasDayShiftKeyword || noShiftMentioned) && !isNightShift;
    }

    isNotExcluded(job) {
        const text = `${job.title} ${job.summary || ''} ${job.description || ''}`.toLowerCase();

        return !this.excludedKeywords.some(keyword =>
            text.includes(keyword.toLowerCase())
        );
    }

    meetsLocationRequirement(job) {
        // Basic location filtering - can be enhanced based on specific needs
        const searchRadius = parseInt(process.env.SEARCH_RADIUS) || 25;

        // For now, just ensure job has a location
        // This could be enhanced with distance calculation
        return job.location && job.location.trim() !== '';
    }

    getFilterStats(allJobs, filteredJobs) {
        const stats = {
            total: allJobs.length,
            filtered: filteredJobs.length,
            partTimeFilter: 0,
            dayShiftFilter: 0,
            excludedFilter: 0,
            locationFilter: 0
        };

        allJobs.forEach(job => {
            if (!this.isPartTimeJob(job)) stats.partTimeFilter++;
            if (!this.isDayShiftJob(job)) stats.dayShiftFilter++;
            if (!this.isNotExcluded(job)) stats.excludedFilter++;
            if (!this.meetsLocationRequirement(job)) stats.locationFilter++;
        });

        return stats;
    }

    printFilterReport(allJobs, filteredJobs) {
        const stats = this.getFilterStats(allJobs, filteredJobs);

    }
}

module.exports = JobFilter;