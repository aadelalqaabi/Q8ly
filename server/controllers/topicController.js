const Topic = require('../models/Topic');
const Post = require('../models/Post');
const User = require('../models/User');

// @desc    Get trending topics
// @route   GET /api/topics/trending
// @access  Public
const getTrending = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;

    const topics = await Topic.find({ isActive: true })
      .sort({ trendingScore: -1, followersCount: -1 })
      .limit(parseInt(limit));

    res.json({ success: true, topics });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all topics by category
// @route   GET /api/topics
// @access  Public
const getTopics = async (req, res, next) => {
  try {
    const { category, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { isActive: true };
    if (category) query.category = category;

    const topics = await Topic.find(query)
      .sort({ isOfficial: -1, followersCount: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ success: true, topics });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single topic
// @route   GET /api/topics/:slug
// @access  Public
const getTopic = async (req, res, next) => {
  try {
    const topic = await Topic.findOne({ slug: req.params.slug, isActive: true })
      .populate('pinnedPost', 'content images userId createdAt');

    if (!topic) {
      return res.status(404).json({ success: false, message: 'Topic not found' });
    }

    // Check if current user follows this topic
    let isFollowing = false;
    if (req.user) {
      isFollowing = req.user.followedTopics.includes(topic._id);
    }

    res.json({ success: true, topic: { ...topic.toObject(), isFollowing } });
  } catch (error) {
    next(error);
  }
};

// @desc    Get posts for a topic
// @route   GET /api/topics/:slug/posts
// @access  Public
const getTopicPosts = async (req, res, next) => {
  try {
    const { sort = 'top', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const topic = await Topic.findOne({ slug: req.params.slug });
    if (!topic) {
      return res.status(404).json({ success: false, message: 'Topic not found' });
    }

    const query = { topicTags: topic._id, isRemoved: false, visibility: 'public' };
    const sortOption = sort === 'latest' ? { createdAt: -1 } : { trendingScore: -1, createdAt: -1 };

    const posts = await Post.find(query)
      .populate('userId', 'username name profilePic verifiedBadge accountType')
      .populate('topicTags', 'name nameAr slug color')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments(query);

    res.json({
      success: true,
      posts,
      topic,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Follow / Unfollow topic
// @route   POST /api/topics/:id/follow
// @access  Private
const toggleFollow = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });

    const user = await User.findById(req.user._id);
    const isFollowing = user.followedTopics.includes(topic._id);

    if (isFollowing) {
      user.followedTopics.pull(topic._id);
      topic.followersCount = Math.max(0, topic.followersCount - 1);
    } else {
      user.followedTopics.push(topic._id);
      topic.followersCount += 1;
    }

    await user.save({ validateBeforeSave: false });
    await topic.save();

    res.json({ success: true, following: !isFollowing, followersCount: topic.followersCount });
  } catch (error) {
    next(error);
  }
};

// @desc    Mute / Unmute topic
// @route   POST /api/topics/:id/mute
// @access  Private
const toggleMute = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return res.status(404).json({ success: false, message: 'Topic not found' });

    const user = await User.findById(req.user._id);
    const isMuted = user.mutedTopics.includes(topic._id);

    if (isMuted) {
      user.mutedTopics.pull(topic._id);
    } else {
      user.mutedTopics.push(topic._id);
      // Unfollow if muting
      if (user.followedTopics.includes(topic._id)) {
        user.followedTopics.pull(topic._id);
        topic.followersCount = Math.max(0, topic.followersCount - 1);
        await topic.save();
      }
    }

    await user.save({ validateBeforeSave: false });
    res.json({ success: true, muted: !isMuted });
  } catch (error) {
    next(error);
  }
};

// @desc    Search topics
// @route   GET /api/topics/search
// @access  Public
const searchTopics = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, message: 'Query required' });

    const regex = new RegExp(q, 'i');
    const topics = await Topic.find({
      isActive: true,
      $or: [{ name: regex }, { nameAr: regex }, { slug: regex }],
    })
      .sort({ followersCount: -1 })
      .limit(20);

    res.json({ success: true, topics });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTrending, getTopics, getTopic, getTopicPosts, toggleFollow, toggleMute, searchTopics };
