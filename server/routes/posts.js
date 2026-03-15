const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const {
  getFeed, getTrending, getPost, createPost,
  toggleLike, repost, deletePost, reportPost, votePoll, searchPosts,
  toggleBookmark,
} = require('../controllers/postController');
const { getComments, addComment, likeComment, deleteComment } = require('../controllers/commentController');

// Feed and discovery
router.get('/feed', optionalAuth, getFeed);
router.get('/trending', optionalAuth, getTrending);
router.get('/search', optionalAuth, searchPosts);
// Single post
router.get('/:id', optionalAuth, getPost);

// Create post
router.post(
  '/',
  protect,
  [
    body('content').optional().isLength({ max: 500 }).withMessage('Content cannot exceed 500 characters'),
    body('type').optional().isIn(['text', 'photo', 'video', 'poll', 'event', 'offer']),
    body('visibility').optional().isIn(['public', 'followers', 'space']),
  ],
  validate,
  createPost
);

// Interactions
router.post('/:id/like', protect, toggleLike);
router.post('/:id/bookmark', protect, toggleBookmark);
router.post('/:id/repost', protect, repost);
router.delete('/:id', protect, deletePost);
router.post('/:id/report', protect, [
  body('reason').isIn(['harassment', 'hate_speech', 'fake_news', 'spam', 'explicit_content', 'privacy', 'violence', 'other']),
], validate, reportPost);
router.post('/:id/vote', protect, [
  body('optionIndex').isInt({ min: 0 }),
], validate, votePoll);

// Comments
router.get('/:id/comments', optionalAuth, getComments);
router.post(
  '/:id/comments',
  protect,
  [body('content').trim().isLength({ min: 1, max: 300 }).withMessage('Comment must be 1–300 characters')],
  validate,
  addComment
);
router.post('/:postId/comments/:id/like', protect, likeComment);
router.delete('/:postId/comments/:id', protect, deleteComment);

module.exports = router;
