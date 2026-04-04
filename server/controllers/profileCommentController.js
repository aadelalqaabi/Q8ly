const ProfileComment = require('../models/ProfileComment');
const User = require('../models/User');

exports.getProfileComments = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select('_id');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const comments = await ProfileComment.find({ profileUser: user._id })
      .populate('author', 'name username profilePic')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, comments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addProfileComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ success: false, message: 'Text required' });

    const profileUser = await User.findOne({ username: req.params.username }).select('_id');
    if (!profileUser) return res.status(404).json({ success: false, message: 'User not found' });

    const comment = await ProfileComment.create({
      profileUser: profileUser._id,
      author: req.user._id,
      text: text.trim(),
    });
    await comment.populate('author', 'name username profilePic');

    res.status(201).json({ success: true, comment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteProfileComment = async (req, res) => {
  try {
    const comment = await ProfileComment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' });

    // Only the comment author or the profile owner can delete
    const isAuthor = comment.author.toString() === req.user._id.toString();
    const isProfileOwner = comment.profileUser.toString() === req.user._id.toString();
    if (!isAuthor && !isProfileOwner) {
      return res.status(403).json({ success: false, message: 'Not allowed' });
    }

    await comment.deleteOne();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
