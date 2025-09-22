require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const JobSeeker = require('./jobSeeker');
const ResumeTailor = require('./resumeTailor');
const CoverLetterGenerator = require('./coverLetterGenerator');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Store job search state
let isSearching = false;
let currentJobSeeker = null;
let jobResults = [];
let appliedJobs = [];

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// API Routes
app.get('/api/status', (req, res) => {
    res.json({
        isSearching,
        totalJobs: jobResults.length,
        appliedJobs: appliedJobs.length,
        config: {
            location: process.env.SEARCH_LOCATION,
            keywords: process.env.KEYWORDS,
            searchRadius: process.env.SEARCH_RADIUS || 25,
            maxApplications: process.env.MAX_APPLICATIONS_PER_DAY,
            dryRun: process.env.DRY_RUN === 'true',
            autoSubmit: process.env.AUTO_SUBMIT === 'true'
        }
    });
});

app.get('/api/jobs', (req, res) => {
    res.json(jobResults);
});

app.get('/api/applied', (req, res) => {
    res.json(appliedJobs);
});

app.post('/api/search', async (req, res) => {
    if (isSearching) {
        return res.status(400).json({ error: 'Search already in progress' });
    }

    try {
        isSearching = true;
        jobResults = [];
        appliedJobs = [];

        io.emit('searchStarted');

        // Create a custom JobSeeker that emits events
        currentJobSeeker = new JobSeekerWithEvents();
        await currentJobSeeker.initialize();

        // Start the search in the background
        currentJobSeeker.searchAndApply().then(() => {
            isSearching = false;
            io.emit('searchCompleted');
        }).catch((error) => {
            isSearching = false;
            io.emit('searchError', { error: error.message });
        });

        res.json({ message: 'Search started' });
    } catch (error) {
        isSearching = false;
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/stop', (req, res) => {
    if (currentJobSeeker) {
        currentJobSeeker.stop();
        isSearching = false;
        io.emit('searchStopped');
    }
    res.json({ message: 'Search stopped' });
});

app.post('/api/config', (req, res) => {
    try {
        const { location, keywords, searchRadius, maxApplications, dryRun, autoSubmit } = req.body;

        // Update environment variables
        if (location !== undefined) process.env.SEARCH_LOCATION = location;
        if (keywords !== undefined) process.env.KEYWORDS = keywords;
        if (searchRadius !== undefined) process.env.SEARCH_RADIUS = searchRadius.toString();
        if (maxApplications !== undefined) process.env.MAX_APPLICATIONS_PER_DAY = maxApplications.toString();
        if (typeof dryRun === 'boolean') process.env.DRY_RUN = dryRun.toString();
        if (typeof autoSubmit === 'boolean') process.env.AUTO_SUBMIT = autoSubmit.toString();

        // Update .env file
        updateEnvFile({ location, keywords, searchRadius, maxApplications, dryRun, autoSubmit });

        console.log(`✅ Configuration updated: Location=${location}, Radius=${searchRadius}`);

        res.json({
            message: 'Configuration updated',
            config: {
                location: process.env.SEARCH_LOCATION,
                keywords: process.env.KEYWORDS,
                searchRadius: process.env.SEARCH_RADIUS || 25,
                maxApplications: process.env.MAX_APPLICATIONS_PER_DAY,
                dryRun: process.env.DRY_RUN === 'true',
                autoSubmit: process.env.AUTO_SUBMIT === 'true'
            }
        });
    } catch (error) {
        console.error('Error updating configuration:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/upload-resume', upload.single('resume'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const resumePath = path.join(__dirname, '..', 'matthew-nicholson-resume.docx');
        fs.moveSync(req.file.path, resumePath);

        process.env.RESUME_PATH = './matthew-nicholson-resume.docx';
        updateEnvFile({ resumePath: './matthew-nicholson-resume.docx' });

        res.json({ message: 'Resume uploaded successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/logs', async (req, res) => {
    try {
        const logFile = path.join(__dirname, '..', 'data', 'application-log.json');
        if (await fs.pathExists(logFile)) {
            const logs = await fs.readJson(logFile);
            res.json(logs);
        } else {
            res.json([]);
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/resume-info', async (req, res) => {
    try {
        const resumePath = process.env.RESUME_PATH || './matthew-nicholson-resume.docx';
        const fullPath = path.resolve(resumePath);

        if (await fs.pathExists(fullPath)) {
            const stats = await fs.stat(fullPath);
            const resumeTailor = new ResumeTailor();

            try {
                await resumeTailor.loadBaseResume();
                const resumeData = resumeTailor.baseResume;

                res.json({
                    exists: true,
                    filename: path.basename(fullPath),
                    path: resumePath,
                    size: stats.size,
                    uploadDate: stats.mtime,
                    resumeData: {
                        name: resumeData.personalInfo?.name || 'Not specified',
                        email: resumeData.personalInfo?.email || 'Not specified',
                        phone: resumeData.personalInfo?.phone || 'Not specified',
                        summary: resumeData.professionalSummary || 'No summary available',
                        skillsCount: resumeData.coreCompetencies?.length || 0,
                        experienceCount: resumeData.experience?.length || 0,
                        educationCount: resumeData.education?.length || 0
                    }
                });
            } catch (error) {
                // Resume exists but couldn't parse it
                res.json({
                    exists: true,
                    filename: path.basename(fullPath),
                    path: resumePath,
                    size: stats.size,
                    uploadDate: stats.mtime,
                    error: 'Could not parse resume content'
                });
            }
        } else {
            res.json({
                exists: false,
                path: resumePath
            });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/application-data', async (req, res) => {
    try {
        const ApplicationDataExtractor = require('./applicationDataExtractor');
        const extractor = new ApplicationDataExtractor();

        const comprehensiveData = await extractor.extractComprehensiveData();

        res.json({
            success: true,
            data: comprehensiveData,
            message: 'Comprehensive application data extracted successfully'
        });
    } catch (error) {
        console.error('Error extracting application data:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/generate-applications', async (req, res) => {
    try {
        const { jobs } = req.body;

        if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
            return res.status(400).json({ error: 'No jobs provided' });
        }

        const resumeTailor = new ResumeTailor();
        const coverLetterGenerator = new CoverLetterGenerator();

        await resumeTailor.loadBaseResume();

        const applications = [];

        for (const job of jobs) {
            try {
                // Generate tailored resume
                const tailoredResumeData = await resumeTailor.tailorResumeForJob(job);
                const resumeText = await resumeTailor.generateResumeText(tailoredResumeData);

                // Generate cover letter
                const coverLetterData = coverLetterGenerator.generateCoverLetter(job);

                applications.push({
                    job: job,
                    resume: tailoredResumeData,
                    resumeText: resumeText,
                    coverLetter: coverLetterData
                });

                console.log(`✅ Generated application for ${job.title} at ${job.company}`);

            } catch (error) {
                console.error(`❌ Error generating application for ${job.title}:`, error);
                // Continue with other jobs even if one fails
            }
        }

        res.json({
            applications: applications,
            message: `Generated ${applications.length} applications`
        });

    } catch (error) {
        console.error('Error generating applications:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/submit-applications', async (req, res) => {
    try {
        const { applications } = req.body;

        if (!applications || !Array.isArray(applications) || applications.length === 0) {
            return res.status(400).json({ error: 'No applications provided' });
        }

        let submitted = 0;
        let failed = 0;

        for (const application of applications) {
            try {
                const job = application.job;

                // Use application manager to submit the job application
                if (currentJobSeeker) {
                    const result = await currentJobSeeker.applicationManager.applyToJob(job, {
                        resume: application.resumeText,
                        coverLetter: application.coverLetter.coverLetter
                    });

                    if (result) {
                        submitted++;
                        console.log(`✅ Successfully submitted application for ${job.title} at ${job.company}`);

                        // Log the successful application
                        await currentJobSeeker.logApplication(job, 'SUCCESS');

                        // Add to applied jobs set
                        if (currentJobSeeker.appliedJobs) {
                            currentJobSeeker.appliedJobs.add(currentJobSeeker.generateJobHash(job));
                        }

                        // Emit real-time update
                        io.emit('jobApplied', {
                            job: job,
                            status: 'APPLIED',
                            timestamp: new Date().toISOString()
                        });
                    } else {
                        failed++;
                        console.log(`⚠️ Could not submit application automatically for ${job.title} at ${job.company}`);

                        // Log as manual required
                        await currentJobSeeker.logApplication(job, 'MANUAL_REQUIRED');
                    }
                } else {
                    // Fallback - just log as applied for now
                    console.log(`📝 Application prepared for ${job.title} at ${job.company} (no active job seeker)`);
                    submitted++;
                }

                // Add delay between submissions
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error) {
                failed++;
                console.error(`❌ Error submitting application for ${application.job.title}:`, error);

                if (currentJobSeeker) {
                    await currentJobSeeker.logApplication(application.job, 'FAILED', error.message);
                }
            }
        }

        res.json({
            submitted: submitted,
            failed: failed,
            message: `Submitted ${submitted} applications${failed > 0 ? `, ${failed} failed` : ''}`
        });

    } catch (error) {
        console.error('Error submitting applications:', error);
        res.status(500).json({ error: error.message });
    }
});

// Enhanced JobSeeker class that emits events
class JobSeekerWithEvents extends JobSeeker {
    constructor() {
        super();
        this.shouldStop = false;
    }

    stop() {
        this.shouldStop = true;
    }

    async searchAllJobBoards(location, keywords) {
        if (this.shouldStop) return [];

        io.emit('statusUpdate', { message: 'Searching job boards...' });

        const results = await super.searchAllJobBoards(location, keywords);
        jobResults = results;

        io.emit('jobsFound', { jobs: results, count: results.length });
        return results;
    }

    async processJobApplication(job, isDryRun) {
        if (this.shouldStop) return;

        io.emit('statusUpdate', {
            message: `Processing: ${job.title} at ${job.company}`,
            job: job
        });

        const result = await super.processJobApplication(job, isDryRun);

        if (result || isDryRun) {
            appliedJobs.push({
                ...job,
                appliedAt: new Date().toISOString(),
                status: isDryRun ? 'DRY_RUN' : 'APPLIED'
            });

            io.emit('jobApplied', {
                job: job,
                status: isDryRun ? 'DRY_RUN' : 'APPLIED'
            });
        }

        return result;
    }
}

function updateEnvFile(updates) {
    try {
        const envPath = path.join(__dirname, '..', '.env');
        let envContent = fs.readFileSync(envPath, 'utf8');

        console.log('📝 Updating .env file with:', updates);

        if (updates.location !== undefined) {
            const regex = /^SEARCH_LOCATION=.*$/m;
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `SEARCH_LOCATION=${updates.location}`);
                console.log(`✅ Updated SEARCH_LOCATION to: ${updates.location}`);
            } else {
                envContent += `\nSEARCH_LOCATION=${updates.location}`;
                console.log(`➕ Added SEARCH_LOCATION: ${updates.location}`);
            }
        }
        if (updates.keywords !== undefined) {
            const regex = /^KEYWORDS=.*$/m;
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `KEYWORDS=${updates.keywords}`);
            } else {
                envContent += `\nKEYWORDS=${updates.keywords}`;
            }
        }
        if (updates.searchRadius !== undefined) {
            const regex = /^SEARCH_RADIUS=.*$/m;
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `SEARCH_RADIUS=${updates.searchRadius}`);
                console.log(`✅ Updated SEARCH_RADIUS to: ${updates.searchRadius}`);
            } else {
                envContent += `\nSEARCH_RADIUS=${updates.searchRadius}`;
                console.log(`➕ Added SEARCH_RADIUS: ${updates.searchRadius}`);
            }
        }
        if (updates.maxApplications !== undefined) {
            const regex = /^MAX_APPLICATIONS_PER_DAY=.*$/m;
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `MAX_APPLICATIONS_PER_DAY=${updates.maxApplications}`);
            } else {
                envContent += `\nMAX_APPLICATIONS_PER_DAY=${updates.maxApplications}`;
            }
        }
        if (typeof updates.dryRun === 'boolean') {
            const regex = /^DRY_RUN=.*$/m;
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `DRY_RUN=${updates.dryRun}`);
            } else {
                envContent += `\nDRY_RUN=${updates.dryRun}`;
            }
        }
        if (typeof updates.autoSubmit === 'boolean') {
            const regex = /^AUTO_SUBMIT=.*$/m;
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `AUTO_SUBMIT=${updates.autoSubmit}`);
            } else {
                envContent += `\nAUTO_SUBMIT=${updates.autoSubmit}`;
            }
        }
        if (updates.resumePath !== undefined) {
            const regex = /^RESUME_PATH=.*$/m;
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `RESUME_PATH=${updates.resumePath}`);
            } else {
                envContent += `\nRESUME_PATH=${updates.resumePath}`;
            }
        }

        fs.writeFileSync(envPath, envContent);
        console.log('✅ .env file updated successfully');
    } catch (error) {
        console.error('❌ Error updating .env file:', error);
    }
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected');

    socket.emit('statusUpdate', {
        message: isSearching ? 'Search in progress...' : 'Ready to search jobs'
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌐 JobSeeker Web Interface running at http://localhost:${PORT}`);
    console.log(`📱 Open your browser and navigate to the URL above`);
});

module.exports = app;