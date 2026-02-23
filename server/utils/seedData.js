/**
 * Seed script – creates default topics and spaces for Kuwait Now.
 * Run once: node utils/seedData.js
 */
require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const Topic = require('../models/Topic');
const Space = require('../models/Space');
const User = require('../models/User');

const DEFAULT_TOPICS = [
  { name: 'Politics & Parliament', nameAr: 'السياسة والبرلمان', slug: 'politics', category: 'politics', color: '#C8102E', isOfficial: true },
  { name: 'Society & Culture', nameAr: 'المجتمع والثقافة', slug: 'society', category: 'society', color: '#007A3D', isOfficial: true },
  { name: 'Traffic & Roads', nameAr: 'المرور والطرق', slug: 'traffic', category: 'traffic', color: '#FF6B35', isOfficial: true },
  { name: 'Jobs & Business', nameAr: 'الوظائف والأعمال', slug: 'jobs', category: 'jobs', color: '#2196F3', isOfficial: true },
  { name: 'Real Estate', nameAr: 'العقارات', slug: 'real-estate', category: 'realestate', color: '#9C27B0', isOfficial: true },
  { name: 'Sports', nameAr: 'الرياضة', slug: 'sports', category: 'sports', color: '#00BCD4', isOfficial: true },
  { name: 'Events & Activities', nameAr: 'الفعاليات والأنشطة', slug: 'events', category: 'events', color: '#FF9800', isOfficial: true },
  { name: 'Offers & Shopping', nameAr: 'العروض والتسوق', slug: 'offers', category: 'offers', color: '#E91E63', isOfficial: true },
  { name: 'Technology', nameAr: 'التقنية', slug: 'technology', category: 'technology', color: '#607D8B', isOfficial: false },
  { name: 'Health', nameAr: 'الصحة', slug: 'health', category: 'health', color: '#4CAF50', isOfficial: false },
  { name: 'Entertainment', nameAr: 'الترفيه', slug: 'entertainment', category: 'entertainment', color: '#FF5722', isOfficial: false },
  { name: 'Weather', nameAr: 'الطقس', slug: 'weather', category: 'other', color: '#78909C', isOfficial: true },
];

const DEFAULT_SPACES = [
  { name: 'Al Asimah', nameAr: 'العاصمة', slug: 'asimah', type: 'location', district: 'Al Asimah', color: '#C8102E', isOfficial: true, description: 'Everything happening in Kuwait City Capital Governorate' },
  { name: 'Hawalli', nameAr: 'حولي', slug: 'hawalli', type: 'location', district: 'Hawalli', color: '#007A3D', isOfficial: true, description: 'Community for Hawalli Governorate residents' },
  { name: 'Farwaniyah', nameAr: 'الفروانية', slug: 'farwaniyah', type: 'location', district: 'Farwaniyah', color: '#FF6B35', isOfficial: true, description: 'Al Farwaniyah – news, shops, events & daily life' },
  { name: 'Ahmadi', nameAr: 'الأحمدي', slug: 'ahmadi', type: 'location', district: 'Ahmadi', color: '#2196F3', isOfficial: true, description: 'Ahmadi Governorate community space' },
  { name: 'Jahra', nameAr: 'الجهراء', slug: 'jahra', type: 'location', district: 'Jahra', color: '#9C27B0', isOfficial: true, description: 'Jahra Governorate news & community' },
  { name: 'Mubarak Al-Kabeer', nameAr: 'مبارك الكبير', slug: 'mubarak-kabeer', type: 'location', district: 'Mubarak Al-Kabeer', color: '#00BCD4', isOfficial: true, description: 'Mubarak Al-Kabeer Governorate community' },
  { name: 'Kuwait Football', nameAr: 'كرة القدم الكويتية', slug: 'kuwait-football', type: 'interest', color: '#FF9800', isOfficial: false, description: 'Discuss Kuwaiti football leagues, national team, and local clubs' },
  { name: 'Foodies Kuwait', nameAr: 'الأكل في الكويت', slug: 'foodies-kuwait', type: 'interest', color: '#E91E63', isOfficial: false, description: 'Restaurants, cafes, recipes, and food culture in Kuwait' },
  { name: 'Kuwait Startups', nameAr: 'الشركات الناشئة', slug: 'kuwait-startups', type: 'interest', color: '#607D8B', isOfficial: false, description: 'Entrepreneurs, investors, and the Kuwaiti startup ecosystem' },
  { name: 'Cars Kuwait', nameAr: 'السيارات في الكويت', slug: 'cars-kuwait', type: 'interest', color: '#4CAF50', isOfficial: false, description: 'Car enthusiasts, buying/selling, reviews' },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find or create a system admin user for creator field
    let admin = await User.findOne({ username: 'kuwait_now_admin' });
    if (!admin) {
      admin = await User.create({
        username: 'kuwait_now_admin',
        email: 'admin@kuwaitnow.app',
        password: 'ChangeMe123!',
        name: 'Kuwait Now Admin',
        accountType: 'official',
        isVerified: true,
        verifiedBadge: 'government',
      });
      console.log('Created admin user: kuwait_now_admin');
    }

    // Seed topics
    for (const topicData of DEFAULT_TOPICS) {
      const existing = await Topic.findOne({ slug: topicData.slug });
      if (!existing) {
        await Topic.create(topicData);
        console.log(`Created topic: ${topicData.name}`);
      } else {
        console.log(`Topic exists: ${topicData.name}`);
      }
    }

    // Seed spaces
    for (const spaceData of DEFAULT_SPACES) {
      const existing = await Space.findOne({ slug: spaceData.slug });
      if (!existing) {
        await Space.create({ ...spaceData, creator: admin._id, moderators: [admin._id], members: [admin._id], membersCount: 1 });
        console.log(`Created space: ${spaceData.name}`);
      } else {
        console.log(`Space exists: ${spaceData.name}`);
      }
    }

    console.log('\nSeed complete!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
