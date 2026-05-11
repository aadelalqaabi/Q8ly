const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { checkContent } = require('../utils/contentFilter');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: [
        process.env.CLIENT_URL,
        process.env.FRONTEND_URL,
        'http://localhost:19000',
        'http://localhost:3000',
        /^exp:\/\//,
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Auth middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        socket.user = null;
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('_id username name profilePic verifiedBadge phone isFounder');

      if (!user) {
        socket.user = null;
        return next();
      }

      socket.user = user;
      next();
    } catch (error) {
      socket.user = null;
      next();
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?._id;

    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`[socket] ${socket.user.username} connected → joined user:${userId} (socket: ${socket.id})`);
    }

    // ── Space rooms ──────────────────────────────────────────────
    socket.on('joinSpace', (spaceId) => {
      if (!isValidObjectId(spaceId)) return;
      socket.join(`space:${spaceId}`);
    });

    socket.on('leaveSpace', (spaceId) => {
      if (!isValidObjectId(spaceId)) return;
      socket.leave(`space:${spaceId}`);
    });

    // ── Post rooms (for live comments) ───────────────────────────
    socket.on('joinPost', (postId) => {
      if (!isValidObjectId(postId)) return;
      socket.join(`post:${postId}`);
    });

    socket.on('leavePost', (postId) => {
      if (!isValidObjectId(postId)) return;
      socket.leave(`post:${postId}`);
    });

    // ── Typing indicators ─────────────────────────────────────────
    socket.on('typing', ({ postId, isTyping }) => {
      if (!socket.user) return;
      socket.to(`post:${postId}`).emit('typing', {
        postId,
        user: { username: socket.user.username, name: socket.user.name },
        isTyping,
      });
    });

    // ── Hachi rooms ───────────────────────────────────────────────
    socket.on('joinHachi', async (roomId) => {
      if (!isValidObjectId(roomId)) return;
      try {
        const Hachi = require('../models/Hachi');
        const room = await Hachi.findById(roomId).select('isPublic creator members blockedMembers joinRequests');

        if (room && socket.user) {
          const uid = socket.user._id.toString();

          // Blocked users cannot join
          if (room.blockedMembers.some((b) => b.toString() === uid)) {
            socket.emit('hachiError', { message: 'لقد تم إزالتك من هذا النقاش.' });
            return;
          }

          const isCreator = room.creator.toString() === uid;
          const isMember = room.members.some((m) => m.toString() === uid);

          // Private room: only creator and approved members can join
          if (!room.isPublic && !isCreator && !isMember) {
            const alreadyRequested = room.joinRequests.some((r) => r.user.toString() === uid);
            if (!alreadyRequested) {
              room.joinRequests.push({
                user: socket.user._id,
                name: socket.user.name,
                username: socket.user.username,
                requestedAt: new Date(),
              });
              await room.save();
            }
            // Notify creator
            io.to(`user:${room.creator.toString()}`).emit('hachiJoinRequest', {
              roomId,
              user: { _id: socket.user._id, name: socket.user.name, username: socket.user.username },
            });
            socket.emit('hachiWaitingApproval', { roomId });
            return;
          }
        }

        socket.join(`hachi:${roomId}`);
        // Broadcast updated online count
        const onlineCount = io.sockets.adapter.rooms.get(`hachi:${roomId}`)?.size || 0;
        io.to(`hachi:${roomId}`).emit('hachiMemberCount', { roomId, count: onlineCount });
      } catch (err) {
        console.error('joinHachi error:', err.message);
        socket.join(`hachi:${roomId}`);
      }
    });

    socket.on('leaveHachi', (roomId) => {
      socket.leave(`hachi:${roomId}`);
      // Broadcast updated online count
      const onlineCount = io.sockets.adapter.rooms.get(`hachi:${roomId}`)?.size || 0;
      io.to(`hachi:${roomId}`).emit('hachiMemberCount', { roomId, count: onlineCount });
    });

    socket.on('hachiSend', async ({ roomId, text, replyTo, lat, lng, speed, anonymous }) => {
      if (!socket.user || !text?.trim()) return;
      try {
        const { isBlocked } = checkContent(text.trim());
        if (isBlocked) {
          socket.emit('hachiError', { message: 'رسالتك تحتوي على محتوى مسيء ولم يتم إرسالها.' });
          return;
        }

        const Hachi = require('../models/Hachi');
        const { computeConfidence } = require('../utils/locationUtils');
        const mongoose = require('mongoose');
        const uid = socket.user._id.toString();
        const now = new Date();
        const msgId = new mongoose.Types.ObjectId();
        const isAnon = !!anonymous;

        const msgData = { _id: msgId, user: socket.user._id, text: text.trim(), anonymous: isAnon, reactions: [], createdAt: now };
        if (replyTo?.messageId && replyTo?.userName) {
          msgData.replyTo = { messageId: replyTo.messageId, text: replyTo.text || '', userName: replyTo.userName };
        }

        const room = await Hachi.findById(roomId).select('blockedMembers members memberCount isVenueCircle venueCoords venueRadius').lean();
        if (!room) return;
        if ((room.blockedMembers || []).some((b) => b.toString() === uid)) return;

        const isNewMember = !(room.members || []).some((m) => m.toString() === uid);

        const pushOps = { messages: { $each: [msgData], $slice: -500 } };
        const isVenue = room.isVenueCircle && room.venueCoords?.lat;
        if (isVenue && lat != null && lng != null) {
          const confidence = computeConfidence(
            parseFloat(lat), parseFloat(lng), parseFloat(speed) || 0,
            room.venueCoords, room.venueRadius || 250
          );
          if (confidence >= 0.3) {
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
            await Hachi.findByIdAndUpdate(roomId, { $pull: { hereNow: { userId: socket.user._id } } });
            pushOps.hereNow = { userId: socket.user._id, confidence, expiresAt };
          }
        }

        const updated = await Hachi.findByIdAndUpdate(
          roomId,
          {
            $push: pushOps,
            $set: { lastMessage: { text: text.trim(), createdAt: now } },
            $addToSet: { members: socket.user._id },
            ...(isNewMember ? { $inc: { memberCount: 1 } } : {}),
          },
          { new: false }
        );
        if (!updated) return;

        const populated = {
          _id: msgId,
          text: text.trim(),
          anonymous: isAnon,
          reactions: [],
          createdAt: now,
          replyTo: msgData.replyTo || null,
          user: isAnon
            ? { _id: socket.user._id }
            : { _id: socket.user._id, name: socket.user.name, username: socket.user.username, profilePic: socket.user.profilePic },
        };
        io.to(`hachi:${roomId}`).emit('hachiMessage', { roomId, message: populated });
      } catch (err) {
        console.error('hachiSend error:', err.message);
      }
    });

    socket.on('hachiSendVoice', async ({ roomId, voiceUrl, voiceDuration }) => {
      if (!socket.user || !voiceUrl) return;
      try {
        const Hachi = require('../models/Hachi');
        const mongoose = require('mongoose');
        const now = new Date();
        const msgId = new mongoose.Types.ObjectId();
        const msgData = { _id: msgId, user: socket.user._id, voiceUrl, voiceDuration: voiceDuration || 0, reactions: [], createdAt: now };

        const updated = await Hachi.findOneAndUpdate(
          { _id: roomId, isActive: true },
          {
            $push: { messages: { $each: [msgData], $slice: -500 } },
            $addToSet: { members: socket.user._id },
          },
          { new: false }
        );
        if (!updated) return;

        const populated = {
          _id: msgId, voiceUrl, voiceDuration: voiceDuration || 0, reactions: [], createdAt: now,
          user: { _id: socket.user._id, name: socket.user.name, username: socket.user.username, profilePic: socket.user.profilePic },
        };
        io.to(`hachi:${roomId}`).emit('hachiMessage', { roomId, message: populated });
      } catch (err) {
        console.error('hachiSendVoice error:', err.message);
      }
    });

    // ── Send image in circle ──────────────────────────────────────
    socket.on('hachiSendImage', async ({ roomId, imageUrl, isLive = false, lat, lng, speed }) => {
      if (!socket.user || !imageUrl) return;
      try {
        const Hachi = require('../models/Hachi');
        const { computeConfidence } = require('../utils/locationUtils');
        const mongoose = require('mongoose');
        const now = new Date();
        const msgId = new mongoose.Types.ObjectId();
        const msgData = { _id: msgId, user: socket.user._id, image: imageUrl, isLive: !!isLive, reactions: [], createdAt: now };

        const roomCheck = await Hachi.findById(roomId).select('isActive blockedMembers members isVenueCircle venueCoords venueRadius').lean();
        if (!roomCheck || !roomCheck.isActive) return;
        const uid2 = socket.user._id.toString();
        if ((roomCheck.blockedMembers || []).some((b) => b.toString() === uid2)) return;
        const isNew2 = !(roomCheck.members || []).some((m) => m.toString() === uid2);

        // Presence update (same logic as text send) — must merge into one $push op
        const pushOps = { messages: { $each: [msgData], $slice: -500 } };
        const isVenue = roomCheck.isVenueCircle && roomCheck.venueCoords?.lat;
        if (isVenue && lat != null && lng != null) {
          const confidence = computeConfidence(parseFloat(lat), parseFloat(lng), parseFloat(speed) || 0, roomCheck.venueCoords, roomCheck.venueRadius || 250);
          if (confidence >= 0.3) {
            const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
            await Hachi.findByIdAndUpdate(roomId, { $pull: { hereNow: { userId: socket.user._id } } });
            pushOps.hereNow = { userId: socket.user._id, confidence, expiresAt };
          }
        }

        const updated = await Hachi.findByIdAndUpdate(
          roomId,
          {
            $push: pushOps,
            $set: { lastMessage: { text: '📷', createdAt: now } },
            $addToSet: { members: socket.user._id },
            ...(isNew2 ? { $inc: { memberCount: 1 } } : {}),
          },
          { new: false }
        );
        if (!updated) return;

        const populated = {
          _id: msgId, image: imageUrl, isLive: !!isLive, reactions: [], createdAt: now,
          user: { _id: socket.user._id, name: socket.user.name, username: socket.user.username, profilePic: socket.user.profilePic },
        };
        io.to(`hachi:${roomId}`).emit('hachiMessage', { roomId, message: populated });
      } catch (err) {
        console.error('hachiSendImage error:', err.message);
      }
    });

    // ── Send video in circle ──────────────────────────────────────
    socket.on('hachiSendVideo', async ({ roomId, videoUrl, videoThumbnail, isLive = false }) => {
      if (!socket.user || !videoUrl) return;
      try {
        const Hachi = require('../models/Hachi');
        const mongoose = require('mongoose');
        const now = new Date();
        const msgId = new mongoose.Types.ObjectId();
        const msgData = { _id: msgId, user: socket.user._id, video: videoUrl, videoThumbnail: videoThumbnail || '', isLive: !!isLive, reactions: [], createdAt: now };

        const roomCheck3 = await Hachi.findById(roomId).select('isActive blockedMembers members').lean();
        if (!roomCheck3 || !roomCheck3.isActive) return;
        const uid3 = socket.user._id.toString();
        if ((roomCheck3.blockedMembers || []).some((b) => b.toString() === uid3)) return;
        const isNew3 = !(roomCheck3.members || []).some((m) => m.toString() === uid3);

        const updated = await Hachi.findByIdAndUpdate(
          roomId,
          {
            $push: { messages: { $each: [msgData], $slice: -500 } },
            $set: { lastMessage: { text: '🎥', createdAt: now } },
            $addToSet: { members: socket.user._id },
            ...(isNew3 ? { $inc: { memberCount: 1 } } : {}),
          },
          { new: false }
        );
        if (!updated) return;

        const populated = {
          _id: msgId, video: videoUrl, videoThumbnail: videoThumbnail || '', isLive: !!isLive,
          reactions: [], createdAt: now,
          user: { _id: socket.user._id, name: socket.user.name, username: socket.user.username, profilePic: socket.user.profilePic },
        };
        io.to(`hachi:${roomId}`).emit('hachiMessage', { roomId, message: populated });
      } catch (err) {
        console.error('hachiSendVideo error:', err.message);
      }
    });

    // ── Delete own message ──────────────────────────────────────────
    socket.on('hachiDeleteMessage', async ({ roomId, messageId }) => {
      if (!socket.user) return;
      try {
        const Hachi    = require('../models/Hachi');
        const mongoose = require('mongoose');
        const uid      = socket.user._id.toString();
        const msgOid   = new mongoose.Types.ObjectId(messageId);

        // Verify the message exists and belongs to this user (or user is creator)
        const room = await Hachi.findOne(
          { _id: roomId },
          { creator: 1, messages: { $elemMatch: { _id: msgOid } } }
        ).lean();
        if (!room) return;

        const msg = room.messages?.[0];
        if (!msg) return;

        const isCreator = room.creator.toString() === uid;
        if (msg.user.toString() !== uid && !isCreator) return;

        // Atomic pull — no full-doc save needed
        await Hachi.updateOne(
          { _id: roomId },
          { $pull: { messages: { _id: msgOid } } }
        );

        io.to(`hachi:${roomId}`).emit('hachiMessageDeleted', { roomId, messageId });
      } catch (err) {
        console.error('hachiDeleteMessage error:', err.message);
      }
    });

    // ── Report a message ────────────────────────────────────────────
    socket.on('hachiReportMessage', async ({ roomId, messageId, reason }) => {
      if (!socket.user) return;
      try {
        const Report   = require('../models/Report');
        const mongoose = require('mongoose');
        // Prevent duplicate reports from same user
        const exists = await Report.exists({
          reportedBy: socket.user._id,
          targetType: 'circle_message',
          targetMessage: new mongoose.Types.ObjectId(messageId),
        });
        if (exists) return;
        await Report.create({
          reportedBy: socket.user._id,
          targetType: 'circle_message',
          targetRoom: roomId,
          targetMessage: messageId,
          reason: reason || 'other',
        });
        // Ack only to reporter
        socket.emit('hachiReportAck', { messageId });
      } catch (err) {
        console.error('hachiReportMessage error:', err.message);
      }
    });

    // ── Per-message like (❤️) ─────────────────────────────────────
    socket.on('hachiMessageReact', async ({ roomId, messageId, emoji }) => {
      if (!socket.user || !emoji) return;
      try {
        const Hachi    = require('../models/Hachi');
        const mongoose = require('mongoose');
        const uid      = socket.user._id.toString();
        const msgOid   = new mongoose.Types.ObjectId(messageId);

        // Fetch exact message using $elemMatch so we get the right subdoc
        const room = await Hachi.findOne(
          { _id: roomId },
          { messages: { $elemMatch: { _id: msgOid } } }
        ).lean();

        const msg      = room?.messages?.[0];
        if (!msg) return;

        const reaction    = msg.reactions?.find((r) => r.emoji === emoji);
        const alreadyLiked = reaction?.users?.some((u) => u.toString() === uid);

        if (!reaction) {
          // No reaction entry yet — create it
          await Hachi.updateOne(
            { _id: roomId, 'messages._id': msgOid },
            { $push: { 'messages.$.reactions': { emoji, users: [socket.user._id] } } }
          );
        } else if (alreadyLiked) {
          // User already liked — remove them (toggle off)
          await Hachi.updateOne(
            { _id: roomId },
            { $pull: { 'messages.$[msg].reactions.$[r].users': socket.user._id } },
            { arrayFilters: [{ 'msg._id': msgOid }, { 'r.emoji': emoji }] }
          );
        } else {
          // Reaction exists but user hasn't liked — add them
          await Hachi.updateOne(
            { _id: roomId },
            { $addToSet: { 'messages.$[msg].reactions.$[r].users': socket.user._id } },
            { arrayFilters: [{ 'msg._id': msgOid }, { 'r.emoji': emoji }] }
          );
        }

        // Re-fetch the message to broadcast accurate state
        const updated = await Hachi.findOne(
          { _id: roomId },
          { messages: { $elemMatch: { _id: msgOid } } }
        ).lean();
        const freshMsg = updated?.messages?.[0];
        if (!freshMsg) return;

        const reactionsOut = (freshMsg.reactions || []).map((r) => ({
          emoji: r.emoji,
          count: r.users.length,
          users: r.users.map((u) => u.toString()),
        }));

        io.to(`hachi:${roomId}`).emit('hachiMessageReaction', { roomId, messageId, reactions: reactionsOut });

        // Award hachiPoint to message author for a new like (not self-like)
        if (!alreadyLiked && freshMsg.user?.toString() !== uid) {
          const User = require('../models/User');
          User.findByIdAndUpdate(freshMsg.user, { $inc: { hachiPoints: 1 } }).exec();
        }
      } catch (err) {
        console.error('hachiMessageReact error:', err.message, err.stack);
      }
    });

    // ── Moderator: kick a member ──────────────────────────────────
    socket.on('hachiKickMember', async ({ roomId, userId, deleteMessages }) => {
      if (!socket.user) return;
      try {
        const Hachi = require('../models/Hachi');
        const room = await Hachi.findById(roomId);
        if (!room || !room.isActive) return;

        // Only creator can kick
        if (room.creator.toString() !== socket.user._id.toString()) return;
        if (userId === socket.user._id.toString()) return;

        room.members = room.members.filter((m) => m.toString() !== userId);
        room.memberCount = room.members.length;
        if (!room.blockedMembers.some((b) => b.toString() === userId)) {
          room.blockedMembers.push(userId);
        }

        // Optionally delete the user's messages
        if (deleteMessages) {
          room.messages = room.messages.filter((m) => m.user.toString() !== userId);
        }

        await room.save();

        // Force-leave the kicked user's socket from the room
        const userSockets = await io.in(`user:${userId}`).fetchSockets();
        userSockets.forEach((s) => s.leave(`hachi:${roomId}`));

        io.to(`user:${userId}`).emit('hachiKicked', { roomId });
        io.to(`hachi:${roomId}`).emit('hachiMemberCount', { roomId, count: room.memberCount });
        io.to(`hachi:${roomId}`).emit('hachiMemberKicked', { roomId, userId });
        if (deleteMessages) {
          io.to(`hachi:${roomId}`).emit('hachiMessagesRemoved', { roomId, userId });
        }
      } catch (err) {
        console.error('hachiKickMember error:', err.message);
      }
    });

    // ── Private room: approve / reject join request ───────────────
    socket.on('hachiApproveJoin', async ({ roomId, userId }) => {
      if (!socket.user) return;
      try {
        const Hachi = require('../models/Hachi');
        const room = await Hachi.findById(roomId);
        if (!room || room.creator.toString() !== socket.user._id.toString()) return;

        room.joinRequests = room.joinRequests.filter((r) => r.user.toString() !== userId);
        if (!room.members.some((m) => m.toString() === userId)) {
          room.members.push(userId);
          room.memberCount = room.members.length;
        }
        await room.save();

        // Let the approved user's sockets join the room channel
        const userSockets = await io.in(`user:${userId}`).fetchSockets();
        userSockets.forEach((s) => s.join(`hachi:${roomId}`));

        io.to(`user:${userId}`).emit('hachiJoinApproved', { roomId });
        const count = io.sockets.adapter.rooms.get(`hachi:${roomId}`)?.size || 0;
        io.to(`hachi:${roomId}`).emit('hachiMemberCount', { roomId, count });
      } catch (err) {
        console.error('hachiApproveJoin error:', err.message);
      }
    });

    socket.on('hachiRejectJoin', async ({ roomId, userId }) => {
      if (!socket.user) return;
      try {
        const Hachi = require('../models/Hachi');
        const room = await Hachi.findById(roomId);
        if (!room || room.creator.toString() !== socket.user._id.toString()) return;

        room.joinRequests = room.joinRequests.filter((r) => r.user.toString() !== userId);
        await room.save();

        io.to(`user:${userId}`).emit('hachiJoinRejected', { roomId });
      } catch (err) {
        console.error('hachiRejectJoin error:', err.message);
      }
    });

    // ── Hachi pulse reactions (room-level — kept for backwards compat) ─
    socket.on('hachiReact', async ({ roomId, type }) => {
      if (!socket.user || !['fire', 'eyes', 'skull'].includes(type)) return;
      try {
        const Hachi = require('../models/Hachi');
        const room = await Hachi.findByIdAndUpdate(
          roomId,
          { $inc: { [`reactions.${type}`]: 1 } },
          { new: true }
        ).select('reactions');
        if (!room) return;
        io.to(`hachi:${roomId}`).emit('hachiReactionUpdate', { roomId, reactions: room.reactions });
      } catch (err) {
        console.error('hachiReact error:', err.message);
      }
    });

    // ── DM: typing indicator ──────────────────────────────────────
    socket.on('dmTyping', ({ otherUserId, isTyping }) => {
      if (!socket.user) { console.log('[dmTyping] rejected: no socket.user'); return; }
      const otherIdStr = String(otherUserId || '');
      if (!isValidObjectId(otherIdStr)) { console.log('[dmTyping] rejected: invalid otherUserId', otherIdStr); return; }
      const roomName = `user:${otherIdStr}`;
      const roomSize = io.sockets.adapter.rooms.get(roomName)?.size || 0;
      console.log(`[dmTyping] ${socket.user.username} → ${roomName} (${roomSize} sockets in room) isTyping=${isTyping}`);
      io.to(roomName).emit('dmTyping', {
        fromUserId: socket.user._id.toString(),
        isTyping: !!isTyping,
      });
    });

    // ── DM: mark conversation as seen ────────────────────────────
    socket.on('dmMarkSeen', async ({ conversationId }) => {
      if (!socket.user || !isValidObjectId(conversationId)) return;
      try {
        const Conversation = require('../models/Conversation');
        const conv = await Conversation.findById(conversationId);
        if (!conv) return;
        const userIdStr = socket.user._id.toString();
        if (!conv.participants.some((p) => p.toString() === userIdStr)) return;

        // Emit immediately (like typing) — don't wait for DB save
        const otherId = conv.participants.find((p) => p.toString() !== userIdStr)?.toString();
        if (otherId) {
          io.to(`user:${otherId}`).emit('dmSeen', { conversationId });
        }

        // Persist to DB in background
        let dirty = false;
        conv.messages.forEach((m) => {
          if (m.sender.toString() !== userIdStr && !m.isRead) {
            m.isRead = true;
            dirty = true;
          }
        });
        if (dirty) {
          conv.unreadCounts.set(userIdStr, 0);
          await conv.save();
        }
      } catch (err) {
        console.error('dmMarkSeen error:', err.message);
      }
    });

    // ── Now Bar: live situation updates (admin broadcast) ─────────
    socket.on('broadcastNowBar', (data) => {
      io.emit('nowBarUpdate', data);
    });

    // ── Disconnect ────────────────────────────────────────────────
    socket.on('disconnect', () => {
      if (userId) {
        console.log(`User ${socket.user?.username} disconnected`);
      }
    });

    socket.on('error', (err) => {
      console.error(`Socket error for ${socket.id}:`, err.message);
    });
  });

  return io;
};

module.exports = initSocket;
