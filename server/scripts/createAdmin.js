require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const [,, username, password, name = 'Super Admin'] = process.argv;

if (!username || !password) {
  console.error('Usage: node scripts/createAdmin.js <username> <password> [name]');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const exists = await Admin.findOne({ username });
  if (exists) {
    console.log(`Admin "${username}" already exists.`);
    await mongoose.disconnect();
    return;
  }
  await Admin.create({ username, password, name });
  console.log(`✅ Admin "${username}" created.`);
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
