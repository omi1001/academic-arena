const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');

const emailArg = process.argv[2];

if (!emailArg) {
  console.log('\n❌ Usage: node scripts/makeAdmin.js <user-email>');
  console.log('Example: node scripts/makeAdmin.js monus@gmail.com\n');
  process.exit(1);
}

const run = async () => {
  try {
    await connectDB();
    const email = emailArg.trim().toLowerCase();

    const user = await User.findOneAndUpdate(
      { email },
      { $set: { role: 'admin', activeBorder: 'glowing_gold' } },
      { new: true }
    );

    if (!user) {
      console.log(`\n⚠️ User with email "${email}" not found in database.`);
      console.log('Tip: Register/Login in the app with this email first, then run this command.\n');
    } else {
      console.log(`\n✅ SUCCESS! ${user.name} (${user.email}) is now an ADMIN with Gold Glow border!`);
      console.log(`Role: ${user.role}`);
      console.log(`Border: ${user.activeBorder}\n`);
    }

    mongoose.connection.close();
  } catch (err) {
    console.error('Error making admin:', err);
    process.exit(1);
  }
};

run();
