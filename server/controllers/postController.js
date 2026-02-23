const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Topic = require('../models/Topic');
const Notification = require('../models/Notification');
const Report = require('../models/Report');

// @desc    Get home feed (For You / Following)
// @route   GET /api/posts/feed
// @access  Private
const getFeed = async (req, res, next) => {
  try {
    const { tab = 'for_you', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = { isRemoved: false, visibility: 'public' };

    if (tab === 'following') {
      // Only posts from followed users
      query.userId = { $in: [...req.user.following, req.user._id] };
    } else {
      // For You: mix of followed users, followed topics, and trending
      const followedUserIds = [...req.user.following, req.user._id];
      const followedTopicIds = req.user.followedTopics;
      const mutedTopicIds = req.user.mutedTopics;

      // Exclude blocked users
      const blockedIds = req.user.blockedUsers;

      query = {
        isRemoved: false,
        visibility: { $ne: 'space' }, // don't show space-only posts in main feed
        userId: { $nin: blockedIds },
        ...(mutedTopicIds.length > 0 && { topicTags: { $nin: mutedTopicIds } }),
        $or: [
          { userId: { $in: followedUserIds } },
          { topicTags: { $in: followedTopicIds } },
          { trendingScore: { $gt: 10 } }, // trending posts
        ],
      };
    }

    const posts = await Post.find(query)
      .populate('userId', 'username name profilePic verifiedBadge accountType')
      .populate('topicTags', 'name nameAr slug color')
      .populate('originalPost', 'content images userId')
      .sort(tab === 'following' ? { createdAt: -1 } : { trendingScore: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments(query);

    // Mark which posts are liked by current user
    const postsWithLikeStatus = posts.map((post) => {
      const p = post.toObject();
      p.isLiked = post.likes.includes(req.user._id);
      p.likes = undefined; // don't send full array
      return p;
    });

    res.json({
      success: true,
      posts: postsWithLikeStatus,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get trending posts
// @route   GET /api/posts/trending
// @access  Public
const getTrending = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const posts = await Post.find({ isRemoved: false, visibility: 'public', trendingScore: { $gt: 0 } })
      .populate('userId', 'username name profilePic verifiedBadge accountType')
      .populate('topicTags', 'name nameAr slug color')
      .sort({ trendingScore: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({ success: true, posts });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single post
// @route   GET /api/posts/:id
// @access  Public
const getPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('userId', 'username name profilePic verifiedBadge accountType bio')
      .populate('topicTags', 'name nameAr slug color')
      .populate('spaceTags', 'name nameAr slug type')
      .populate('originalPost', 'content images userId createdAt')
      .populate('communityNote.addedBy', 'username name verifiedBadge');

    if (!post || post.isRemoved) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Increment view count
    await Post.findByIdAndUpdate(req.params.id, { $inc: { viewsCount: 1 } });

    const p = post.toObject();
    p.isLiked = req.user ? post.likes.includes(req.user._id) : false;
    p.likes = undefined;

    res.json({ success: true, post: p });
  } catch (error) {
    next(error);
  }
};

// @desc    Create post
// @route   POST /api/posts
// @access  Private
const createPost = async (req, res, next) => {
  try {
    const { content, type = 'text', images, video, topicTags, spaceTags, visibility, poll, location } = req.body;

    if (!content && (!images || images.length === 0) && !video && !poll) {
      return res.status(400).json({ success: false, message: 'Post must have content, media, or a poll' });
    }

    // Rate limit for new accounts
    if (req.user.isNewAccount) {
      const now = Date.now();
      const user = req.user;
      if (user.postRateLimit.resetAt < now) {
        user.postRateLimit = { count: 0, resetAt: now + 60 * 60 * 1000 }; // reset hourly
      }
      if (user.postRateLimit.count >= 10) {
        return res.status(429).json({ success: false, message: 'Post limit reached for new accounts. Try again later.' });
      }
      user.postRateLimit.count += 1;
      await user.save({ validateBeforeSave: false });
    }

    // Parse hashtags from content
    const hashtags = content ? (content.match(/#[\w\u0600-\u06FF]+/g) || []).map((h) => h.slice(1)) : [];

    const post = await Post.create({
      userId: req.user._id,
      content,
      type,
      images: images || [],
      video,
      topicTags: topicTags || [],
      spaceTags: spaceTags || [],
      visibility: visibility || 'public',
      poll,
      location,
      hashtags,
    });

    // Update topic post counts
    if (topicTags && topicTags.length > 0) {
      await Topic.updateMany({ _id: { $in: topicTags } }, { $inc: { postsCount: 1 } });
    }

    // Update user post count
    await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: 1 } });

    // Populate and return
    const populatedPost = await Post.findById(post._id)
      .populate('userId', 'username name profilePic verifiedBadge accountType')
      .populate('topicTags', 'name nameAr slug color');

    // Emit to followers via socket
    const io = req.app.get('io');
    if (io) {
      req.user.followers.forEach((followerId) => {
        io.to(`user:${followerId}`).emit('newPost', populatedPost);
      });
    }

    res.status(201).json({ success: true, message: 'Post created', post: populatedPost });
  } catch (error) {
    next(error);
  }
};

// @desc    Like / Unlike post
// @route   POST /api/posts/:id/like
// @access  Private
const toggleLike = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.isRemoved) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const userId = req.user._id;
    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      post.likes.pull(userId);
      post.likesCount = Math.max(0, post.likesCount - 1);
    } else {
      post.likes.push(userId);
      post.likesCount += 1;

      // Notify post author (not self-likes)
      if (post.userId.toString() !== userId.toString()) {
        const notification = await Notification.create({
          userId: post.userId,
          type: 'like',
          fromUser: userId,
          post: post._id,
        });

        const io = req.app.get('io');
        if (io) {
          io.to(`user:${post.userId}`).emit('notification', notification);
        }

        // Update post author's likesReceived
        await User.findByIdAndUpdate(post.userId, { $inc: { likesReceived: 1 } });
      }
    }

    // Update trending score
    post.calculateTrendingScore();
    await post.save();

    res.json({ success: true, liked: !isLiked, likesCount: post.likesCount });
  } catch (error) {
    next(error);
  }
};

// @desc    Repost
// @route   POST /api/posts/:id/repost
// @access  Private
const repost = async (req, res, next) => {
  try {
    const originalPost = await Post.findById(req.params.id);
    if (!originalPost || originalPost.isRemoved) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Check not already reposted
    const existingRepost = await Post.findOne({
      userId: req.user._id,
      type: 'repost',
      originalPost: req.params.id,
    });
    if (existingRepost) {
      // Undo repost
      await existingRepost.deleteOne();
      await Post.findByIdAndUpdate(req.params.id, { $inc: { repostsCount: -1 } });
      await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: -1 } });
      return res.json({ success: true, reposted: false });
    }

    const repostDoc = await Post.create({
      userId: req.user._id,
      type: 'repost',
      originalPost: req.params.id,
      content: req.body.comment || '',
      topicTags: originalPost.topicTags,
      visibility: 'public',
    });

    await Post.findByIdAndUpdate(req.params.id, { $inc: { repostsCount: 1 } });
    await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: 1 } });

    // Notify original author
    if (originalPost.userId.toString() !== req.user._id.toString()) {
      const notification = await Notification.create({
        userId: originalPost.userId,
        type: 'repost',
        fromUser: req.user._id,
        post: originalPost._id,
      });
      const io = req.app.get('io');
      if (io) io.to(`user:${originalPost.userId}`).emit('notification', notification);
    }

    res.status(201).json({ success: true, reposted: true, post: repostDoc });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete post
