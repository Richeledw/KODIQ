const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function inspectCourses() {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/eduplat');
    const Course = require('./src/models/Course');
    const courses = await Course.find();
    console.log('Total courses in MongoDB:', courses.length);
    courses.forEach(c => {
        let lessonCount = 0;
        let sampleVideos = [];
        (c.modulos || []).forEach(m => {
            (m.lecciones || []).forEach(l => {
                lessonCount++;
                if (sampleVideos.length < 3) sampleVideos.push(l.videoUrl);
            });
        });
        console.log(`Course ${c.id}: ${c.titulo} - ${lessonCount} lessons - Sample videos:`, sampleVideos);
    });
    await mongoose.disconnect();
}

inspectCourses();
