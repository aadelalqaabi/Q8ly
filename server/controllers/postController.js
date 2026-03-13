const mongoose = require('mongoose');
const Post = require('../models/Post');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Topic = require('../models/Topic');
const Notification = require('../models/Notification');
const Report = require('../models/Report');
const { checkContent } = require('../utils/contentFilter');
const { sendToUser } = require('../services/pushService');

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
      // For You: all public posts, excluding blocked users and muted topics
      const blockedIds = req.user.blockedUsers || [];
      const mutedTopicIds = req.user.mutedTopics || [];
      query = {
        isRemoved: false,
        visibility: { $ne: 'space' },
        userId: { $nin: blockedIds },
        ...(mutedTopicIds.length > 0 && { topicTags: { $nin: mutedTopicIds } }),
      };
    }

    const limitInt = parseInt(limit);
    const posts = await Post.find(query)
      .lean()
      .populate('userId', 'username name profilePic verifiedBadge accountType')
      .populate('topicTags', 'name nameAr slug color')
      .populate({ path: 'originalPost', select: 'content images video videoThumbnail userId createdAt', populate: { path: 'userId', select: 'username name profilePic verifiedBadge' } })
      .sort(tab === 'following' ? { createdAt: -1 } : { trendingScore: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitInt);

    // Mark which posts are liked / bookmarked by current user
    const userIdStr = req.user._id.toString();
    const userBookmarks = (req.user.bookmarks || []).map((id) => id.toString());
    const postsWithLikeStatus = posts.map((post) => {
      post.isLiked = post.likes ? post.likes.some((id) => id.toString() === userIdStr) : false;
      post.isBookmarked = userBookmarks.includes(post._id.toString());
      post.likes = undefined;
      return post;
    });

    // Hot stranger posts — velocity-based, last 24h, outside the user's network
    let hotPosts = [];
    if (tab !== 'following' && parseInt(page) === 1) {
      const followedUserIds = [...req.user.following, req.user._id];
      const blockedIds = req.user.blockedUsers || [];
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const rawHot = await Post.find({
        isRemoved: false,
        visibility: 'public',
        userId: { $nin: [...followedUserIds, ...blockedIds] },
        createdAt: { $gt: since },
        trendingScore: { $gt: 2 },
      })
        .lean()
        .populate('userId', 'username name profilePic verifiedBadge accountType')
        .sort({ trendingScore: -1 })
        .limit(6);

      hotPosts = rawHot.map((post) => {
        post.isLiked = post.likes ? post.likes.some((id) => id.toString() === userIdStr) : false;
        post.likes = undefined;
        return post;
      });
    }

    res.json({
      success: true,
      posts: postsWithLikeStatus,
      hotPosts,
      pagination: {
        page: parseInt(page),
        limit: limitInt,
        hasMore: posts.length === limitInt,
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
      .lean()
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
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }
    const post = await Post.findById(req.params.id)
      .lean()
      .populate('userId', 'username name profilePic verifiedBadge accountType bio')
      .populate('topicTags', 'name nameAr slug color')
      .populate('spaceTags', 'name nameAr slug type')
      .populate({ path: 'originalPost', select: 'content images video videoThumbnail userId createdAt', populate: { path: 'userId', select: 'username name profilePic verifiedBadge' } })
      .populate('communityNote.addedBy', 'username name verifiedBadge');

    if (!post || post.isRemoved) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    // Increment view count (fire-and-forget — don't await, not on the critical path)
    Post.findByIdAndUpdate(req.params.id, { $inc: { viewsCount: 1 } }).exec();

    post.isLiked = req.user && post.likes
      ? post.likes.some((id) => id.toString() === req.user._id.toString())
      : false;
    post.likes = undefined;

    res.json({ success: true, post });
  } catch (error) {
    next(error);
  }
};

// @desc    Create post
// @route   POST /api/posts
// @access  Private
const createPost = async (req, res, next) => {
  try {
    const { content, type = 'text', images, video, videoThumbnail, topicTags, spaceTags, visibility, poll, location } = req.body;

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

    // Content moderation
    if (content) {
      const { isBlocked, isFlagged } = checkContent(content);
      if (isBlocked) {
        return res.status(400).json({ success: false, message: 'يحتوي منشورك على محتوى مسيء. يرجى مراجعة قواعد المجتمع.' });
      }
      if (isFlagged) {
        req._flaggedPost = true;
      }
    }

    // Parse hashtags from content
    const hashtags = content ? (content.match(/#[\w\u0600-\u06FF]+/g) || []).map((h) => h.slice(1)) : [];

    const post = await Post.create({
      userId: req.user._id,
      content,
      type,
      images: images || [],
      video,
      videoThumbnail: videoThumbnail || null,
      topicTags: topicTags || [],
      spaceTags: spaceTags || [],
      visibility: visibility || 'public',
      poll,
      location,
      hashtags,
      isReported: req._flaggedPost ? true : false,
      reportsCount: req._flaggedPost ? 1 : 0,
    });

    // Update topic post counts
    if (topicTags && topicTags.length > 0) {
      await Topic.updateMany({ _id: { $in: topicTags } }, { $inc: { postsCount: 1 } });
    }

    // Update user post count + award hachiPoints
    await User.findByIdAndUpdate(req.user._id, { $inc: { postsCount: 1, hachiPoints: 2 } });

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

    // Push notification to users who subscribed to this account's posts
    const subscribers = await User.find({
      postNotifications: req.user._id,
      expoPushToken: { $exists: true, $ne: null },
    }).select('expoPushToken').lean();

    if (subscribers.length > 0) {
      const excerpt = post.content?.trim().slice(0, 80) || 'New post';
      const messages = subscribers.map((u) => ({
        to: u.expoPushToken,
        title: `@${req.user.username}`,
        body: excerpt,
        sound: 'default',
        data: { type: 'new_post', postId: post._id.toString() },
      }));
      const { sendPush } = require('../services/pushService');
      for (let i = 0; i < messages.length; i += 100) {
        sendPush(messages.slice(i, i + 100));
      }
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

    // Cannot like your own post
    if (post.userId.toString() === userId.toString()) {
      return res.status(403).json({ success: false, message: 'You cannot like your own post' });
    }

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

        // Push notification
        const postAuthor = await User.findById(post.userId).select('expoPushToken notificationSettings');
        sendToUser(
          postAuthor, 'likes',
          'New like',
          `@${req.user.username} liked your post`,
          { type: 'like', postId: post._id.toString() }
        );

        // Update post author's likesReceived + award hachiPoints
        await User.findByIdAndUpdate(post.userId, { $inc: { likesReceived: 1, hachiPoints: 1 } });
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

    if (post.userId.toString() !== req.user._id.toString()) {
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

    // Find previous vote index (if any)
    const prevIndex = post.poll.options.findIndex((opt) =>
      opt.votes.some((v) => v.toString() === userId.toString())
    );

    if (prevIndex !== -1) {
      // Remove previous vote
      post.poll.options[prevIndex].votes = post.poll.options[prevIndex].votes.filter(
        (v) => v.toString() !== userId.toString()
      );
      post.poll.options[prevIndex].votesCount = Math.max(0, post.poll.options[prevIndex].votesCount - 1);
      post.poll.totalVotes = Math.max(0, post.poll.totalVotes - 1);
    }

    let action = 'unvoted';
    if (prevIndex !== optionIndex) {
      // Add vote to new option (different option or first-time vote)
      post.poll.options[optionIndex].votes.push(userId);
      post.poll.options[optionIndex].votesCount += 1;
      post.poll.totalVotes += 1;
      action = prevIndex === -1 ? 'voted' : 'changed';
    }

    await post.save();

    // Return results without individual voters
    const results = post.poll.options.map((opt) => ({
      text: opt.text,
      votesCount: opt.votesCount,
      percentage: post.poll.totalVotes > 0
        ? Math.round((opt.votesCount / post.poll.totalVotes) * 100)
        : 0,
    }));

    res.json({ success: true, action, results, totalVotes: post.poll.totalVotes });
  } catch (error) {
    next(error);
  }
};

// @desc    Search posts by content
// @route   GET /api/posts/search?q=...
// @access  Public
const searchPosts = async (req, res, next) => {
  try {
    const { q = '', page = 1, limit = 20 } = req.query;
    if (!q.trim()) return res.json({ success: true, posts: [], total: 0 });
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const escaped = q.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    const filter = { isRemoved: false, visibility: 'public', content: { $regex: regex } };
    const [posts, total] = await Promise.all([
      Post.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('userId', 'name username profilePic verifiedBadge'),
      Post.countDocuments(filter),
    ]);
    res.json({ success: true, posts, total });
  } catch (error) {
    next(error);
  }
};

// @desc    Bookmark / Unbookmark post
// @route   POST /api/posts/:id/bookmark
// @access  Private
const toggleBookmark = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.isRemoved) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const user = await User.findById(req.user._id);
    const isBookmarked = user.bookmarks.some((id) => id.toString() === req.params.id);

    // Use explicit client intent when provided; fall back to toggle
    const intent = req.body?.bookmarked;
    const targetState = intent !== undefined ? Boolean(intent) : !isBookmarked;

    if (targetState && !isBookmarked) {
      user.bookmarks.push(req.params.id);
    } else if (!targetState && isBookmarked) {
      user.bookmarks.pull(req.params.id);
    }
    await user.save({ validateBeforeSave: false });

    // Invalidate the auth cache so the next feed request reflects the new bookmark state
    const { invalidateUserCache } = require('../middleware/auth');
    invalidateUserCache(req.user._id);

    res.json({ success: true, bookmarked: targetState });
  } catch (error) {
    next(error);
  }
};

// @desc    Get bookmarked posts
// @route   GET /api/posts/bookmarks
// @access  Private
const getBookmarks = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const user = await User.findById(req.user._id).select('bookmarks');
    // Filter out any corrupted non-ObjectId entries before querying
    const bookmarkIds = (user.bookmarks || []).filter((id) => mongoose.Types.ObjectId.isValid(id.toString()));
    // Reverse so newest-bookmarked comes first
    const sliced = [...bookmarkIds].reverse().slice(skip, skip + parseInt(limit));

    const posts = await Post.find({ _id: { $in: sliced }, isRemoved: false })
      .lean()
      .populate('userId', 'username name profilePic verifiedBadge accountType')
      .populate('topicTags', 'name nameAr slug color')
      .populate({ path: 'originalPost', select: 'content images video videoThumbnail userId createdAt', populate: { path: 'userId', select: 'username name profilePic verifiedBadge' } });

    // Restore order
    const ordered = sliced.map((id) => posts.find((p) => p._id.toString() === id.toString())).filter(Boolean);
    const userIdStr = req.user._id.toString();
    ordered.forEach((p) => { p.isLiked = p.likes?.some((id) => id.toString() === userIdStr) || false; p.likes = undefined; p.isBookmarked = true; });

    res.json({ success: true, posts: ordered, hasMore: skip + sliced.length < bookmarkIds.length });
  } catch (error) {
    next(error);
  }
};

module.exports = { getFeed, getTrending, getPost, createPost, toggleLike, repost, deletePost, reportPost, votePoll, searchPosts, toggleBookmark, getBookmarks };
