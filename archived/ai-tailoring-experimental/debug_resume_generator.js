// Quick debug script to test resume generation
const DocumentGenerator = require('./src/documentGenerator');
const fs = require('fs');

async function testResume() {
    // Read the full test resume text from the file
    const fs = require('fs');
    const sampleResumeText = fs.readFileSync('test_resume.txt', 'utf8');

    console.log('Input resume text:');
    console.log('='.repeat(50));
    console.log(sampleResumeText);
    console.log('='.repeat(50));
    console.log('Text length:', sampleResumeText.length);

    const generator = new DocumentGenerator();

    // Test the parsing
    const sections = generator.parseResumeText(sampleResumeText);
    console.log('\nParsed sections:');
    console.log(Object.keys(sections));

    for (const [sectionName, content] of Object.entries(sections)) {
        console.log(`\n--- ${sectionName} ---`);
        console.log(content);
    }

    // Generate HTML
    const html = generator.createHTMLFromSections(sections);

    // Save HTML for inspection
    fs.writeFileSync('debug_resume.html', html);
    console.log('\nHTML saved to debug_resume.html');

    // Generate PDF
    try {
        const pdfPath = await generator.generatePDF(sampleResumeText, 'debug_resume.pdf');
        console.log('\nPDF generated at:', pdfPath);
    } catch (error) {
        console.error('PDF generation error:', error);
    }
}

testResume().catch(console.error);