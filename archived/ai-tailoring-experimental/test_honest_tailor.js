// Test the new HonestResumeTailor
const HonestResumeTailor = require('./src/honestResumeTailor');

const testJob = {
    title: 'Customer Service Representative',
    company: 'Test Company',
    description: 'We are looking for a customer service representative with excellent communication skills, data entry experience, and proficiency in Microsoft Excel. Must be detail-oriented and able to handle multiple tasks.'
};

async function test() {
    try {
        console.log('🧪 Testing HonestResumeTailor\n');

        const tailor = new HonestResumeTailor();

        console.log('📄 Loading base resume...');
        await tailor.loadBaseResume();

        console.log('\n📊 Base Resume Data:');
        console.log('   Name:', tailor.baseResume.personalInfo.name);
        console.log('   Email:', tailor.baseResume.personalInfo.email);
        console.log('   Skills:', tailor.baseResume.skills.slice(0, 5).join(', '), '...');
        console.log('   Jobs:', tailor.baseResume.experience.length);

        console.log('\n🎯 Tailoring for job:', testJob.title);
        const result = await tailor.tailorResumeForJob(testJob);

        console.log('\n✅ TAILORED RESUME:');
        console.log('='.repeat(80));
        console.log(result.tailoredResume.resumeText);
        console.log('='.repeat(80));

        console.log('\n📈 Metrics:');
        console.log('   Matched Skills:', result.metrics.matchedSkills);
        console.log('   Total Skills:', result.metrics.totalSkills);
        console.log('   Match %:', result.metrics.matchPercentage + '%');

        console.log('\n✅ Test completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

test();
