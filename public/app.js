// Initialize Socket.IO connection
const socket = io();

// DOM elements
const elements = {
    // Stats
    totalJobs: document.getElementById('totalJobs'),
    appliedJobs: document.getElementById('appliedJobs'),
    searchStatus: document.getElementById('searchStatus'),
    lastSearch: document.getElementById('lastSearch'),
    statusBar: document.getElementById('statusBar'),

    // Form inputs
    location: document.getElementById('location'),
    keywords: document.getElementById('keywords'),
    searchRadius: document.getElementById('searchRadius'),
    maxApplications: document.getElementById('maxApplications'),
    dryRun: document.getElementById('dryRun'),
    autoSubmit: document.getElementById('autoSubmit'),

    // Buttons
    startSearch: document.getElementById('startSearch'),
    stopSearch: document.getElementById('stopSearch'),
    saveConfig: document.getElementById('saveConfig'),

    // File upload
    resumeFile: document.getElementById('resumeFile'),
    uploadArea: document.getElementById('uploadArea'),

    // Lists
    jobList: document.getElementById('jobList'),
    appliedList: document.getElementById('appliedList'),
    logsList: document.getElementById('logsList'),

    // Job selection controls
    selectAllJobs: document.getElementById('selectAllJobs'),
    clearAllJobs: document.getElementById('clearAllJobs'),
    selectedCount: document.getElementById('selectedCount'),
    generateApplications: document.getElementById('generateApplications'),

    // Application review
    applicationsReview: document.getElementById('applicationsReview'),
    applicationsList: document.getElementById('applicationsList'),
    submitApplications: document.getElementById('submitApplications'),
    backToJobs: document.getElementById('backToJobs')
};

// Application state
let currentConfig = {};
let isSearching = false;
let logs = [];
let selectedJobs = new Set();
let generatedApplications = [];
let currentJobs = [];

// Initialize the application
async function init() {
    await loadStatus();
    await loadJobs();
    await loadAppliedJobs();
    await loadResumeInfo();
    await loadLogs();
    setupEventListeners();
    setupFileUpload();
}

// Load current status and configuration
async function loadStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();

        currentConfig = data.config;
        isSearching = data.isSearching;

        // Update form with current config
        elements.location.value = currentConfig.location || '';
        elements.keywords.value = currentConfig.keywords || '';
        elements.searchRadius.value = currentConfig.searchRadius || 25;
        elements.maxApplications.value = currentConfig.maxApplications || 10;
        elements.dryRun.checked = currentConfig.dryRun;
        elements.autoSubmit.checked = currentConfig.autoSubmit;

        // Update stats
        elements.totalJobs.textContent = data.totalJobs;
        elements.appliedJobs.textContent = data.appliedJobs;
        elements.searchStatus.textContent = isSearching ? 'Searching' : 'Ready';

        // Update buttons
        elements.startSearch.disabled = isSearching;
        elements.stopSearch.disabled = !isSearching;

    } catch (error) {
        console.error('Error loading status:', error);
        updateStatusBar('Error loading application status', 'error');
    }
}

// Load job results
async function loadJobs() {
    try {
        const response = await fetch('/api/jobs');
        const jobs = await response.json();
        displayJobs(jobs);
    } catch (error) {
        console.error('Error loading jobs:', error);
    }
}

// Load applied jobs
async function loadAppliedJobs() {
    try {
        const response = await fetch('/api/applied');
        const appliedJobs = await response.json();
        displayAppliedJobs(appliedJobs);
    } catch (error) {
        console.error('Error loading applied jobs:', error);
    }
}

// Load activity logs
async function loadLogs() {
    try {
        const response = await fetch('/api/logs');
        const apiLogs = await response.json();
        displayLogs(apiLogs);
    } catch (error) {
        console.error('Error loading logs:', error);
    }
}

// Display jobs in the job list
function displayJobs(jobs) {
    currentJobs = jobs;
    selectedJobs.clear();
    updateSelectedCount();

    if (jobs.length === 0) {
        elements.jobList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #7f8c8d;">
                No jobs found yet. Start a search to see results.
            </div>
        `;
        document.getElementById('jobActions').style.display = 'none';
        return;
    }

    elements.jobList.innerHTML = jobs.map((job, index) => `
        <div class="job-item" data-job-index="${index}">
            <input type="checkbox" class="job-checkbox" data-job-index="${index}">
            <div class="job-content">
                <div class="job-title">${escapeHtml(job.title)}</div>
                <div class="job-company">${escapeHtml(job.company)}</div>
                <div class="job-location">📍 ${escapeHtml(job.location)}</div>
                <div class="job-meta">
                    <span>${escapeHtml(job.source)}</span>
                    <span>${job.postedDate || 'Recently posted'}</span>
                </div>
                ${job.salary ? `<div style="margin-top: 5px; color: #27ae60; font-weight: 600;">💰 ${escapeHtml(job.salary)}</div>` : ''}
                ${job.summary ? `<div style="margin-top: 8px; color: #6c757d; font-size: 0.9em; line-height: 1.4;">${escapeHtml(job.summary.substring(0, 150))}${job.summary.length > 150 ? '...' : ''}</div>` : ''}
            </div>
        </div>
    `).join('');

    // Show job actions
    document.getElementById('jobActions').style.display = 'block';

    // Add event listeners for checkboxes
    addJobCheckboxListeners();
}

// Display applied jobs
function displayAppliedJobs(appliedJobs) {
    if (appliedJobs.length === 0) {
        elements.appliedList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #7f8c8d;">
                No applications yet.
            </div>
        `;
        return;
    }

    elements.appliedList.innerHTML = appliedJobs.map(job => `
        <div class="job-item">
            <div class="job-title">${escapeHtml(job.title)}</div>
            <div class="job-company">${escapeHtml(job.company)}</div>
            <div class="job-location">📍 ${escapeHtml(job.location)}</div>
            <div class="job-meta">
                <span>${escapeHtml(job.source)}</span>
                <span class="job-status status-${String(job.status || 'unknown').toLowerCase().replace('_', '-')}">${job.status || 'Unknown'}</span>
            </div>
            <div style="margin-top: 5px; color: #7f8c8d; font-size: 0.8em;">
                🕒 Applied: ${new Date(job.appliedAt).toLocaleString()}
            </div>
        </div>
    `).join('');
}

