const mammoth = require('mammoth');

async function debugResume() {
    const result = await mammoth.extractRawText({ path: './matthew-nicholson-resume.docx' });
    const text = result.value;

    console.log('=== RAW RESUME TEXT ===');
    console.log(text);
    console.log('\n=== END ===');

    console.log('\n=== SEARCHING FOR EXPERIENCE SECTION ===');
    const expMatch = text.match(/PROFESSIONAL EXPERIENCE(.*?)(?=EDUCATION|$)/is);
    if (expMatch) {
        console.log('Found experience section:');
        console.log(expMatch[1].substring(0, 500));
    } else {
        console.log('No experience section found');
        console.log('\nSearching for any "experience" text:');
        const lines = text.split('\n');
        lines.forEach((line, i) => {
            if (/experience/i.test(line)) {
                console.log(`Line ${i}: ${line}`);
            }
        });
    }
}

debugResume().catch(console.error);
