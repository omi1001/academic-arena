require('dotenv').config();
const mongoose = require('mongoose');
const Question = require('../src/models/Question');
const questions = require('../data/questions');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    await Question.deleteMany({});
    console.log('Cleared existing questions');

    if (questions.length === 0) {
      console.log('No questions to seed. Add questions to data/questions.js');
      process.exit(0);
    }

    for (let i = 0; i < questions.length; i += 100) {
      const batch = questions.slice(i, i + 100);
      await Question.insertMany(batch);
      console.log(`Seeded ${Math.min(i + 100, questions.length)}/${questions.length}`);
    }

    console.log('Seeding complete!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
};

seed();