// @route   DELETE /api/posts/:id
// @access  Private
const deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (post.userId.toString() !== req.user._id.toString() && req.user.accountType !== 'official') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this post' });
    }

    post.isRemoved = true;
    post.removedReason = 'deleted_by_user';
    await post.save();

    await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: -1 } });

    res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc    Report a post
// @route   POST /api/posts/:id/report
// @access  Private
const reportPost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.isRemoved) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const { reason, details } = req.body;

    // Check if already reported by this user
    const existingReport = await Report.findOne({
      reportedBy: req.user._id,
      targetPost: post._id,
      targetType: 'post',
    });
    if (existingReport) {
      return res.status(409).json({ success: false, message: 'You have already reported this post' });
    }

    await Report.create({
      reportedBy: req.user._id,
      targetType: 'post',
      targetPost: post._id,
      reason,
      details,
    });

    await Post.findByIdAndUpdate(post._id, { $inc: { reportsCount: 1 }, isReported: true });

    res.json({ success: true, message: 'Report submitted. Our team will review it.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Vote on poll
// @route   POST /api/posts/:id/vote
// @access  Private
const votePoll = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.type !== 'poll') {
      return res.status(404).json({ success: false, message: 'Poll not found' });
    }

    if (post.poll.expiresAt && post.poll.expiresAt < Date.now()) {
      return res.status(400).json({ success: false, message: 'Poll has expired' });
    }

    const { optionIndex } = req.body;
    if (optionIndex === undefined || optionIndex < 0 || optionIndex >= post.poll.options.length) {
      return res.status(400).json({ success: false, message: 'Invalid option' });
    }

    const userId = req.user._id;

    // Check if already voted
    const alreadyVoted = post.poll.options.some((opt) => opt.votes.includes(userId));
    if (alreadyVoted) {
      return res.status(400).json({ success: false, message: 'You have already voted' });
    }

    post.poll.options[optionIndex].votes.push(userId);
    post.poll.options[optionIndex].votesCount += 1;
    post.poll.totalVotes += 1;
    await post.save();

    // Return results without individual voters
    const results = post.poll.options.map((opt) => ({
      text: opt.text,
      votesCount: opt.votesCount,
      percentage: post.poll.totalVotes > 0
        ? Math.round((opt.votesCount / post.poll.totalVotes) * 100)
        : 0,
    }));

    res.json({ success: true, results, totalVotes: post.poll.totalVotes });
  } catch (error) {
    next(error);
  }
};

module.exports = { getFeed, getTrending, getPost, createPost, toggleLike, repost, deletePost, reportPost, votePoll };
