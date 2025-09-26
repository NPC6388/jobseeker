require('dotenv').config();
const JobSeeker = require('./jobSeeker');

async function main() {

    try {
        const jobSeeker = new JobSeeker();
        await jobSeeker.initialize();
        await jobSeeker.searchAndApply();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}