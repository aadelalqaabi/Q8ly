const Event = require('../models/Event');
const User = require('../models/User');

// @desc    Get events
// @route   GET /api/events
// @access  Public
const getEvents = async (req, res, next) => {
  try {
    const { district, category, isFree, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = {
      isActive: true,
      status: { $in: ['upcoming', 'ongoing'] },
      startDate: { $gte: new Date() },
    };

    if (district) query.district = district;
    if (category) query.category = category;
    if (isFree !== undefined) query.isFree = isFree === 'true';

    const events = await Event.find(query)
      .populate('creatorId', 'username name profilePic verifiedBadge')
      .sort({ isFeatured: -1, startDate: 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Event.countDocuments(query);

    res.json({
      success: true,
      events,
      pagination: { page: parseInt(page), limit: parseInt(limit), total },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Public
const getEvent = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('creatorId', 'username name profilePic verifiedBadge')
      .populate('rsvps', 'username name profilePic');

    if (!event || !event.isActive) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    let isRsvped = false;
    if (req.user) {
      isRsvped = event.rsvps.some((r) => r._id.toString() === req.user._id.toString());
    }

    res.json({ success: true, event: { ...event.toObject(), isRsvped } });
  } catch (error) {
    next(error);
  }
};

// @desc    Create event
// @route   POST /api/events
// @access  Private
const createEvent = async (req, res, next) => {
  try {
    const event = await Event.create({ ...req.body, creatorId: req.user._id });
    res.status(201).json({ success: true, event });
  } catch (error) {
    next(error);
  }
};

// @desc    RSVP to event
// @route   POST /api/events/:id/rsvp
// @access  Private
const toggleRsvp = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event || !event.isActive) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    if (event.status === 'past' || event.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot RSVP to this event' });
    }

    const userId = req.user._id;
    const isRsvped = event.rsvps.includes(userId);

    if (isRsvped) {
      event.rsvps.pull(userId);
      event.rsvpCount = Math.max(0, event.rsvpCount - 1);
    } else {
      if (event.maxAttendees && event.rsvpCount >= event.maxAttendees) {
        return res.status(400).json({ success: false, message: 'Event is fully booked' });
      }
      event.rsvps.push(userId);
      event.rsvpCount += 1;
    }

    await event.save();
    res.json({ success: true, rsvped: !isRsvped, rsvpCount: event.rsvpCount });
  } catch (error) {
    next(error);
  }
};

module.exports = { getEvents, getEvent, createEvent, toggleRsvp };
