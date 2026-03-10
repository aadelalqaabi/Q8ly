const mongoose = require('mongoose');

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('FATAL: MONGODB_URI environment variable is not set.');
    process.exit(1);
  }
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`MongoDB connected: ${conn.connection.host}`);

    // Create performance-critical indexes
    await createIndexes();
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const createIndexes = async () => {
  try {
    const db = mongoose.connection.db;

    // Users
    await db.collection('users').createIndex({ username: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });

    // Posts
    await db.collection('posts').createIndex({ createdAt: -1, topicTags: 1 });
    await db.collection('posts').createIndex({ userId: 1, createdAt: -1 });
    await db.collection('posts').createIndex({ trendingScore: -1 });

    // Comments
    await db.collection('comments').createIndex({ postId: 1, createdAt: -1 });

    // Notifications
    await db.collection('notifications').createIndex({ userId: 1, read: 1 });
    await db.collection('notifications').createIndex({ createdAt: -1 });

    // Topics
    await db.collection('topics').createIndex({ slug: 1 }, { unique: true });
    await db.collection('topics').createIndex({ trendingScore: -1 });

    console.log('Database indexes created successfully');
  } catch (error) {
    console.error('Error creating indexes:', error.message);
  }
};

module.exports = connectDB;
