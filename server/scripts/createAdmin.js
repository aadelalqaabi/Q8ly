require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const count = await Admin.countDocuments();
  if (count > 0) {
    console.log('Admin already exists. Exiting.');
    await mongoose.disconnect();
    return;
  }
  await Admin.create({ username: 'kn_admin', password: 'KuwaitNow@2026!', name: 'Super Admin' });
  console.log('✅ Admin created.');
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
