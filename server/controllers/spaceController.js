const Space = require('../models/Space');
const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');

// @desc    Get all spaces
// @route   GET /api/spaces
// @access  Public
const getSpaces = async (req, res, next) => {
  try {
    const { type, district, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { isActive: true, isPublic: true };
    if (type) query.type = type;
    if (district) query.district = district;

    const spaces = await Space.find(query)
      .populate('creator', 'username name profilePic')
      .sort({ isOfficial: -1, membersCount: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ success: true, spaces });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single space
// @route   GET /api/spaces/:slug
// @access  Public
const getSpace = async (req, res, next) => {
  try {
    const space = await Space.findOne({ slug: req.params.slug, isActive: true })
      .populate('creator', 'username name profilePic')
      .populate('moderators', 'username name profilePic')
      .populate('pinnedPosts', 'content images userId createdAt');

    if (!space) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    let isMember = false;
    let isModerator = false;
    if (req.user) {
      isMember = space.members.includes(req.user._id);
      isModerator = space.moderators.some((m) => m._id.toString() === req.user._id.toString());
    }

    res.json({ success: true, space: { ...space.toObject(), isMember, isModerator } });
  } catch (error) {
    next(error);
  }
};

// @desc    Get space feed
// @route   GET /api/spaces/:slug/feed
// @access  Public
const getSpaceFeed = async (req, res, next) => {
  try {
    const { sort = 'latest', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const space = await Space.findOne({ slug: req.params.slug });
    if (!space) return res.status(404).json({ success: false, message: 'Space not found' });

    const query = { spaceTags: space._id, isRemoved: false };
    const sortOption = sort === 'top'
      ? { trendingScore: -1 }
      : { createdAt: -1 };

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
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create space
// @route   POST /api/spaces
// @access  Private
const createSpace = async (req, res, next) => {
  try {
    const { name, nameAr, slug, description, descriptionAr, type, district, color, rules } = req.body;

    const existing = await Space.findOne({ slug });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A space with this slug already exists' });
    }

    const space = await Space.create({
      name,
      nameAr,
      slug,
      description,
      descriptionAr,
      type,
      district: type === 'location' ? district : null,
      color,
      rules: rules || [],
      creator: req.user._id,
      moderators: [req.user._id],
      members: [req.user._id],
      membersCount: 1,
    });

    // Add to user's joined spaces
    await User.findByIdAndUpdate(req.user._id, { $push: { joinedSpaces: space._id } });

    res.status(201).json({ success: true, space });
  } catch (error) {
    next(error);
  }
};

// @desc    Join / Leave space
// @route   POST /api/spaces/:id/join
// @access  Private
const toggleJoin = async (req, res, next) => {
  try {
    const space = await Space.findById(req.params.id);
    if (!space || !space.isActive) {
      return res.status(404).json({ success: false, message: 'Space not found' });
    }

    const user = await User.findById(req.user._id);
    const isMember = space.members.includes(user._id);

    if (isMember) {
      space.members.pull(user._id);
      space.membersCount = Math.max(0, space.membersCount - 1);
      user.joinedSpaces.pull(space._id);
    } else {
      space.members.push(user._id);
      space.membersCount += 1;
      user.joinedSpaces.push(space._id);

      // Notify space
      const io = req.app.get('io');
      if (io) {
        io.to(`space:${space._id}`).emit('newMember', {
          spaceId: space._id,
          user: { username: user.username, name: user.name, profilePic: user.profilePic },
        });
      }
    }

    await space.save();
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, joined: !isMember, membersCount: space.membersCount });
  } catch (error) {
    next(error);
  }
};

// @desc    Search spaces
// @route   GET /api/spaces/search
// @access  Public
const searchSpaces = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ success: false, message: 'Query required' });

    const escaped = String(q).trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const spaces = await Space.find({
      isActive: true,
      isPublic: true,
      $or: [{ name: regex }, { nameAr: regex }, { description: regex }],
    })
      .sort({ membersCount: -1 })
      .limit(20);

    res.json({ success: true, spaces });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSpaces, getSpace, getSpaceFeed, createSpace, toggleJoin, searchSpaces };
