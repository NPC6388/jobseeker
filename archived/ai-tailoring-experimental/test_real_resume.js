// Test with actual resume format
const DocumentGenerator = require('./src/documentGenerator');

const realResumeText = `Matthew Nicholson
+1-971-757-5840
Matthew2go@pm.me | White City, OR | linkedin.com/in/matthew-nicholson


PROFESSIONAL SUMMARY

Experienced customer service representative professional with background in customer service excellence.


CORE COMPETENCIES

• Customer Service Excellence
• Microsoft Excel
• Data Entry


PROFESSIONAL EXPERIENCE

Inside Sales Manager / Customer Service Manager
PHYSICAL OPTICS CORPORATION | Torrance, CA | 1998 – 2003
• Started as a customer data Entry professional and progressed through multiple IT positions
• Ensured high levels of satisfaction and retention by meeting client expectations
• Led multiple internal process and system redesign projects

Founder and Owner
Gecko Real Estate Investments | Portland, OR | 2019 -- 2021
• Acquired, financed, and managed the remodeling and reselling of 4 homes


EDUCATION

High School Diploma
St. Helens High School | St. Helens, OR | 2010


CERTIFICATIONS

• Project Management Professional (PMP), 12/2010 – 12/2013
• Certified Scrum Master (CSM), 11/2010 – 11/2012


`;

async function test() {
    const generator = new DocumentGenerator();

    console.log('===== TESTING RESUME PARSING =====\n');
    console.log('Input resume text:');
    console.log(realResumeText);
    console.log('\n===== PARSING =====\n');

    const sections = generator.parseResumeText(realResumeText);

    console.log('Parsed sections:', Object.keys(sections));
    console.log('\n');

    for (const [name, content] of Object.entries(sections)) {
        console.log(`\n--- ${name} ---`);
        console.log(content);
        console.log('--- END ---');
    }

    console.log('\n\n===== HTML GENERATION =====\n');
    const html = generator.createHTMLFromSections(sections);

    console.log('HTML length:', html.length);

    // Save for inspection
    const fs = require('fs');
    fs.writeFileSync('test_real_resume.html', html);
    console.log('HTML saved to test_real_resume.html');

    // Generate PDF
    const pdfPath = await generator.generatePDF(realResumeText, 'test_real_resume.pdf');
    console.log('PDF generated:', pdfPath);
}

test().catch(console.error);
