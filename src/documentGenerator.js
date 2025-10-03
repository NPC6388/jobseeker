const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, spacing } = require('docx');
const fs = require('fs-extra');
const path = require('path');
const puppeteer = require('puppeteer');

class DocumentGenerator {
    constructor() {
        this.outputDir = path.join(__dirname, '..', 'generated-resumes');
        this.ensureOutputDir();
        this.validationEnabled = true; // Enable pre-flight validation
    }

    async ensureOutputDir() {
        await fs.ensureDir(this.outputDir);
    }

    parseResumeText(resumeText) {
        // First, let's do a more aggressive text restructuring for section detection
        let text = resumeText;

        // Define all possible section headers
        const allSectionHeaders = [
            'PROFESSIONAL SUMMARY', 'CORE COMPETENCIES', 'PROFESSIONAL EXPERIENCE',
            'EDUCATION & CREDENTIALS', 'KEY ACHIEVEMENTS', 'CERTIFICATIONS',
            'Professional Summary', 'Core Competencies', 'Professional Experience',
            'Education & Credentials', 'Key Achievements', 'Certifications'
        ];

        // Force line breaks before and after section headers
        for (const header of allSectionHeaders) {
            // More aggressive pattern to catch headers anywhere in text
            const patterns = [
                new RegExp(`([\\s\\S]*?)(${header})([\\s\\S]*)`, 'gi'),
                new RegExp(`\\s+(${header})\\s+`, 'gi'),
                new RegExp(`(${header})`, 'gi')
            ];

            text = text.replace(new RegExp(`([^\\n])(${header})([^\\n])`, 'gi'), `$1\n\n${header}\n\n$3`);
            text = text.replace(new RegExp(`(${header})\\s*([A-Z])`, 'gi'), `${header}\n\n$2`);
        }

        // Clean up excessive line breaks and normalize
        text = text.replace(/\n{3,}/g, '\n\n').trim();

        console.log('🔍 DEBUG: Text after aggressive restructuring:');
        console.log('🔍 DEBUG: First 500 chars:', text.substring(0, 500));

        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const sections = {};
        let currentSection = null;
        let currentContent = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const nextLine = i + 1 < lines.length ? lines[i + 1] : '';

            // Check if this line is a section header, or if it's followed by equals signs
            if (this.isSectionHeader(line) || (nextLine && nextLine.includes('='.repeat(5)))) {
                // Save previous section
                if (currentSection) {
                    sections[currentSection] = currentContent.join('\n');
                }
                currentSection = line.replace(':', '');
                currentContent = [];

                // Skip the underline if present
                if (nextLine && nextLine.includes('='.repeat(5))) {
                    i++; // Skip the equals line
                }
            } else if (currentSection && !line.includes('='.repeat(5))) {
                currentContent.push(line);
            } else if (!currentSection) {
                // Handle content before first section (name, contact info)
                if (!sections['Contact']) {
                    sections['Contact'] = sections['Contact'] || '';
                }
                sections['Contact'] += line + '\n';
            }
        }

        // Save last section
        if (currentSection) {
            sections[currentSection] = currentContent.join('\n');
        }

