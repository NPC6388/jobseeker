const fs = require('fs-extra');
const path = require('path');
const IndeedScraper = require('./jobBoards/indeed');
const LinkedInScraper = require('./jobBoards/linkedin');
const CraigslistScraper = require('./jobBoards/craigslist');
const ZipRecruiterScraper = require('./jobBoards/ziprecruiter');
const MockJobsScraper = require('./jobBoards/mockjobs');
const ApplicationManager = require('./applicationManager');
const JobFilter = require('./jobFilter');

class JobSeeker {
    constructor() {
        this.indeedScraper = new IndeedScraper();
        this.linkedinScraper = new LinkedInScraper();
        this.craigslistScraper = new CraigslistScraper();
        this.ziprecruiterScraper = new ZipRecruiterScraper();
        this.mockJobsScraper = new MockJobsScraper();
        this.applicationManager = new ApplicationManager();
        this.jobFilter = new JobFilter();
        this.appliedJobs = new Set();
        this.dataDir = path.join(__dirname, '..', 'data');
    }

    async initialize() {

        // Ensure data directory exists
        await fs.ensureDir(this.dataDir);

        // Load previously applied jobs
        await this.loadAppliedJobs();

        // Initialize LinkedIn scraper only if not disabled
        if (process.env.DISABLE_LINKEDIN !== 'true') {
            await this.linkedinScraper.initialize();
        }

    }

    async searchAndApply() {
        const location = process.env.SEARCH_LOCATION;
        const keywords = process.env.KEYWORDS || '';
        const maxApplications = parseInt(process.env.MAX_APPLICATIONS_PER_DAY) || 10;
        const isDryRun = process.env.DRY_RUN === 'true';

        if (!location) {
            throw new Error('SEARCH_LOCATION must be set in .env file');
        }


        try {
            // Search all job boards
            const allJobs = await this.searchAllJobBoards(location, keywords);

            // Filter jobs
            const filteredJobs = this.jobFilter.filterJobs(allJobs);

            // Remove already applied jobs
            const newJobs = filteredJobs.filter(job =>
                !this.appliedJobs.has(this.generateJobHash(job))
            );


            if (newJobs.length === 0) {
                return;
            }

            // Apply to jobs (up to daily limit)
            const jobsToApply = newJobs.slice(0, maxApplications);

            for (const job of jobsToApply) {
                await this.processJobApplication(job, isDryRun);

                // Add delay between applications
                await this.delay(2000);
            }

            // Save applied jobs
            await this.saveAppliedJobs();

        } catch (error) {
            console.error('❌ Error in searchAndApply:', error.message);
        } finally {
            await this.cleanup();
        }
    }

    async searchAllJobBoards(location, keywords) {

        const [indeedJobs, linkedinJobs, craigslistJobs, ziprecruiterJobs, mockJobs] = await Promise.all([
            this.indeedScraper.searchJobs(location, keywords).catch(() => []),
            this.linkedinScraper.searchJobs(location, keywords).catch(() => []),
            this.craigslistScraper.searchJobs(location, keywords).catch(() => []),
            this.ziprecruiterScraper.searchJobs(location, keywords).catch(() => []),
            this.mockJobsScraper.searchJobs(location, keywords).catch(() => [])
        ]);

        return [...indeedJobs, ...linkedinJobs, ...craigslistJobs, ...ziprecruiterJobs, ...mockJobs];
    }

    async processJobApplication(job, isDryRun) {

        if (isDryRun) {
            this.appliedJobs.add(this.generateJobHash(job));
            return;
        }

        try {
            const applied = await this.applicationManager.applyToJob(job);

            if (applied) {
                this.appliedJobs.add(this.generateJobHash(job));

                // Log application
                await this.logApplication(job, 'SUCCESS');
            } else {
                await this.logApplication(job, 'MANUAL_REQUIRED');
            }

        } catch (error) {
            console.error(`   ❌ Application failed: ${error.message}`);
            await this.logApplication(job, 'FAILED', error.message);
        }
    }

    generateJobHash(job) {
        const safeSource = (job.source || 'unknown').toString();
        const safeCompany = (job.company || 'unknown').toString();
        const safeTitle = (job.title || 'unknown').toString();
        return `${safeSource}-${safeCompany}-${safeTitle}`.replace(/\s+/g, '-').toLowerCase();
    }

    async loadAppliedJobs() {
        const appliedJobsFile = path.join(this.dataDir, 'applied-jobs.json');

        try {
            if (await fs.pathExists(appliedJobsFile)) {
                const data = await fs.readJson(appliedJobsFile);
                this.appliedJobs = new Set(data.appliedJobs || []);
            }
        } catch (error) {
            console.warn('⚠️  Could not load applied jobs file:', error.message);
        }
    }

    async saveAppliedJobs() {
        const appliedJobsFile = path.join(this.dataDir, 'applied-jobs.json');

        try {
            await fs.writeJson(appliedJobsFile, {
                appliedJobs: Array.from(this.appliedJobs),
                lastUpdated: new Date().toISOString()
            }, { spaces: 2 });
        } catch (error) {
            console.error('❌ Could not save applied jobs:', error.message);
        }
    }

    async logApplication(job, status, error = null) {
        const logFile = path.join(this.dataDir, 'application-log.json');

        const logEntry = {
            timestamp: new Date().toISOString(),
            job: {
                title: job.title,
                company: job.company,
                location: job.location,
                source: job.source,
                url: job.jobUrl
            },
            status,
            error
        };

        try {
            let logs = [];
            if (await fs.pathExists(logFile)) {
                logs = await fs.readJson(logFile);
            }

            logs.push(logEntry);
            await fs.writeJson(logFile, logs, { spaces: 2 });
        } catch (error) {
            console.error('❌ Could not save application log:', error.message);
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async cleanup() {
        if (process.env.DISABLE_LINKEDIN !== 'true') {
            await this.linkedinScraper.close();
        }
    }
}

module.exports = JobSeeker;