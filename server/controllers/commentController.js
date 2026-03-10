const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const User = require('../models/User');
const { sendToUser } = require('../services/pushService');

// @desc    Get comments for a post
// @route   GET /api/posts/:id/comments
// @access  Public
const getComments = async (req, res, next) => {
  try {
    const { sort = 'top', page = 1, limit = 20, parentId = null } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      postId: req.params.id,
      parentId: parentId ? parentId : null,
      isRemoved: false,
    };

    const sortOption = sort === 'top'
      ? { likesCount: -1, createdAt: -1 }
      : { createdAt: -1 };

    const comments = await Comment.find(query)
      .populate('userId', 'username name profilePic verifiedBadge accountType')
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Comment.countDocuments(query);

    // Mark liked by current user
    const commentsWithStatus = comments.map((c) => {
      const obj = c.toObject();
      obj.isLiked = req.user ? c.likes.includes(req.user._id) : false;
      obj.likes = undefined;
      return obj;
    });

    res.json({
      success: true,
      comments: commentsWithStatus,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add comment
// @route   POST /api/posts/:id/comments
// @access  Private
const addComment = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post || post.isRemoved) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const { content, parentId } = req.body;

    let depth = 0;
    if (parentId) {
      const parent = await Comment.findById(parentId);
      if (!parent) {
        return res.status(404).json({ success: false, message: 'Parent comment not found' });
      }
      depth = Math.min(parent.depth + 1, 2);
    }

    const comment = await Comment.create({
      postId: req.params.id,
      userId: req.user._id,
      content,
      parentId: parentId || null,
      depth,
    });

    // Update counts + award hachiPoints to commenter
    await Post.findByIdAndUpdate(req.params.id, { $inc: { commentsCount: 1 } });
    await User.findByIdAndUpdate(req.user._id, { $inc: { hachiPoints: 1 } });
    if (parentId) {
      await Comment.findByIdAndUpdate(parentId, { $inc: { repliesCount: 1 } });
    }

    // Update trending score
    const updatedPost = await Post.findById(req.params.id);
    updatedPost.calculateTrendingScore();
    await updatedPost.save();

    // Notify post author
    if (post.userId.toString() !== req.user._id.toString()) {
      const notification = await Notification.create({
        userId: post.userId,
        type: parentId ? 'reply' : 'comment',
        fromUser: req.user._id,
        post: post._id,
        comment: comment._id,
      });
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${post.userId}`).emit('notification', notification);
        io.to(`post:${post._id}`).emit('newComment', {
          comment: await comment.populate('userId', 'username name profilePic verifiedBadge'),
          postId: post._id,
        });
      }

      // Push notification
      const postAuthor = await User.findById(post.userId).select('expoPushToken notificationSettings');
      sendToUser(
        postAuthor, 'comments',
        parentId ? 'New reply' : 'New comment',
        `@${req.user.username} ${parentId ? 'replied to your comment' : 'commented on your post'}`,
        { type: parentId ? 'reply' : 'comment', postId: post._id.toString() }
      );
    }

    // If it's a reply, notify parent comment author
    if (parentId) {
      const parentComment = await Comment.findById(parentId);
      if (parentComment && parentComment.userId.toString() !== req.user._id.toString()) {
        await Notification.create({
          userId: parentComment.userId,
          type: 'reply',
          fromUser: req.user._id,
          post: post._id,
          comment: comment._id,
        });
      }
    }

    const populated = await comment.populate('userId', 'username name profilePic verifiedBadge accountType');
    res.status(201).json({ success: true, comment: populated });
  } catch (error) {
    next(error);
  }
};

// @desc    Like/unlike comment
// @route   POST /api/posts/:postId/comments/:id/like
// @access  Private
const likeComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment || comment.isRemoved) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    const userId = req.user._id;
    const isLiked = comment.likes.includes(userId);

    if (isLiked) {
      comment.likes.pull(userId);
      comment.likesCount = Math.max(0, comment.likesCount - 1);
    } else {
      comment.likes.push(userId);
      comment.likesCount += 1;
    }

    await comment.save();
    res.json({ success: true, liked: !isLiked, likesCount: comment.likesCount });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete comment
// @route   DELETE /api/posts/:postId/comments/:id
// @access  Private
const deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (comment.userId.toString() !== req.user._id.toString() && req.user.accountType !== 'official') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    comment.isRemoved = true;
    comment.removedReason = 'deleted_by_user';
    await comment.save();

    await Post.findByIdAndUpdate(comment.postId, { $inc: { commentsCount: -1 } });

    res.json({ success: true, message: 'Comment deleted' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getComments, addComment, likeComment, deleteComment };