        return sections;
    }

    isSectionHeader(line) {
        const headers = [
            'Professional Summary', 'Core Competencies', 'Professional Experience',
            'Education', 'Professional Credentials', 'Certifications', 'Key Achievements',
            'EDUCATION & CREDENTIALS',
            // Add ALL CAPS versions that are used by the tailored resume generator
            'PROFESSIONAL SUMMARY', 'CORE COMPETENCIES', 'PROFESSIONAL EXPERIENCE',
            'EDUCATION', 'PROFESSIONAL CREDENTIALS', 'CERTIFICATIONS', 'KEY ACHIEVEMENTS'
        ];
        const trimmedLine = line.trim();
        return headers.some(header =>
            trimmedLine.includes(header + ':') ||
            trimmedLine === header ||
            trimmedLine.startsWith(header)
        ) || line.includes('='.repeat(10)); // Handle underlined headers
    }

    async generateWordDocument(resumeText, filename = 'improved-resume.docx') {

        const sections = this.parseResumeText(resumeText);
        const children = [];

        // Extract contact info from first few lines
        const contactLines = (sections['Contact'] || '').split('\n').filter(line => line.trim());

        // Name (first line)
        if (contactLines[0]) {
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: contactLines[0], bold: true, size: 28 })],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 240 }
                })
            );
        }

        // Contact info (remaining lines)
        for (let i = 1; i < contactLines.length && i < 4; i++) {
            if (contactLines[i]) {
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: contactLines[i], size: 22 })],
                        alignment: AlignmentType.CENTER,
                        spacing: { after: 120 }
                    })
                );
            }
        }

        // Add sections
        const sectionOrder = [
            'Professional Summary', 'Core Competencies', 'Professional Experience',
            'Key Achievements', 'EDUCATION & CREDENTIALS', 'Education', 'Professional Credentials', 'Certifications'
        ];

        for (const sectionName of sectionOrder) {
            if (sections[sectionName]) {
                // Section header
                children.push(
                    new Paragraph({
                        children: [new TextRun({ text: sectionName, bold: true, size: 24 })],
                        heading: HeadingLevel.HEADING_2,
                        spacing: { before: 360, after: 240 }
                    })
                );

                // Section content
                const content = sections[sectionName];
                if (sectionName === 'Core Competencies') {
                    // Handle bullet-separated skills
                    const skills = content.split('•').map(skill => skill.trim()).filter(skill => skill);
                    const skillsText = skills.join(' • ');
                    children.push(
                        new Paragraph({
                            children: [new TextRun({ text: skillsText, size: 22 })],
                            spacing: { after: 240 }
                        })
                    );
                } else {
                    // Handle other sections with line breaks
                    const contentLines = content.split('\n').filter(line => line.trim());
                    for (const line of contentLines) {
                        if (line.trim()) {
                            const isBullet = line.startsWith('•') || line.startsWith('-');
                            children.push(
                                new Paragraph({
                                    children: [new TextRun({
                                        text: line,
                                        size: 22,
                                        bold: line.includes(' at ') && sectionName === 'Professional Experience'
                                    })],
                                    spacing: { after: isBullet ? 120 : 180 }
                                })
                            );
                        }
                    }
                }
            }
        }

        const doc = new Document({
            sections: [{
                properties: {},
                children: children
            }]
        });

        const buffer = await Packer.toBuffer(doc);
        const filePath = path.join(this.outputDir, filename);
        await fs.writeFile(filePath, buffer);

        return filePath;
    }

    async generatePDF(content, filename = 'improved-resume.pdf') {
        // Check if this is a cover letter or resume based on filename or content
        const isCoverLetter = filename.includes('coverletter') || content.includes('Dear Hiring Manager');

        if (isCoverLetter) {
            return await this.generateCoverLetterPDF(content, filename);
        }

        // PRE-FLIGHT VALIDATION AND CRITICAL FIXES
        if (this.validationEnabled) {
            console.log('🔍 Running pre-flight validation...');

            // CRITICAL FIX: Ensure bullets are on separate lines
            // This prevents the "solid block of text" issue
            content = this.ensureBulletsSeparated(content);

            const validation = this.validateResumeStructure(content);

            if (validation.hasCriticalIssues) {
                console.warn('⚠️ Critical validation issues found:');
                validation.issues.forEach(issue => console.warn(`  - ${issue}`));

                // Auto-fix if possible
                content = this.autoFixResumeStructure(content, validation);
                console.log('🔧 Applied auto-fixes to resume structure');
            } else {
                console.log('✅ Pre-flight validation passed');
            }
        }

        console.log('🔍 DEBUG: Resume content length:', content.length);
        console.log('🔍 DEBUG: First 200 chars:', content.substring(0, 200));

        // First, process the text to handle escaped newlines like the DocumentEditor does
        let processedContent = content
            .replace(/\\n/g, '\n') // Convert escaped newlines to actual newlines
            .replace(/ {2,}/g, ' ') // Remove multiple SPACES only (not newlines!)
            .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
            .trim();

        // Add line breaks before section headers to ensure proper parsing
        const sectionHeaders = [
            'PROFESSIONAL SUMMARY', 'CORE COMPETENCIES', 'PROFESSIONAL EXPERIENCE',
            'EDUCATION', 'KEY ACHIEVEMENTS', 'CERTIFICATIONS'
        ];

        for (const header of sectionHeaders) {
            // Simple replacement to add line breaks before section headers
            // Handle cases where header appears without proper spacing
            const headerRegex = new RegExp(`\\s+(${header})\\s+`, 'gi');
            processedContent = processedContent.replace(headerRegex, `\n\n${header}\n`);
        }

        // Also add debug output to see the processed content structure
        console.log('🔍 DEBUG: Content after header processing:');
        console.log('🔍 DEBUG: Lines after processing:', processedContent.split('\n').slice(0, 20));

        console.log('🔍 DEBUG: Processed content length:', processedContent.length);
        console.log('🔍 DEBUG: First 200 chars after processing:', processedContent.substring(0, 200));

        const sections = this.parseResumeText(processedContent);
        console.log('🔍 DEBUG: Parsed sections:', Object.keys(sections));

        // Create HTML content
        const html = this.createHTMLFromSections(sections);

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const filePath = path.join(this.outputDir, filename);
        await page.pdf({
            path: filePath,
            format: 'A4',
            margin: {
                top: '0.4in',
                right: '0.5in',
                bottom: '0.4in',
                left: '0.5in'
            },
            printBackground: true
        });

        await browser.close();
        return filePath;
    }

    async generateCoverLetterPDF(coverLetterText, filename = 'cover-letter.pdf') {
        const html = this.createCoverLetterHTML(coverLetterText);

        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });

        const filePath = path.join(this.outputDir, filename);
        await page.pdf({
            path: filePath,
            format: 'A4',
            margin: {
                top: '1in',
                right: '1in',
                bottom: '1in',
                left: '1in'
            },
            printBackground: true
        });

        await browser.close();
        return filePath;
    }

    createHTMLFromSections(sections) {
        const contactLines = (sections['Contact'] || '').split('\n').filter(line => line.trim());

        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                /* Basic PDF-optimized layout */
                body {
                    font-family: Arial, sans-serif;
                    font-size: 10px;
                    line-height: 1.3;
                    color: #000;
                    margin: 0;
                    padding: 0;
                    background: white;
                }

                /* Header styling */
                .header-section {
                    text-align: center;
                    margin-bottom: 12px;
                    border-bottom: 1px solid #ccc;
                    padding-bottom: 6px;
                }

                .name {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 4px;
                }

                .contact {
                    font-size: 9px;
                    margin-bottom: 2px;
                }

                /* Section styling with minimal page-break issues */
                .section-wrapper {
                    margin-bottom: 10px;
                    padding-top: 4px;
                }

                .section-header {
                    font-size: 11px;
                    font-weight: bold;
                    color: #000;
                    margin-top: 8px;
                    margin-bottom: 6px;
                    border-bottom: 1.5px solid #000;
                    padding-bottom: 2px;
                    text-transform: uppercase;
                }

                .section-content {
                    margin-bottom: 6px;
                }

                /* Experience entries */
                .job-entry {
                    margin-bottom: 8px;
                    padding-bottom: 4px;
                }

                .job-title {
                    font-weight: bold;
                    font-size: 10px;
                    margin-bottom: 2px;
                }

                .job-details {
                    font-size: 9px;
                    font-style: italic;
                    margin-bottom: 4px;
                    color: #333;
                }

                /* Bullet points with consistent spacing */
                .bullet {
                    margin: 2px 0 2px 12px;
                    font-size: 9px;
                    line-height: 1.25;
                }

                .bullet-group {
                    margin-bottom: 4px;
                }

                /* Skills formatting */
                .skills {
                    line-height: 1.3;
                }

                /* Consistent spacing for all sections */
                .competencies-section, .education-section, .experience-section {
                    margin-bottom: 16px;
                }

                /* Simple, clean separators */
                hr {
                    border: none;
                    height: 1px;
                    background-color: #ccc;
                    margin: 10px 0;
                }

                /* Remove complex styling that causes PDF issues */
                * {
                    box-sizing: border-box;
                }

                /* Ensure consistent text rendering */
                p, div, span, li, ul {
                    margin: 0;
                    padding: 0;
                }

                /* Page break controls for better PDF layout */
                .section-wrapper {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }

                .section-header {
                    page-break-after: avoid;
                    break-after: avoid;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }

                .job-entry {
                    page-break-inside: avoid;
                    break-inside: avoid;
                    margin-bottom: 12px;
                }

                .bullet-group {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }

                .header-section {
                    page-break-after: avoid;
                    break-after: avoid;
                }

                /* Prevent orphaned content */
                .job-title {
                    page-break-after: avoid;
                    break-after: avoid;
                }

                .job-details {
                    page-break-after: avoid;
                    break-after: avoid;
                }

                /* Print-specific optimizations */
                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    .section-wrapper {
                        page-break-inside: avoid;
                    }

                    .job-entry {
                        page-break-inside: avoid;
                    }
                }
            </style>
        </head>
        <body>`;

        // Header section - wrap contact info to keep together
        html += `<div class="header-section">`;
        if (contactLines[0]) {
            html += `<div class="name">${contactLines[0]}</div>`;
        }
        for (let i = 1; i < contactLines.length && i < 4; i++) {
            if (contactLines[i]) {
                html += `<div class="contact">${contactLines[i]}</div>`;
            }
        }
        html += `</div>`;

        // Sections (support both Title Case and ALL CAPS versions)
        const sectionOrder = [
            'Professional Summary', 'PROFESSIONAL SUMMARY',
            'Core Competencies', 'CORE COMPETENCIES',
            'Professional Experience', 'PROFESSIONAL EXPERIENCE',
            'Key Achievements', 'KEY ACHIEVEMENTS',
            'EDUCATION & CREDENTIALS', 'EDUCATION', 'Education', 'Professional Credentials', 'Certifications', 'CERTIFICATIONS'
        ];

        for (const sectionName of sectionOrder) {
            if (sections[sectionName]) {
                // Determine section class based on content
                let sectionClass = 'section-wrapper';
                if (sectionName === 'EDUCATION & CREDENTIALS' || sectionName === 'EDUCATION' || sectionName === 'Education') {
                    sectionClass += ' education-section';
                } else if (sectionName === 'Professional Experience' || sectionName === 'PROFESSIONAL EXPERIENCE') {
                    sectionClass += ' experience-section';
                } else if (sectionName === 'Core Competencies' || sectionName === 'CORE COMPETENCIES') {
                    sectionClass += ' competencies-section';
                }

                html += `<div class="${sectionClass}">`;
                html += `<div class="section-header">${sectionName}</div>`;

                const content = sections[sectionName];
                if (sectionName === 'Core Competencies' || sectionName === 'CORE COMPETENCIES') {
                    const skills = content.split('•').map(skill => skill.trim()).filter(skill => skill);
                    html += `<div class="section-content skills">${skills.join(' • ')}</div>`;
                } else if (sectionName === 'Professional Experience' || sectionName === 'PROFESSIONAL EXPERIENCE') {
                    // Enhanced handling for professional experience
                    html += `<div class="section-content">`;
                    const contentLines = content.split('\n').filter(line => line.trim()).filter(line => !line.includes('='.repeat(10)));

                    let currentJobEntry = null;
                    let expectingCompanyDetails = false;

                    for (const line of contentLines) {
                        if (line.trim()) {
                            const isBullet = line.startsWith('•') || line.startsWith('-');
                            const isCompanyDetails = line.includes('|') && !isBullet;

                            // If it's not a bullet and not company details, it's likely a job title
                            const isJobTitle = !isBullet && !isCompanyDetails && !expectingCompanyDetails;

                            if (isJobTitle && !isBullet) {
                                // Start new job entry
                                if (currentJobEntry) {
                                    html += `</div>`; // Close previous job entry
                                }
                                html += `<div class="job-entry">`;
                                html += `<div class="job-title">${line}</div>`;
                                currentJobEntry = true;
                                expectingCompanyDetails = true;
                            } else if (isCompanyDetails) {
                                html += `<div class="job-details">${line}</div>`;
                                expectingCompanyDetails = false;
                            } else if (isBullet) {
                                html += `<div class="bullet">${line}</div>`;
                                expectingCompanyDetails = false;
                            } else {
                                // This handles cases where we might have additional job info
                                html += `<div>${line}</div>`;
                                expectingCompanyDetails = false;
                            }
                        }
                    }
                    if (currentJobEntry) {
                        html += `</div>`; // Close last job entry
                    }
                    html += `</div>`;
                } else {
                    html += `<div class="section-content">`;
                    const contentLines = content.split('\n').filter(line => line.trim()).filter(line => !line.includes('='.repeat(10)));

                    // Group bullets together to prevent orphaning
                    let bulletGroup = [];
                    for (const line of contentLines) {
                        if (line.trim()) {
                            const isBullet = line.startsWith('•') || line.startsWith('-');

                            if (isBullet) {
                                bulletGroup.push(line);
                            } else {
                                // Output any accumulated bullet group
                                if (bulletGroup.length > 0) {
                                    html += `<div class="bullet-group">`;
                                    bulletGroup.forEach(bullet => {
                                        html += `<div class="bullet">${bullet}</div>`;
                                    });
                                    html += `</div>`;
                                    bulletGroup = [];
                                }
                                // Output non-bullet line
                                html += `<div>${line}</div>`;
                            }
                        }
                    }
                    // Output any remaining bullets
                    if (bulletGroup.length > 0) {
                        html += `<div class="bullet-group">`;
                        bulletGroup.forEach(bullet => {
                            html += `<div class="bullet">${bullet}</div>`;
                        });
                        html += `</div>`;
                    }
                    html += `</div>`;
                }
                html += `</div>`; // Close section-wrapper
            }
        }

        html += `
        </body>
        </html>`;

        return html;
    }

    createCoverLetterHTML(coverLetterText) {
        // Extract contact information from the first few lines if present
        const lines = coverLetterText.split('\n');
        const today = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Add proper business letter formatting with contact info and date
        const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body {
                    font-family: 'Times New Roman', serif;
                    font-size: 12pt;
                    line-height: 1.6;
                    color: #000;
                    margin: 0;
                    padding: 0;
                    background: white;
                }

                .letter-container {
                    max-width: 6.5in;
                    margin: 0 auto;
                    padding: 0;
                }

                .header {
                    text-align: right;
                    margin-bottom: 1in;
                }

                .contact-info {
                    font-size: 12pt;
                    line-height: 1.4;
                }

                .date {
                    margin-top: 0.5in;
                    margin-bottom: 1in;
                }

                .letter-content {
                    font-size: 12pt;
                    line-height: 1.6;
                    text-align: left;
                }

                .greeting {
                    margin-bottom: 1em;
                }

                .paragraph {
                    margin-bottom: 1em;
                    text-indent: 0;
                }

                .closing {
                    margin-top: 1em;
                    margin-bottom: 3em;
                }

                .signature {
                    margin-top: 0.5in;
                }

                /* Ensure proper page breaks for printing */
                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            </style>
        </head>
        <body>
            <div class="letter-container">
                <div class="header">
                    <div class="contact-info">
                        Matthew Nicholson<br>
                        Matthew2go@pm.me<br>
                        +1-971-757-5840<br>
                        White City, OR
                    </div>
                    <div class="date">${today}</div>
                </div>

                <div class="letter-content">
                    ${this.formatCoverLetterContent(coverLetterText)}
                </div>
            </div>
        </body>
        </html>`;

        return html;
    }

    formatCoverLetterContent(coverLetterText) {
        // Split the cover letter into paragraphs and format them properly
        const paragraphs = coverLetterText.split('\n\n').filter(p => p.trim());

        return paragraphs.map(paragraph => {
            const trimmed = paragraph.trim();
            if (trimmed.startsWith('Dear ')) {
                return `<div class="greeting">${trimmed}</div>`;
            } else if (trimmed.includes('Sincerely') || trimmed.includes('Best regards')) {
                return `<div class="closing">${trimmed}</div>`;
            } else if (trimmed.length < 50 && !trimmed.includes('.')) {
                // Likely a signature line
                return `<div class="signature">${trimmed}</div>`;
            } else {
                return `<div class="paragraph">${trimmed}</div>`;
            }
        }).join('');
    }

    async generateBothFormats(resumeText, baseFilename = 'improved-resume') {

        const wordFile = await this.generateWordDocument(resumeText, `${baseFilename}.docx`);
        const pdfFile = await this.generatePDF(resumeText, `${baseFilename}.pdf`);

        return {
            word: wordFile,
            pdf: pdfFile
        };
    }

    getFilePath(filename) {
        return path.join(this.outputDir, filename);
    }

    /**
     * CRITICAL: Ensure bullet points are on separate lines
     * This fixes the "solid block of text" issue
     */
    ensureBulletsSeparated(content) {
        let fixed = content;

        // Fix bullet points that are on the same line (merged together)
        // Pattern: "text• more text" should become "text\n• more text"
        fixed = fixed.replace(/([^•\n])(\s*)•\s*/g, '$1\n• ');

        // Fix multiple bullets on same line: "• text • text" -> "• text\n• text"
        fixed = fixed.replace(/•([^•\n]+)•/g, '•$1\n•');

        // Ensure bullet points have proper line breaks before them
        // This catches cases where AI merged paragraphs
        const lines = fixed.split('\n');
        const fixedLines = [];
        let inBulletSequence = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line.startsWith('•')) {
                // This is a bullet point
                if (!inBulletSequence && fixedLines.length > 0) {
                    // First bullet after non-bullet content - ensure spacing
                    const prevLine = fixedLines[fixedLines.length - 1];
                    if (prevLine.trim() !== '') {
                        // Previous line has content, keep it
                    }
                }
                fixedLines.push('• ' + line.substring(1).trim());
                inBulletSequence = true;
            } else {
                // Not a bullet point
                if (line === '') {
                    // Empty line
                    fixedLines.push('');
                } else {
                    // Regular content line
                    fixedLines.push(line);
                }
                if (line !== '') {
                    inBulletSequence = false;
                }
            }
        }

        fixed = fixedLines.join('\n');

        // Fix any remaining formatting issues
        fixed = fixed.replace(/\n{4,}/g, '\n\n\n'); // Max 3 line breaks
        fixed = fixed.replace(/([^\n])(PROFESSIONAL EXPERIENCE|EDUCATION|CERTIFICATIONS)/g, '$1\n\n$2');

        return fixed;
    }

    /**
     * Pre-flight validation for resume structure
     */
    validateResumeStructure(content) {
        const validation = {
            hasCriticalIssues: false,
            issues: [],
            warnings: []
        };

        // Check for required sections
        const requiredSections = [
            'PROFESSIONAL SUMMARY',
            'CORE COMPETENCIES',
            'PROFESSIONAL EXPERIENCE',
            'EDUCATION'
        ];

        for (const section of requiredSections) {
            if (!content.includes(section)) {
                validation.issues.push(`Missing required section: ${section}`);
                validation.hasCriticalIssues = true;
            }
        }

        // Check for contact information in first 500 characters
        const header = content.substring(0, 500);
        if (!/@/.test(header)) {
            validation.warnings.push('Email address not found in header');
        }
        if (!/\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(header)) {
            validation.warnings.push('Phone number not found in header');
        }

        // Check for proper section spacing
        const lines = content.split('\n');
        let previousLineEmpty = false;
        let consecutiveEmptyLines = 0;

        for (const line of lines) {
            if (line.trim() === '') {
                consecutiveEmptyLines++;
                previousLineEmpty = true;
            } else {
                if (consecutiveEmptyLines > 3) {
                    validation.warnings.push('Excessive blank lines detected (may cause formatting issues)');
                }
                consecutiveEmptyLines = 0;
                previousLineEmpty = false;
            }
        }

        // Check for sections without proper spacing
        for (const section of requiredSections) {
            const sectionIndex = content.indexOf(section);
            if (sectionIndex > 0) {
                // Check if there's proper spacing before section
                const before = content.substring(Math.max(0, sectionIndex - 10), sectionIndex);
                if (!/\n\n/.test(before)) {
                    validation.warnings.push(`Section "${section}" lacks proper spacing`);
                }
            }
        }

        // Check for bullet points
        const bulletCount = (content.match(/•/g) || []).length;
        if (bulletCount < 5) {
            validation.warnings.push('Low bullet point count (may indicate formatting issues)');
        }

        return validation;
    }

    /**
     * Auto-fix resume structure issues
     */
    autoFixResumeStructure(content, validation) {
        let fixed = content;

        // Fix 1: Ensure proper spacing around section headers
        const sections = [
            'PROFESSIONAL SUMMARY',
            'CORE COMPETENCIES',
            'PROFESSIONAL EXPERIENCE',
            'EDUCATION',
            'CERTIFICATIONS'
        ];

        for (const section of sections) {
            // Add double line break before and after section headers
            const regex = new RegExp(`([^\\n])(${section})([^\\n])`, 'g');
            fixed = fixed.replace(regex, `$1\n\n${section}\n\n$3`);

            // Also handle cases where section is at start/end of string
            fixed = fixed.replace(new RegExp(`^(${section})([^\\n])`, 'gm'), `${section}\n\n$2`);
            fixed = fixed.replace(new RegExp(`([^\\n])(${section})$`, 'gm'), `$1\n\n${section}`);
        }

        // Fix 2: Remove excessive blank lines (max 2 consecutive)
        fixed = fixed.replace(/\n{4,}/g, '\n\n\n');

        // Fix 3: Ensure bullet points have consistent formatting
        fixed = fixed.replace(/^[-*]\s/gm, '• ');

        // Fix 4: Remove trailing spaces
        fixed = fixed.replace(/[ \t]+$/gm, '');

        // Fix 5: Ensure proper line breaks after contact info
        const lines = fixed.split('\n');
        if (lines.length > 3) {
            // Find where contact info ends (usually after phone/email)
            let contactEndIndex = -1;
            for (let i = 0; i < Math.min(10, lines.length); i++) {
                if (/@/.test(lines[i]) || /\+?\d{1,3}[-.\s]?\(?\d{3}\)?/.test(lines[i])) {
                    contactEndIndex = i;
                }
            }

            if (contactEndIndex >= 0 && contactEndIndex < lines.length - 1) {
                // Ensure 2-3 blank lines after contact info
                if (lines[contactEndIndex + 1].trim() !== '') {
                    lines.splice(contactEndIndex + 1, 0, '', '');
                }
            }

            fixed = lines.join('\n');
        }

        return fixed;
    }

    /**
     * Validate PDF output quality
     */
    async validatePDFOutput(pdfPath) {
        try {
            // Check file exists and has content
            const stats = await fs.stat(pdfPath);
            if (stats.size < 1000) {
                console.warn('⚠️ PDF file size unusually small:', stats.size, 'bytes');
                return {
                    valid: false,
                    issue: 'PDF file size too small'
                };
            }

            if (stats.size > 500000) {
                console.warn('⚠️ PDF file size unusually large:', stats.size, 'bytes');
                return {
                    valid: true,
                    warning: 'PDF file size larger than expected'
                };
            }

            console.log('✅ PDF validation passed:', stats.size, 'bytes');
            return {
                valid: true,
                size: stats.size
            };

        } catch (error) {
            console.error('❌ PDF validation failed:', error.message);
            return {
                valid: false,
                issue: error.message
            };
        }
    }
}

module.exports = DocumentGenerator;