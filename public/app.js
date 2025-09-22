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
                <span class="job-status status-${(job.status || 'unknown').toLowerCase().replace('_', '-')}">${job.status || 'Unknown'}</span>
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

    elements.applicationsList.innerHTML = generatedApplications.map((app, index) => `
        <div class="application-preview">
            <div class="application-header">
                <div>
                    <h3 style="margin: 0; color: #2c3e50;">${escapeHtml(app.job.title)}</h3>
                    <p style="margin: 5px 0 0 0; color: #7f8c8d;">${escapeHtml(app.job.company)} • ${escapeHtml(app.job.location)}</p>
                </div>
                <div class="ats-score">
                    <span style="font-size: 0.9em; color: #7f8c8d;">ATS Score:</span>
                    <span class="score-badge ${getScoreClass(app.resume.atsScore)}">${app.resume.atsScore}%</span>
                </div>
            </div>

            <div class="tailoring-notes">
                <strong>📝 Tailoring Notes:</strong>
                <ul style="margin: 5px 0 0 20px;">
                    ${app.resume.tailoringNotes.map(note => `<li>${escapeHtml(note)}</li>`).join('')}
                </ul>
            </div>

            <div class="keyword-matches" style="margin: 10px 0;">
                <strong style="font-size: 0.9em;">🎯 Keyword Matches:</strong>
                <div style="margin-top: 8px;">
                    ${app.resume.keywordMatches.map(match =>
                        `<span class="keyword-match ${match.matched ? 'keyword-matched' : 'keyword-unmatched'}">${escapeHtml(match.keyword)}</span>`
                    ).join('')}
                </div>
            </div>

            <div class="application-content">
                <div>
                    <h4 style="margin: 0 0 10px 0; color: #2c3e50;">📄 Tailored Resume</h4>
                    <div class="resume-preview">
                        <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; font-size: 0.85em; line-height: 1.4;">${escapeHtml(app.resumeText.substring(0, 1000))}${app.resumeText.length > 1000 ? '...\n\n[Resume continues...]' : ''}</pre>
                    </div>
                </div>
                <div>
                    <h4 style="margin: 0 0 10px 0; color: #2c3e50;">✉️ Cover Letter</h4>
                    <div class="cover-letter-preview">
                        <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; font-size: 0.85em; line-height: 1.4;">${escapeHtml(app.coverLetter.coverLetter)}</pre>
                    </div>
                </div>
            </div>

            <div style="text-align: center; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e9ecef;">
                <input type="checkbox" id="approve-${index}" style="margin-right: 8px;" checked>
                <label for="approve-${index}" style="font-weight: 600; color: #2c3e50;">Approve this application for submission</label>
            </div>
        </div>
    `).join('');

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

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', init);