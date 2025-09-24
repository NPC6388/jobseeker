const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, spacing } = require('docx');
const fs = require('fs-extra');
const path = require('path');
const puppeteer = require('puppeteer');

class DocumentGenerator {
    constructor() {
        this.outputDir = path.join(__dirname, '..', 'generated-resumes');
        this.ensureOutputDir();
    }

    async ensureOutputDir() {
        await fs.ensureDir(this.outputDir);
    }

    parseResumeText(resumeText) {
        const lines = resumeText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        const sections = {};
        let currentSection = null;
        let currentContent = [];

        console.log('🔍 Parsing resume text. First 10 lines:');
        lines.slice(0, 10).forEach((line, i) => console.log(`${i}: "${line}"`));

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
                console.log(`📋 Found section: "${currentSection}"`);

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

        console.log('📊 Parsed sections:', Object.keys(sections));
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
        return headers.some(header => line.includes(header + ':') || line === header || line.trim() === header) ||
               line.includes('='.repeat(10)) || // Handle underlined headers
               line.trim().startsWith('EDUCATION & CREDENTIALS');
    }

    async generateWordDocument(resumeText, filename = 'improved-resume.docx') {
        console.log('🔄 Generating Word document...');

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

        console.log(`✅ Word document saved: ${filePath}`);
        return filePath;
    }

    async generatePDF(resumeText, filename = 'improved-resume.pdf') {
        console.log('🔄 Generating PDF document...');

        const sections = this.parseResumeText(resumeText);

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
                top: '0.75in',
                right: '0.75in',
                bottom: '0.75in',
                left: '0.75in'
            },
            printBackground: true
        });

        await browser.close();
        console.log(`✅ PDF document saved: ${filePath}`);
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
                body {
                    font-family: 'Calibri', Arial, sans-serif;
                    line-height: 1.4;
                    margin: 0;
                    padding: 0;
                    color: #333;
                }
                .name {
                    font-size: 24px;
                    font-weight: bold;
                    text-align: center;
                    margin-bottom: 8px;
                }
                .contact {
                    text-align: center;
                    margin-bottom: 4px;
                    font-size: 11px;
                }
                .section-header {
                    font-size: 14px;
                    font-weight: bold;
                    margin-top: 16px;
                    margin-bottom: 8px;
                    border-bottom: 1px solid #ccc;
                    padding-bottom: 2px;
                    page-break-after: avoid;
                    break-after: avoid;
                }
                .section-content {
                    font-size: 11px;
                    margin-bottom: 12px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                .job-title {
                    font-weight: bold;
                    margin-top: 8px;
                }
                .skills {
                    line-height: 1.3;
                }
                .bullet {
                    margin-left: 20px;
                    margin-bottom: 4px;
                }

                /* Prevent section headers from appearing at bottom of page */
                .section-wrapper {
                    page-break-inside: avoid;
                    break-inside: avoid;
                    margin-bottom: 16px;
                }

                /* Keep education/credentials together */
                .education-section {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
            </style>
        </head>
        <body>`;

        // Name and contact
        if (contactLines[0]) {
            html += `<div class="name">${contactLines[0]}</div>`;
        }
        for (let i = 1; i < contactLines.length && i < 4; i++) {
            if (contactLines[i]) {
                html += `<div class="contact">${contactLines[i]}</div>`;
            }
        }

        // Sections (support both Title Case and ALL CAPS versions)
        const sectionOrder = [
            'Professional Summary', 'PROFESSIONAL SUMMARY',
            'Core Competencies', 'CORE COMPETENCIES',
            'Professional Experience', 'PROFESSIONAL EXPERIENCE',
            'Key Achievements', 'KEY ACHIEVEMENTS',
            'EDUCATION & CREDENTIALS', 'Education', 'Professional Credentials', 'Certifications'
        ];

        for (const sectionName of sectionOrder) {
            if (sections[sectionName]) {
                const sectionClass = sectionName === 'EDUCATION & CREDENTIALS' ? 'section-wrapper education-section' : 'section-wrapper';
                html += `<div class="${sectionClass}">`;
                html += `<div class="section-header">${sectionName}</div>`;

                const content = sections[sectionName];
                if (sectionName === 'Core Competencies' || sectionName === 'CORE COMPETENCIES') {
                    const skills = content.split('•').map(skill => skill.trim()).filter(skill => skill);
                    html += `<div class="section-content skills">${skills.join(' • ')}</div>`;
                } else {
                    html += `<div class="section-content">`;
                    const contentLines = content.split('\n').filter(line => line.trim()).filter(line => !line.includes('='.repeat(10))); // Skip underline decorations
                    for (const line of contentLines) {
                        if (line.trim()) {
                            const isBullet = line.startsWith('•') || line.startsWith('-');
                            const isJobTitle = line.includes(' at ') && (sectionName === 'Professional Experience' || sectionName === 'PROFESSIONAL EXPERIENCE');
                            const className = isBullet ? 'bullet' : (isJobTitle ? 'job-title' : '');
                            html += `<div class="${className}">${line}</div>`;
                        }
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

    async generateBothFormats(resumeText, baseFilename = 'improved-resume') {
        console.log('📄 Generating both Word and PDF formats...');

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
}

module.exports = DocumentGenerator;