// Display activity logs
function displayLogs(apiLogs) {
    // Combine API logs with real-time logs
    const allLogs = [...apiLogs.map(log => ({
        timestamp: log.timestamp,
        message: `${log.status}: ${log.job.title} at ${log.job.company}`,
        type: log.status === 'SUCCESS' ? 'success' : log.status === 'FAILED' ? 'error' : 'info'
    })), ...logs];

    if (allLogs.length === 0) {
        elements.logsList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #7f8c8d;">
                Activity logs will appear here.
            </div>
        `;
        return;
    }

    // Sort by timestamp (newest first)
    allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    elements.logsList.innerHTML = allLogs.slice(0, 50).map(log => `
        <div class="log-entry ${log.type}">
            <div class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</div>
            <div>${escapeHtml(log.message)}</div>
        </div>
    `).join('');
}

// Update status bar
function updateStatusBar(message, type = 'info') {
    elements.statusBar.textContent = message;
    elements.statusBar.className = `status-bar ${type}`;
}

// Add log entry
function addLog(message, type = 'info') {
    const log = {
        timestamp: new Date().toISOString(),
        message,
        type
    };
    logs.unshift(log);

    // Keep only last 100 logs in memory
    if (logs.length > 100) {
        logs = logs.slice(0, 100);
    }

    displayLogs([]);
}

// Setup event listeners
function setupEventListeners() {
    // Start search button
    elements.startSearch.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/search', { method: 'POST' });
            const data = await response.json();

            if (response.ok) {
                isSearching = true;
                elements.startSearch.disabled = true;
                elements.stopSearch.disabled = false;
                elements.searchStatus.textContent = 'Searching';
                elements.lastSearch.textContent = new Date().toLocaleString();
                updateStatusBar('Search started...', 'info');
                addLog('Job search started', 'info');
            } else {
                updateStatusBar(data.error, 'error');
                addLog(`Error starting search: ${data.error}`, 'error');
            }
        } catch (error) {
            updateStatusBar('Failed to start search', 'error');
            addLog(`Failed to start search: ${error.message}`, 'error');
        }
    });

    // Stop search button
    elements.stopSearch.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/stop', { method: 'POST' });
            const data = await response.json();

            if (response.ok) {
                isSearching = false;
                elements.startSearch.disabled = false;
                elements.stopSearch.disabled = true;
                elements.searchStatus.textContent = 'Stopped';
                updateStatusBar('Search stopped', 'info');
                addLog('Job search stopped', 'info');
            }
        } catch (error) {
            updateStatusBar('Failed to stop search', 'error');
            addLog(`Failed to stop search: ${error.message}`, 'error');
        }
    });

    // Save configuration button
    elements.saveConfig.addEventListener('click', async () => {
        const config = {
            location: elements.location.value,
            keywords: elements.keywords.value,
            searchRadius: parseInt(elements.searchRadius.value),
            maxApplications: parseInt(elements.maxApplications.value),
            dryRun: elements.dryRun.checked,
            autoSubmit: elements.autoSubmit.checked
        };

        try {
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            const data = await response.json();

            if (response.ok) {
                currentConfig = config;
                updateStatusBar('Configuration saved successfully', 'success');
                addLog('Configuration updated', 'success');
            } else {
                updateStatusBar(data.error, 'error');
                addLog(`Error saving config: ${data.error}`, 'error');
            }
        } catch (error) {
            updateStatusBar('Failed to save configuration', 'error');
            addLog(`Failed to save config: ${error.message}`, 'error');
        }
    });

    // Resume improvement tool buttons
    const analyzeResumeButton = document.getElementById('analyzeResume');
    if (analyzeResumeButton) {
        analyzeResumeButton.addEventListener('click', analyzeResume);
    }

    const generateImprovedButton = document.getElementById('generateImprovedResume');
    if (generateImprovedButton) {
        generateImprovedButton.addEventListener('click', generateImprovedResume);
    }

    const downloadOriginalButton = document.getElementById('downloadOriginal');
    if (downloadOriginalButton) {
        downloadOriginalButton.addEventListener('click', downloadOriginalResume);
    }
}

// Setup file upload functionality
function setupFileUpload() {
    const uploadArea = elements.uploadArea;
    const fileInput = elements.resumeFile;

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            fileInput.files = files;
            handleFileUploadWithResumeInfo(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFileUploadWithResumeInfo(e.target.files[0]);
        }
    });
}

// Handle file upload
async function handleFileUpload(file) {
    const formData = new FormData();
    formData.append('resume', file);

    try {
        updateStatusBar('Uploading resume...', 'info');

        const response = await fetch('/api/upload-resume', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            updateStatusBar('Resume uploaded successfully', 'success');
            addLog(`Resume uploaded: ${file.name}`, 'success');
            elements.uploadArea.innerHTML = `
                <p>✅ Resume uploaded: ${file.name}</p>
                <p style="font-size: 0.9em; color: #7f8c8d;">Click to upload a different file</p>
            `;
        } else {
            updateStatusBar(data.error, 'error');
            addLog(`Resume upload failed: ${data.error}`, 'error');
        }
    } catch (error) {
        updateStatusBar('Resume upload failed', 'error');
        addLog(`Resume upload failed: ${error.message}`, 'error');
    }
}

// Socket.IO event handlers
socket.on('connect', () => {
    addLog('Connected to JobSeeker server', 'success');
});

socket.on('disconnect', () => {
    addLog('Disconnected from server', 'error');
});

socket.on('searchStarted', () => {
    isSearching = true;
    elements.startSearch.disabled = true;
    elements.stopSearch.disabled = false;
    elements.searchStatus.textContent = 'Searching';
    updateStatusBar('Job search started...', 'info');
    addLog('Job search started', 'info');
});

socket.on('searchCompleted', () => {
    isSearching = false;
    elements.startSearch.disabled = false;
    elements.stopSearch.disabled = true;
    elements.searchStatus.textContent = 'Completed';
    updateStatusBar('Job search completed', 'success');
    addLog('Job search completed', 'success');
    loadJobs();
    loadAppliedJobs();
});

socket.on('searchStopped', () => {
    isSearching = false;
    elements.startSearch.disabled = false;
    elements.stopSearch.disabled = true;
    elements.searchStatus.textContent = 'Stopped';
    updateStatusBar('Job search stopped', 'info');
    addLog('Job search stopped', 'info');
});

socket.on('searchError', (data) => {
    isSearching = false;
    elements.startSearch.disabled = false;
    elements.stopSearch.disabled = true;
    elements.searchStatus.textContent = 'Error';
    updateStatusBar(`Search error: ${data.error}`, 'error');
    addLog(`Search error: ${data.error}`, 'error');
});

socket.on('statusUpdate', (data) => {
    updateStatusBar(data.message, 'info');
    addLog(data.message, 'info');
});

socket.on('jobsFound', (data) => {
    elements.totalJobs.textContent = data.count;
    displayJobs(data.jobs);
    addLog(`Found ${data.count} jobs`, 'success');
});

socket.on('jobApplied', (data) => {
    const currentApplied = parseInt(elements.appliedJobs.textContent);
    elements.appliedJobs.textContent = currentApplied + 1;

    addLog(`Applied to: ${data.job.title} at ${data.job.company} (${data.status})`, 'success');
    loadAppliedJobs();
});

// Utility function to escape HTML
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Auto-refresh data every 30 seconds
setInterval(() => {
    if (!isSearching) {
        loadStatus();
    }
}, 30000);

// Job selection functionality
function addJobCheckboxListeners() {
    const checkboxes = document.querySelectorAll('.job-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const jobIndex = parseInt(e.target.dataset.jobIndex);
            const jobItem = e.target.closest('.job-item');

            if (e.target.checked) {
                selectedJobs.add(jobIndex);
                jobItem.classList.add('selected');
            } else {
                selectedJobs.delete(jobIndex);
                jobItem.classList.remove('selected');
            }
            updateSelectedCount();
        });
    });

    // Add job selection controls event listeners
    elements.selectAllJobs.addEventListener('click', () => {
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            const jobIndex = parseInt(checkbox.dataset.jobIndex);
            selectedJobs.add(jobIndex);
            checkbox.closest('.job-item').classList.add('selected');
        });
        updateSelectedCount();
    });

    elements.clearAllJobs.addEventListener('click', () => {
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
            const jobIndex = parseInt(checkbox.dataset.jobIndex);
            selectedJobs.delete(jobIndex);
            checkbox.closest('.job-item').classList.remove('selected');
        });
        updateSelectedCount();
    });

    elements.generateApplications.addEventListener('click', async () => {
        if (selectedJobs.size === 0) {
            updateStatusBar('Please select at least one job', 'error');
            return;
        }

        const selectedJobsArray = Array.from(selectedJobs).map(index => currentJobs[index]);

        updateStatusBar('Generating tailored applications...', 'info');
        addLog(`Generating applications for ${selectedJobs.size} jobs`, 'info');

        try {
            const response = await fetch('/api/generate-applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobs: selectedJobsArray })
            });

            const data = await response.json();

            if (response.ok) {
                generatedApplications = data.applications;
                showApplicationsReview();
                updateStatusBar('Applications generated successfully', 'success');
                addLog(`Generated ${generatedApplications.length} tailored applications`, 'success');
            } else {
                updateStatusBar(data.error || 'Failed to generate applications', 'error');
                addLog(`Error generating applications: ${data.error}`, 'error');
            }
        } catch (error) {
            updateStatusBar('Failed to generate applications', 'error');
            addLog(`Error generating applications: ${error.message}`, 'error');
        }
    });

    // Submit applications button
    elements.submitApplications.addEventListener('click', async () => {
        const approvedApplications = [];

        // Check which applications are approved
        generatedApplications.forEach((app, index) => {
            const checkbox = document.getElementById(`approve-${index}`);
            if (checkbox && checkbox.checked) {
                approvedApplications.push(app);
            }
        });

        if (approvedApplications.length === 0) {
            updateStatusBar('Please approve at least one application', 'error');
            return;
        }

        // Confirm before submitting
        if (!confirm(`Are you sure you want to submit ${approvedApplications.length} job application${approvedApplications.length !== 1 ? 's' : ''}?`)) {
            return;
        }

        updateStatusBar('Submitting applications...', 'info');
        addLog(`Submitting ${approvedApplications.length} applications`, 'info');

        try {
            const response = await fetch('/api/submit-applications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ applications: approvedApplications })
            });

            const data = await response.json();

            if (response.ok) {
                updateStatusBar(`Successfully submitted ${data.submitted || approvedApplications.length} applications`, 'success');
                addLog(`Successfully submitted ${data.submitted || approvedApplications.length} applications`, 'success');

                // Clear the generated applications and go back to job selection
                generatedApplications = [];
                selectedJobs.clear();
                showJobSelection();
                updateSelectedCount();

                // Refresh the applied jobs list
                loadAppliedJobs();
            } else {
                updateStatusBar(data.error || 'Failed to submit applications', 'error');
                addLog(`Error submitting applications: ${data.error}`, 'error');
            }
        } catch (error) {
            updateStatusBar('Failed to submit applications', 'error');
            addLog(`Error submitting applications: ${error.message}`, 'error');
        }
    });
}

function updateSelectedCount() {
    const count = selectedJobs.size;
    elements.selectedCount.textContent = `${count} job${count !== 1 ? 's' : ''} selected`;
    elements.generateApplications.disabled = count === 0;
}

function showApplicationsReview() {
    // Hide job selection panels
    document.querySelector('.panel:has(#jobList)').style.display = 'none';
    document.querySelector('.panel:has(#appliedList)').style.display = 'none';

    // Show applications review panel
    elements.applicationsReview.style.display = 'block';

    displayGeneratedApplications();
}

function showJobSelection() {
    // Show job selection panels
    document.querySelector('.panel:has(#jobList)').style.display = 'block';
    document.querySelector('.panel:has(#appliedList)').style.display = 'block';

    // Hide applications review panel
    elements.applicationsReview.style.display = 'none';
}

function displayGeneratedApplications() {
    if (generatedApplications.length === 0) {
        elements.applicationsList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #7f8c8d;">
                No applications generated yet.
            </div>
        `;
        return;
    }

    elements.applicationsList.innerHTML = generatedApplications.map((app, index) => {
        const atsScore = app.atsScore || { totalScore: 0, grade: { letter: 'N/A', label: 'Unknown', color: '#95a5a6' }, keywordMatchRate: 0 };
        return `
        <div class="application-preview">
            <div class="application-header">
                <div>
                    <h3 style="margin: 0; color: #2c3e50;">${escapeHtml(app.job.title)}</h3>
                    <p style="margin: 5px 0 0 0; color: #7f8c8d;">${escapeHtml(app.job.company)} • ${escapeHtml(app.job.location)}</p>
                </div>
                <div class="ats-score">
                    <div style="text-align: right;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-size: 0.9em; color: #7f8c8d;">ATS Score:</span>
                            <span class="score-badge ${getScoreClass(atsScore.totalScore)}" style="background-color: ${atsScore.grade.color}20; color: ${atsScore.grade.color}; border: 2px solid ${atsScore.grade.color};">
                                ${atsScore.grade.letter} (${atsScore.totalScore}%)
                            </span>
                        </div>
                        <div style="font-size: 0.75em; color: #95a5a6;">
                            ${atsScore.grade.label} • Keywords: ${atsScore.keywordMatchRate}%
                        </div>
                    </div>
                </div>
            </div>

            <div class="tailoring-notes">
                <strong>📊 ATS Analysis:</strong>
                <ul style="margin: 5px 0 0 20px; font-size: 0.9em;">
                    ${atsScore.strengths && atsScore.strengths.length > 0 ? atsScore.strengths.slice(0, 3).map(s => `<li style="color: #27ae60;">${escapeHtml(s)}</li>`).join('') : '<li>Analysis in progress...</li>'}
                </ul>
                ${atsScore.weaknesses && atsScore.weaknesses.length > 0 ? `
                <strong style="margin-top: 8px; display: block;">⚠️ Areas to Improve:</strong>
                <ul style="margin: 5px 0 0 20px; font-size: 0.9em;">
                    ${atsScore.weaknesses.slice(0, 2).map(w => `<li style="color: #e67e22;">${escapeHtml(w)}</li>`).join('')}
                </ul>
                ` : ''}
            </div>

            ${app.resumeReview && app.resumeReview.qualityScore ? `
            <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin: 10px 0; font-size: 0.85em;">
                <strong>✨ Resume Quality: ${app.resumeReview.qualityScore}%</strong>
                ${app.resumeReview.editorNotes ? `<p style="margin: 5px 0 0 0; color: #7f8c8d;">${escapeHtml(app.resumeReview.editorNotes)}</p>` : ''}
            </div>
            ` : ''}

            <div class="application-content">
                <div>
                    <h4 style="margin: 0 0 10px 0; color: #2c3e50;">
                        📄 Tailored Resume
                        <a href="/api/download-tailored-resume/${index}" target="_blank" style="margin-left: 10px; color: #3498db; text-decoration: none; font-size: 0.85em;">📥 Open PDF</a>
                    </h4>
                    <div class="resume-preview">
                        <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; font-size: 0.85em; line-height: 1.4;">${escapeHtml((app.resumeText || 'Resume content not available').substring(0, 1000))}${(app.resumeText || '').length > 1000 ? '...\n\n[Resume continues...]' : ''}</pre>
                    </div>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px 0; color: #2c3e50;">
                        ✉️ Cover Letter
                        <a href="/api/download-tailored-coverletter/${index}" target="_blank" style="margin-left: 10px; color: #3498db; text-decoration: none; font-size: 0.85em;">📥 Open PDF</a>
                    </h4>
                    <div class="cover-letter-preview">
                        <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; font-size: 0.85em; line-height: 1.4;">${escapeHtml(app.coverLetter?.coverLetter || app.coverLetter || 'Cover letter not available')}</pre>
                    </div>
                </div>
            </div>

            <div style="text-align: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e9ecef;">
                <input type="checkbox" id="approve-${index}" style="margin-right: 8px;" checked>
                <label for="approve-${index}" style="font-weight: 600; color: #2c3e50;">Approve this application for submission</label>
            </div>
        </div>
    `;
    }).join('');

    // Show submit actions
    document.getElementById('submitActions').style.display = 'block';

    // Add back to jobs button listener
    elements.backToJobs.addEventListener('click', showJobSelection);
}

