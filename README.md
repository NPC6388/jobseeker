# JobSeeker - Automated Job Search Tool

An automated job search application that finds part-time day jobs in your local area and can automatically submit applications with your resume.

## Features

- 🔍 **Multi-Platform Search**: Searches Indeed and LinkedIn for job opportunities
- 📍 **Location-Based**: Finds jobs within your specified radius
- ⏰ **Part-Time & Day Shift Focus**: Filters for part-time day jobs only
- 🤖 **Auto-Application**: Automatically fills out and submits job applications
- 📊 **Application Tracking**: Keeps track of applied jobs to avoid duplicates
- 🔒 **Safe Mode**: Dry run option to test without actually applying
- 📝 **Detailed Logging**: Comprehensive logs of all activities

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   ```

3. **Edit Configuration**
   Open `.env` and configure your settings:
   ```env
   # Location Settings
   SEARCH_LOCATION=Seattle, WA
   SEARCH_RADIUS=25

   # Job Preferences
   JOB_TYPES=part-time
   WORK_SCHEDULE=day
   KEYWORDS=customer service,retail,data entry

   # Personal Information
   YOUR_NAME=John Doe
   YOUR_EMAIL=john.doe@email.com
   YOUR_PHONE=+1-555-123-4567

   # File Paths
   RESUME_PATH=./data/resume.pdf
   COVER_LETTER_PATH=./data/cover_letter.txt

   # Application Settings
   MAX_APPLICATIONS_PER_DAY=10
   AUTO_SUBMIT=false
   DRY_RUN=true
   ```

4. **Add Your Documents**
   - Place your resume (PDF) in `./data/resume.pdf`
   - Place your cover letter (TXT) in `./data/cover_letter.txt`

## Usage

### Web Interface (Recommended)
```bash
npm run web
```
Opens a private web dashboard at `http://localhost:3000` with:
- 📊 Real-time job search monitoring
- ⚙️ Easy configuration management
- 📋 Complete application tracking with timestamps
- 📁 Resume upload functionality
- 📈 Live search progress and statistics

### Command Line Interface

#### Test Mode (Recommended First)
```bash
npm start
```
This runs in dry-run mode by default - it will search and filter jobs but won't actually apply.

#### Live Mode
Set `DRY_RUN=false` and `AUTO_SUBMIT=true` in your `.env` file, then:
```bash
npm start
```

#### Development Mode
```bash
npm run dev
npm run web-dev  # For web interface development
```
Runs with auto-reload when files change.

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SEARCH_LOCATION` | Your city and state | Required |
| `SEARCH_RADIUS` | Search radius in miles | 25 |
| `KEYWORDS` | Job keywords (comma-separated) | "" |
| `YOUR_NAME` | Your full name | Required |
| `YOUR_EMAIL` | Your email address | Required |
| `YOUR_PHONE` | Your phone number | Required |
| `RESUME_PATH` | Path to your resume PDF | ./data/resume.pdf |
| `COVER_LETTER_PATH` | Path to your cover letter | ./data/cover_letter.txt |
| `MAX_APPLICATIONS_PER_DAY` | Daily application limit | 10 |
| `AUTO_SUBMIT` | Actually submit applications | false |
| `DRY_RUN` | Test mode without applying | true |

### Job Filtering

The app automatically filters jobs to find:
- ✅ Part-time positions
- ✅ Day shift jobs
- ✅ Jobs within your location radius
- ❌ Excludes senior/management roles
- ❌ Excludes night/weekend shifts
- ❌ Excludes travel-heavy positions

## Data Files

The app creates several data files to track your job search:

- `data/applied-jobs.json` - List of jobs you've already applied to
- `data/application-log.json` - Detailed log of all application attempts

## Safety Features

- **Dry Run Mode**: Test the app without actually applying to jobs
- **Daily Limits**: Prevents spam applications
- **Duplicate Prevention**: Tracks applied jobs to avoid reapplying
- **Manual Review**: Option to fill forms but not auto-submit

## Supported Job Boards

- **Indeed**: Full search and application support
- **LinkedIn**: Search support (manual application required due to login requirements)

## Legal & Ethical Considerations

- ⚠️ **Use Responsibly**: Only apply to jobs you're genuinely interested in
- ⚠️ **Respect Rate Limits**: Don't overwhelm job sites with requests
- ⚠️ **Review Applications**: Always review auto-filled applications before submitting
- ⚠️ **Terms of Service**: Ensure compliance with job board terms of service

## Troubleshooting

### Common Issues

1. **No jobs found**: Check your location and keywords in `.env`
2. **Resume not uploading**: Ensure file path is correct and file exists
3. **Applications failing**: Try setting `AUTO_SUBMIT=false` to manually review
4. **LinkedIn not working**: LinkedIn requires manual login - applications will be logged for manual follow-up

### Logs

Check the console output and `data/application-log.json` for detailed information about what happened during each run.

## Contributing

Feel free to submit issues and enhancement requests!

## Disclaimer

This tool is for educational and personal use only. Users are responsible for ensuring compliance with job board terms of service and applicable laws. Use at your own risk.