function getScoreClass(score) {
    if (score >= 80) return 'score-high';
    if (score >= 60) return 'score-medium';
    return 'score-low';
}

// Load resume information
async function loadResumeInfo() {
    try {
        const response = await fetch('/api/resume-info');
        const data = await response.json();

        const resumeInfoElement = document.getElementById('resumeInfo');

        if (data.exists) {
            // Show resume info
            document.getElementById('resumeFilename').textContent = data.filename;
            document.getElementById('resumeUploadDate').textContent = new Date(data.uploadDate).toLocaleString();
            document.getElementById('resumeSize').textContent = formatFileSize(data.size);

            if (data.resumeData) {
                document.getElementById('resumeName').textContent = data.resumeData.name;
                document.getElementById('resumeEmail').textContent = data.resumeData.email;
                document.getElementById('resumePhone').textContent = data.resumeData.phone;
                document.getElementById('resumeSummary').textContent = data.resumeData.summary.substring(0, 150) + (data.resumeData.summary.length > 150 ? '...' : '');
                document.getElementById('resumeSkillsCount').textContent = data.resumeData.skillsCount;
                document.getElementById('resumeExperienceCount').textContent = data.resumeData.experienceCount;
                document.getElementById('resumeEducationCount').textContent = data.resumeData.educationCount;

                // Update upload area to show success
                elements.uploadArea.innerHTML = `
                    <p style="color: #28a745;">✅ Resume loaded: ${data.filename}</p>
                    <p style="font-size: 0.9em; color: #7f8c8d;">Click to upload a different file</p>
                `;
            } else if (data.error) {
                document.getElementById('resumeDetails').innerHTML = `
                    <div style="color: #e74c3c; text-align: center; padding: 10px;">
                        ⚠️ ${data.error}
                    </div>
                `;
            }

            resumeInfoElement.style.display = 'block';
        } else {
            resumeInfoElement.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading resume info:', error);
    }
}

// Format file size for display
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Update the handleFileUpload function to refresh resume info
async function handleFileUploadWithResumeInfo(file) {
    await handleFileUpload(file);
    // Reload resume info after upload
    setTimeout(loadResumeInfo, 1000);
}

// Resume Improvement Tool Functions
async function analyzeResume() {
    const analyzeButton = document.getElementById('analyzeResume');
    const targetJobDescription = document.getElementById('targetJobDescription').value;
    const resultsDiv = document.getElementById('resumeAnalysisResults');

    // Update UI to show loading state
    analyzeButton.textContent = '🔄 Analyzing...';
    analyzeButton.disabled = true;

    try {
        const response = await fetch('/api/analyze-resume', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                targetJobDescription: targetJobDescription || ''
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to analyze resume');
        }

        const data = await response.json();
        displayAnalysisResults(data);
        resultsDiv.style.display = 'block';

    } catch (error) {
        console.error('Resume analysis error:', error);
        alert(`Error analyzing resume: ${error.message}`);
    } finally {
        analyzeButton.textContent = '🔍 Analyze Resume';
        analyzeButton.disabled = false;
    }
}

function displayAnalysisResults(data) {
    const { analysis, improvements, suggestions } = data;
    // Update score display
    document.getElementById('resumeScore').textContent = `${Math.round(analysis.score)}/100`;
    const scoreBar = document.getElementById('scoreBar');
    scoreBar.style.width = `${analysis.score}%`;

    // Update collapsed analysis results preview
    const analysisScorePreview = document.getElementById('analysisScorePreview');
    if (analysisScorePreview) {
        analysisScorePreview.textContent = `(Score: ${Math.round(analysis.score)}/100)`;
    }

    // Update score description
    const scoreDescription = document.getElementById('scoreDescription');
    if (analysis.score >= 80) {
        scoreDescription.textContent = 'Excellent! Your resume follows most best practices.';
        scoreDescription.style.color = '#27ae60';
    } else if (analysis.score >= 60) {
        scoreDescription.textContent = 'Good resume with room for improvement.';
        scoreDescription.style.color = '#f39c12';
    } else {
        scoreDescription.textContent = 'Significant improvements needed for ATS optimization.';
        scoreDescription.style.color = '#e74c3c';
    }

    // Display issues
    const issuesList = document.getElementById('resumeIssues');
    issuesList.innerHTML = '';
    if (analysis.issues.length > 0) {
        analysis.issues.forEach(issue => {
            const li = document.createElement('li');
            li.textContent = issue;
            li.style.marginBottom = '8px';
            li.style.padding = '8px';
            li.style.background = '#fff5f5';
            li.style.borderLeft = '3px solid #e74c3c';
            li.style.borderRadius = '3px';
            issuesList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = 'No major issues found! 🎉';
        li.style.color = '#27ae60';
        issuesList.appendChild(li);
    }

    // Display strengths
    const strengthsList = document.getElementById('resumeStrengths');
    strengthsList.innerHTML = '';
    if (analysis.strengths.length > 0) {
        analysis.strengths.forEach(strength => {
            const li = document.createElement('li');
            li.textContent = strength;
            li.style.marginBottom = '8px';
            li.style.padding = '8px';
            li.style.background = '#f0fff4';
            li.style.borderLeft = '3px solid #27ae60';
            li.style.borderRadius = '3px';
            strengthsList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = 'Run analysis to identify strengths';
        strengthsList.appendChild(li);
    }

    // Display recommendations (collapsed by default)
    const recommendationsList = document.getElementById('resumeRecommendations');
    const recommendationsCount = document.getElementById('recommendationsCount');

    recommendationsList.innerHTML = '';
    if (analysis.recommendations.length > 0) {
        // Update count display
        recommendationsCount.textContent = `(${analysis.recommendations.length})`;

        analysis.recommendations.forEach(recommendation => {
            const li = document.createElement('li');
            li.textContent = recommendation;
            li.style.marginBottom = '8px';
            li.style.padding = '8px';
            li.style.background = '#f0f8ff';
            li.style.borderLeft = '3px solid #3498db';
            li.style.borderRadius = '3px';
            li.style.fontSize = '13px';
            li.style.lineHeight = '1.4';
            recommendationsList.appendChild(li);
        });
    } else {
        recommendationsCount.textContent = '(0)';
        const li = document.createElement('li');
        li.textContent = 'No specific recommendations available.';
        recommendationsList.appendChild(li);
    }

    // Ensure recommendations stay collapsed after update
    recommendationsList.style.display = 'none';
    document.getElementById('recommendationsToggle').textContent = '▶';

    // Display keyword analysis if available
    if (analysis.keywordAnalysis && Object.keys(analysis.keywordAnalysis).length > 0) {
        const keywordDiv = document.getElementById('keywordAnalysis');
        keywordDiv.style.display = 'block';

        const matchingKeywords = document.getElementById('matchingKeywords');
        const missingKeywords = document.getElementById('missingKeywords');

        if (analysis.keywordAnalysis.matchingKeywords && analysis.keywordAnalysis.matchingKeywords.length > 0) {
            matchingKeywords.innerHTML = analysis.keywordAnalysis.matchingKeywords.slice(0, 10).map(keyword =>
                `<span style="background: #d4edda; padding: 2px 6px; border-radius: 3px; margin: 2px; display: inline-block;">${keyword}</span>`
            ).join('');
        } else {
            matchingKeywords.textContent = 'No job description provided';
        }

        if (analysis.keywordAnalysis.missingKeywords && analysis.keywordAnalysis.missingKeywords.length > 0) {
            missingKeywords.innerHTML = analysis.keywordAnalysis.missingKeywords.slice(0, 10).map(keyword =>
                `<span style="background: #f8d7da; padding: 2px 6px; border-radius: 3px; margin: 2px; display: inline-block;">${keyword}</span>`
            ).join('');
        } else {
            missingKeywords.textContent = 'All important keywords found!';
        }
    }

    // Scroll to results
    document.getElementById('resumeAnalysisResults').scrollIntoView({ behavior: 'smooth' });
}

// Generate improved resume function
async function generateImprovedResume() {
    const generateButton = document.getElementById('generateImprovedResume');
    const targetJobDescription = document.getElementById('targetJobDescription').value;

    generateButton.textContent = '⏳ Generating...';
    generateButton.disabled = true;

    try {
        const response = await fetch('/api/generate-improved-resume', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                targetJobDescription: targetJobDescription || ''
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to generate improved resume');
        }

        const data = await response.json();

        // Show download options for formatted documents
        if (data.documents) {
            showDownloadModal(data);
        } else {
            // Fallback to text file if documents weren't generated
            const blob = new Blob([data.improvedResumeText], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'improved-resume.txt';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            const alertMessage = data.scoreImproved ?
                `Improved resume generated! Score improved from ${data.originalScore} to ${data.improvedScore}/100` :
                `Resume generated! Note: ${data.scoreNote}`;
            alert(alertMessage);
        }

    } catch (error) {
        console.error('Generate improved resume error:', error);
        alert(`Error generating improved resume: ${error.message}`);
    } finally {
        generateButton.textContent = '✨ Generate Improved Resume';
        generateButton.disabled = false;
    }
}

// Download original resume function
async function downloadOriginalResume() {
    try {
        const response = await fetch('/api/download-original-resume');

        if (!response.ok) {
            throw new Error('Failed to download original resume');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'original-resume.docx';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error('Download original resume error:', error);
        alert(`Error downloading original resume: ${error.message}`);
    }
}

// Show download modal with Word and PDF buttons
function showDownloadModal(data) {
    // Create modal backdrop
    const modalBackdrop = document.createElement('div');
    modalBackdrop.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;

    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        padding: 30px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        text-align: center;
        max-width: 500px;
        width: 90%;
    `;

    const modalTitle = data.scoreImproved ? '✅ Resume Generated Successfully!' : '📄 Resume Generated';
    const scoreText = data.scoreImproved ?
        `Score improved from <strong>${Math.round(data.originalScore)}</strong> to <strong>${Math.round(data.improvedScore)}/100</strong>` :
        `<strong>Score Note:</strong> ${data.scoreNote}`;

    modal.innerHTML = `
        <h3 style="margin: 0 0 15px 0; color: #2c3e50;">${modalTitle}</h3>
        <p style="margin: 0 0 20px 0; color: #7f8c8d; line-height: 1.4;">
            ${scoreText}
        </p>
        <p style="margin: 0 0 25px 0; color: #2c3e50; font-weight: 500;">
            Choose your preferred download format:
        </p>
        <div style="display: flex; gap: 15px; justify-content: center;">
            <button id="downloadWord" style="
                background: #007bff;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
            ">📄 Word</button>
            <button id="downloadPdf" style="
                background: #dc3545;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: background-color 0.2s;
            ">📋 PDF</button>
        </div>
        <p style="margin: 20px 0 0 0; color: #6c757d; font-size: 14px;">
            You can download both formats if needed
        </p>
    `;

    modalBackdrop.appendChild(modal);
    document.body.appendChild(modalBackdrop);

    // Add button event listeners
    const wordButton = modal.querySelector('#downloadWord');
    const pdfButton = modal.querySelector('#downloadPdf');

    wordButton.addEventListener('click', () => {
        downloadFile(data.documents.word, 'improved-resume.docx');
        closeModal();
    });

    pdfButton.addEventListener('click', () => {
        downloadFile(data.documents.pdf, 'improved-resume.pdf');
        closeModal();
    });

    // Add hover effects
    wordButton.addEventListener('mouseenter', () => {
        wordButton.style.backgroundColor = '#0056b3';
    });
    wordButton.addEventListener('mouseleave', () => {
        wordButton.style.backgroundColor = '#007bff';
    });

    pdfButton.addEventListener('mouseenter', () => {
        pdfButton.style.backgroundColor = '#c82333';
    });
    pdfButton.addEventListener('mouseleave', () => {
        pdfButton.style.backgroundColor = '#dc3545';
    });

    // Close modal when clicking backdrop
    modalBackdrop.addEventListener('click', (e) => {
        if (e.target === modalBackdrop) {
            closeModal();
        }
    });

    // Close modal function
    function closeModal() {
        document.body.removeChild(modalBackdrop);
    }

    // ESC key to close modal
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
}

// Download file helper function
function downloadFile(filename, downloadName) {
    const downloadUrl = `/api/download-improved-resume/${filename}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Toggle recommendations visibility
function toggleRecommendations() {
    const recommendationsList = document.getElementById('resumeRecommendations');
    const toggle = document.getElementById('recommendationsToggle');

    if (recommendationsList.style.display === 'none' || recommendationsList.style.display === '') {
        recommendationsList.style.display = 'block';
        toggle.textContent = '▼';
    } else {
        recommendationsList.style.display = 'none';
        toggle.textContent = '▶';
    }
}

// Toggle analysis results visibility
function toggleAnalysisResults() {
    const analysisContent = document.getElementById('analysisContent');
    const toggle = document.getElementById('analysisToggle');

    if (analysisContent.style.display === 'none' || analysisContent.style.display === '') {
        analysisContent.style.display = 'block';
        toggle.textContent = '▼';
    } else {
        analysisContent.style.display = 'none';
        toggle.textContent = '▶';
    }
}

// Smart Automation Mode Handlers
let autoModeEnabled = false;

function setupLinkedInHandlers() {
    const linkedinLoginBtn = document.getElementById('linkedinLoginBtn');
    const linkedinModal = document.getElementById('linkedinModal');
    const closeModal = document.getElementById('closeLinkedinModal');
    const loginForm = document.getElementById('linkedinLoginForm');

    if (linkedinLoginBtn) {
        linkedinLoginBtn.addEventListener('click', () => {
            linkedinModal.style.display = 'block';
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => {
            linkedinModal.style.display = 'none';
        });
    }

    // Close on backdrop click
    if (linkedinModal) {
        linkedinModal.addEventListener('click', (e) => {
            if (e.target === linkedinModal) {
                linkedinModal.style.display = 'none';
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('linkedinEmail').value;
            const password = document.getElementById('linkedinPassword').value;

            try {
                updateStatusBar('Logging into LinkedIn...', 'info');

                const response = await fetch('/api/linkedin-credentials', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok) {
                    linkedinModal.style.display = 'none';
                    updateStatusBar('✓ LinkedIn credentials saved', 'success');
                    addLog('LinkedIn login successful', 'success');

                    // Update button to show logged in state
                    linkedinLoginBtn.innerHTML = `
                        <svg style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;" viewBox="0 0 24 24" fill="white">
                            <path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"></path>
                        </svg>
                        ✓ LinkedIn Connected
                    `;
                    linkedinLoginBtn.style.background = '#27ae60';

                    // Clear form
                    loginForm.reset();
                } else {
                    updateStatusBar(data.error || 'Failed to save credentials', 'error');
                }
            } catch (error) {
                updateStatusBar('Failed to save LinkedIn credentials', 'error');
                console.error('LinkedIn login error:', error);
            }
        });
    }
}

function setupAutomationHandlers() {
    const autoModeToggle = document.getElementById('autoModeToggle');
    const autoModeStatus = document.getElementById('autoModeStatus');
    const autoModeStatusText = document.getElementById('autoModeStatusText');
    const continueButton = document.getElementById('continueApplication');
    const dismissButton = document.getElementById('dismissNotification');

    if (autoModeToggle) {
        autoModeToggle.addEventListener('change', async () => {
            try {
                const response = await fetch('/api/toggle-auto-mode', {
                    method: 'POST'
                });
                const data = await response.json();
                autoModeEnabled = data.enabled;

                autoModeStatus.style.display = 'block';
                autoModeStatusText.textContent = autoModeEnabled
                    ? '✓ Full Auto Mode Enabled - System will handle applications automatically'
                    : '✗ Auto Mode Disabled - Manual review required for each application';
                autoModeStatusText.style.color = autoModeEnabled ? '#27ae60' : '#e74c3c';

                addLog(`Auto mode ${autoModeEnabled ? 'enabled' : 'disabled'}`, autoModeEnabled ? 'success' : 'info');
            } catch (error) {
                console.error('Error toggling auto mode:', error);
                updateStatusBar('Failed to toggle auto mode', 'error');
            }
        });
    }

    if (continueButton) {
        continueButton.addEventListener('click', async () => {
            try {
                const response = await fetch('/api/smart-resume', {
                    method: 'POST'
                });

                if (response.ok) {
                    hideNotificationPanel();
                    updateStatusBar('Application resumed', 'success');
                    addLog('User resumed application after manual input', 'info');
                } else {
                    updateStatusBar('Failed to resume application', 'error');
                }
            } catch (error) {
                console.error('Error resuming application:', error);
                updateStatusBar('Failed to resume application', 'error');
            }
        });
    }

    if (dismissButton) {
        dismissButton.addEventListener('click', () => {
            hideNotificationPanel();
        });
    }
}

function showNotificationPanel(data) {
    const panel = document.getElementById('notificationPanel');
    const message = document.getElementById('notificationMessage');
    const fieldsList = document.getElementById('fieldsList');

    message.textContent = data.message || 'Manual input required for this application';

    // Populate fields list
    fieldsList.innerHTML = '';
    if (data.fields && data.fields.length > 0) {
        data.fields.forEach(field => {
            const li = document.createElement('li');
            li.textContent = field.field?.label || field.field?.name || 'Unknown field';
            li.style.marginBottom = '5px';
            fieldsList.appendChild(li);
        });
    }

    panel.style.display = 'block';
    panel.style.animation = 'slideIn 0.3s ease-out';

    // Play notification sound (optional)
    playNotificationSound();

    // Scroll to notification
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideNotificationPanel() {
    const panel = document.getElementById('notificationPanel');
    panel.style.display = 'none';
}

function playNotificationSound() {
    // Create a simple beep using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        // Silently fail if Web Audio API is not supported
    }
}

// Socket listeners for smart application handler
socket.on('manualInputRequired', (data) => {
    showNotificationPanel(data);
    updateStatusBar('⚠️ Manual input required', 'error');
    addLog(`Manual input required: ${data.message}`, 'warning');
});

socket.on('applicationPaused', (data) => {
    showNotificationPanel(data);
    updateStatusBar('⏸️ Application paused for manual input', 'info');
    addLog('Application paused - awaiting user input', 'info');
});

socket.on('smartHandlerUpdate', (data) => {
    if (data.message) {
        addLog(data.message, data.status === 'error' ? 'error' : 'info');
    }

    if (data.status === 'completed') {
        updateStatusBar('✓ Application completed successfully', 'success');
        hideNotificationPanel();
    } else if (data.status === 'error') {
        updateStatusBar(`❌ Application error: ${data.error}`, 'error');
    }
});

socket.on('autoModeToggled', (data) => {
    autoModeEnabled = data.enabled;
    const autoModeToggle = document.getElementById('autoModeToggle');
    if (autoModeToggle) {
        autoModeToggle.checked = autoModeEnabled;
    }
});

// Test Mode - Search, select 3 random jobs, generate PDFs, and open in new window
async function runTestMode() {
    const testBtn = document.getElementById('testModeBtn');
    const originalText = testBtn.textContent;

    try {
        testBtn.disabled = true;
        testBtn.style.opacity = '0.6';
        testBtn.textContent = '🔄 Running Test Mode...';

        // Step 1: Start job search
        addLog('🧪 TEST MODE: Starting job search...', 'info');

        const searchResponse = await fetch('/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location: elements.location.value || 'Portland, OR',
                keywords: elements.keywords.value || 'customer service',
                maxResults: 20
            })
        });

        if (!searchResponse.ok) throw new Error('Search failed');

        // Wait a bit for jobs to be found
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Step 2: Get current jobs
        const statusResponse = await fetch('/api/status');
        const status = await statusResponse.json();

        if (!status.jobs || status.jobs.length === 0) {
            throw new Error('No jobs found');
        }

        addLog(`🧪 TEST MODE: Found ${status.jobs.length} jobs`, 'info');

        // Step 3: Select 3 random jobs
        const shuffled = status.jobs.sort(() => 0.5 - Math.random());
        const selectedJobs = shuffled.slice(0, Math.min(3, shuffled.length));

        addLog(`🧪 TEST MODE: Selected ${selectedJobs.length} random jobs for testing`, 'info');
        selectedJobs.forEach((job, i) => {
            addLog(`  ${i+1}. ${job.title} at ${job.company}`, 'info');
        });

        // Step 4: Generate applications
        testBtn.textContent = '📝 Generating applications...';

        const genResponse = await fetch('/api/generate-applications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobs: selectedJobs })
        });

        if (!genResponse.ok) throw new Error('Application generation failed');

        const result = await genResponse.json();
        const applications = result.applications || [];
        addLog(`🧪 TEST MODE: Generated ${applications.length} applications`, 'success');

        // Step 5: Open PDFs in new window
        testBtn.textContent = '🚀 Opening in new window...';

        const newWindow = window.open('', '_blank');
        if (!newWindow) {
            alert('Please allow popups to view test results');
            return;
        }

        // Create HTML page with all PDFs
        newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test Mode - Resume Review</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background: #f5f5f5;
                    }
                    h1 {
                        color: #2c3e50;
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .controls {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    .controls button {
                        margin: 0 10px;
                        padding: 10px 20px;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-weight: 600;
                    }
                    .job-section {
                        background: white;
                        margin-bottom: 30px;
                        border-radius: 10px;
                        padding: 20px;
                        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    }
                    .job-header {
                        border-bottom: 2px solid #3498db;
                        padding-bottom: 10px;
                        margin-bottom: 20px;
                    }
                    .job-title {
                        color: #2c3e50;
                        font-size: 24px;
                        font-weight: 600;
                    }
                    .job-company {
                        color: #7f8c8d;
                        font-size: 16px;
                    }
                    .tabs {
                        display: flex;
                        gap: 10px;
                        margin-bottom: 20px;
                    }
                    .tab {
                        padding: 10px 20px;
                        background: #ecf0f1;
                        border: none;
                        border-radius: 5px;
                        cursor: pointer;
                        font-weight: 600;
                    }
                    .tab.active {
                        background: #3498db;
                        color: white;
                    }
                    .pdf-container {
                        width: 100%;
                        height: 800px;
                        border: 1px solid #ddd;
                        border-radius: 5px;
                        display: none;
                    }
                    .pdf-container.active {
                        display: block;
                    }
                    iframe {
                        width: 100%;
                        height: 100%;
                        border: none;
                    }
                    .metrics {
                        background: #ecf0f1;
                        padding: 15px;
                        border-radius: 5px;
                        margin-bottom: 20px;
                    }
                    .metric {
                        display: inline-block;
                        margin-right: 20px;
                        color: #2c3e50;
                        font-weight: 600;
                    }
                </style>
            </head>
            <body>
                <h1>🧪 Test Mode - Resume & Cover Letter Review</h1>
                <div class="controls">
                    <button onclick="window.print()" style="background: #3498db; color: white;">🖨️ Print All</button>
                    <button onclick="window.close()" style="background: #95a5a6; color: white;">✕ Close</button>
                </div>
        `);

        // Add each job's documents
        applications.forEach((app, index) => {
            const metrics = app.atsScore || app.resumeMetrics || {};
            newWindow.document.write(`
                <div class="job-section">
                    <div class="job-header">
                        <div class="job-title">${app.job.title}</div>
                        <div class="job-company">${app.job.company}</div>
                    </div>
                    ${metrics.matchedSkills ? `
                    <div class="metrics">
                        <span class="metric">📊 Skills Match: ${metrics.matchedSkills}/${metrics.totalSkills} (${metrics.matchPercentage}%)</span>
                        <span class="metric">⭐ ATS Score: ${metrics.atsScore || 'N/A'}</span>
                    </div>
                    ` : ''}
                    <div class="tabs">
                        <button class="tab active" onclick="showPdf(${index}, 'resume')">📄 Resume</button>
                        <button class="tab" onclick="showPdf(${index}, 'cover')">📝 Cover Letter</button>
                    </div>
                    <div id="resume-${index}" class="pdf-container active">
                        <iframe src="/api/download-resume/${index}"></iframe>
                    </div>
                    <div id="cover-${index}" class="pdf-container">
                        <iframe src="/api/download-cover-letter/${index}"></iframe>
                    </div>
                    <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 2px solid #ecf0f1;">
                        <button id="submit-btn-${index}" class="submit-btn" onclick="submitApplication(${index})" style="background: #27ae60; color: white; padding: 12px 30px; border: none; border-radius: 5px; cursor: pointer; font-weight: 600; font-size: 16px;">
                            ✅ Submit Application
                        </button>
                        <div id="submit-status-${index}" style="margin-top: 10px; font-weight: 600;"></div>
                    </div>
                </div>
            `);
        });

        // Store applications data in the new window for submission
        newWindow.applicationsData = applications;

        newWindow.document.write(`
                <script>
                    function showPdf(jobIndex, type) {
                        // Update tabs
                        const section = document.querySelectorAll('.job-section')[jobIndex];
                        const tabs = section.querySelectorAll('.tab');
                        tabs.forEach(t => t.classList.remove('active'));
                        tabs[type === 'resume' ? 0 : 1].classList.add('active');

                        // Update containers
                        const containers = section.querySelectorAll('.pdf-container');
                        containers.forEach(c => c.classList.remove('active'));
                        containers[type === 'resume' ? 0 : 1].classList.add('active');
                    }

                    async function submitApplication(index) {
                        const btn = document.getElementById('submit-btn-' + index);
                        const status = document.getElementById('submit-status-' + index);
                        const app = window.applicationsData[index];

                        if (!app) {
                            status.innerHTML = '<span style="color: #e74c3c;">❌ Application data not found</span>';
                            return;
                        }

                        try {
                            btn.disabled = true;
                            btn.style.opacity = '0.6';
                            btn.textContent = '⏳ Submitting...';
                            status.innerHTML = '<span style="color: #f39c12;">Submitting application...</span>';

                            const response = await fetch('http://localhost:3000/api/submit-applications', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ applications: [app] })
                            });

                            if (!response.ok) {
                                throw new Error('Submission failed');
                            }

                            const result = await response.json();

                            if (result.submitted > 0) {
                                btn.style.background = '#95a5a6';
                                btn.textContent = '✅ Submitted!';
                                status.innerHTML = '<span style="color: #27ae60;">✅ Application submitted successfully!</span>';
                            } else {
                                throw new Error('Submission was not successful');
                            }
                        } catch (error) {
                            btn.disabled = false;
                            btn.style.opacity = '1';
                            btn.textContent = '✅ Submit Application';
                            status.innerHTML = '<span style="color: #e74c3c;">❌ ' + error.message + '</span>';
                        }
                    }
                </script>
            </body>
            </html>
        `);

        addLog(`🧪 TEST MODE: Opened ${applications.length} documents in new window`, 'success');
        testBtn.textContent = '✅ Test Complete!';

        setTimeout(() => {
            testBtn.textContent = originalText;
            testBtn.disabled = false;
            testBtn.style.opacity = '1';
        }, 3000);

    } catch (error) {
        console.error('Test mode error:', error);
        addLog(`❌ TEST MODE ERROR: ${error.message}`, 'error');
        testBtn.textContent = '❌ Test Failed';

        setTimeout(() => {
            testBtn.textContent = originalText;
            testBtn.disabled = false;
            testBtn.style.opacity = '1';
        }, 3000);
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    init();
    setupLinkedInHandlers();
    setupAutomationHandlers();

    // Add test mode button handler
    const testModeBtn = document.getElementById('testModeBtn');
    if (testModeBtn) {
        testModeBtn.addEventListener('click', runTestMode);
    }
});