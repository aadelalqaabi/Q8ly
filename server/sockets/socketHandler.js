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
      const user = await User.findById(decoded.id).select('_id username name profilePic verifiedBadge');

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
        io.to(`hachi:${roomId}`).emit('hachiOnlineCount', { roomId, online: onlineCount });
      } catch (err) {
        console.error('joinHachi error:', err.message);
        socket.join(`hachi:${roomId}`);
      }
    });

    socket.on('leaveHachi', (roomId) => {
      socket.leave(`hachi:${roomId}`);
      // Broadcast updated online count
      const onlineCount = io.sockets.adapter.rooms.get(`hachi:${roomId}`)?.size || 0;
      io.to(`hachi:${roomId}`).emit('hachiOnlineCount', { roomId, online: onlineCount });
    });

    socket.on('hachiSend', async ({ roomId, text, replyTo }) => {
      if (!socket.user || !text?.trim()) return;
      try {
        const { isBlocked } = checkContent(text.trim());
        if (isBlocked) {
          socket.emit('hachiError', { message: 'رسالتك تحتوي على محتوى مسيء ولم يتم إرسالها.' });
          return;
        }

        const Hachi = require('../models/Hachi');
        const mongoose = require('mongoose');
        const uid = socket.user._id.toString();
        const now = new Date();
        const msgId = new mongoose.Types.ObjectId();

        const msgData = { _id: msgId, user: socket.user._id, text: text.trim(), reactions: [], createdAt: now };
        if (replyTo?.messageId && replyTo?.userName) {
          msgData.replyTo = { messageId: replyTo.messageId, text: replyTo.text || '', userName: replyTo.userName };
        }

        const room = await Hachi.findById(roomId).select('blockedMembers members memberCount').lean();
        if (!room) return;
        if ((room.blockedMembers || []).some((b) => b.toString() === uid)) return;

        const isNewMember = !(room.members || []).some((m) => m.toString() === uid);
        const updated = await Hachi.findByIdAndUpdate(
          roomId,
          {
            $push: { messages: { $each: [msgData], $slice: -500 } },
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
          reactions: [],
          createdAt: now,
          replyTo: msgData.replyTo || null,
          user: { _id: socket.user._id, name: socket.user.name, username: socket.user.username, profilePic: socket.user.profilePic },
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
    socket.on('hachiSendImage', async ({ roomId, imageUrl, isLive = false }) => {
      if (!socket.user || !imageUrl) return;
      try {
        const Hachi = require('../models/Hachi');
        const mongoose = require('mongoose');
        const now = new Date();
        const msgId = new mongoose.Types.ObjectId();
        const msgData = { _id: msgId, user: socket.user._id, image: imageUrl, isLive: !!isLive, reactions: [], createdAt: now };

        const roomCheck = await Hachi.findById(roomId).select('isActive blockedMembers members').lean();
        if (!roomCheck || !roomCheck.isActive) return;
        const uid2 = socket.user._id.toString();
        if ((roomCheck.blockedMembers || []).some((b) => b.toString() === uid2)) return;
        const isNew2 = !(roomCheck.members || []).some((m) => m.toString() === uid2);

        const updated = await Hachi.findByIdAndUpdate(
          roomId,
          {
            $push: { messages: { $each: [msgData], $slice: -500 } },
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
        const Hachi = require('../models/Hachi');
        const room = await Hachi.findById(roomId);
        if (!room) return;

        const msg = room.messages.id(messageId);
        if (!msg) return;

        const uid = socket.user._id.toString();
        const isCreator = room.creator.toString() === uid;
        // Only message author or room creator can delete
        if (msg.user.toString() !== uid && !isCreator) return;

        // Remove from pinned if pinned
        room.pinnedMessages = (room.pinnedMessages || []).filter(
          (p) => p.toString() !== messageId.toString()
        );
        room.messages.pull(messageId);
        await room.save();

        io.to(`hachi:${roomId}`).emit('hachiMessageDeleted', { roomId, messageId });
        io.to(`hachi:${roomId}`).emit('hachiPinUpdate', {
          roomId,
          pinnedMessages: room.pinnedMessages.map((p) => p.toString()),
        });
      } catch (err) {
        console.error('hachiDeleteMessage error:', err.message);
      }
    });

    // ── Per-message emoji reactions ───────────────────────────────
    socket.on('hachiMessageReact', async ({ roomId, messageId, emoji }) => {
      if (!socket.user || !emoji) return;
      try {
        const Hachi = require('../models/Hachi');
        const room = await Hachi.findById(roomId);
        if (!room) return;

        const msg = room.messages.id(messageId);
        if (!msg) return;

        const uid = socket.user._id.toString();
        const existing = msg.reactions.find((r) => r.emoji === emoji);

        let reactionAdded = false;
        if (existing) {
          const idx = existing.users.findIndex((u) => u.toString() === uid);
          if (idx >= 0) {
            existing.users.splice(idx, 1);
            if (existing.users.length === 0) {
              msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji);
            }
          } else {
            existing.users.push(socket.user._id);
            reactionAdded = true;
          }
        } else {
          msg.reactions.push({ emoji, users: [socket.user._id] });
          reactionAdded = true;
        }

        await room.save();

        // Award +1 point to message author when a new reaction is added (not self)
        const msgAuthorIdStr = msg.user.toString();
        if (reactionAdded && msgAuthorIdStr !== uid) {
          const User = require('../models/User');
          User.findByIdAndUpdate(msg.user, { $inc: { hachiPoints: 1 } }).exec();
        }

        // Broadcast updated reactions (include user IDs so clients can derive isReacted)
        const reactionsOut = msg.reactions.map((r) => ({
          emoji: r.emoji,
          count: r.users.length,
          users: r.users.map((u) => u.toString()),
        }));
        io.to(`hachi:${roomId}`).emit('hachiMessageReaction', { roomId, messageId, reactions: reactionsOut });

        // Notify the message author about the reaction (not if they reacted to their own message)
        const msgAuthorId = msg.user.toString();
        if (msgAuthorId !== uid) {
          try {
            const Notification = require('../models/Notification');
            const notif = await Notification.create({
              userId: msg.user,
              type: 'message_reaction',
              fromUser: socket.user._id,
              circle: roomId,
              message: emoji,
            });
            await notif.populate('fromUser', 'name username profilePic');
            io.to(`user:${msgAuthorId}`).emit('notification', notif);
          } catch (notifErr) {
            console.error('Message reaction notification error:', notifErr.message);
          }
        }
      } catch (err) {
        console.error('hachiMessageReact error:', err.message);
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
          const removedIds = room.messages
            .filter((m) => m.user.toString() === userId)
            .map((m) => m._id.toString());
          room.messages = room.messages.filter((m) => m.user.toString() !== userId);
          // Remove any pinned messages that belonged to this user
          room.pinnedMessages = (room.pinnedMessages || []).filter(
            (pid) => !removedIds.includes(pid.toString())
          );
        }

        await room.save();

        // Force-leave the kicked user's socket from the room
        const userSockets = await io.in(`user:${userId}`).fetchSockets();
        userSockets.forEach((s) => s.leave(`hachi:${roomId}`));

        io.to(`user:${userId}`).emit('hachiKicked', { roomId });
        io.to(`hachi:${roomId}`).emit('hachiMemberCount', { roomId, count: room.memberCount });
        io.to(`hachi:${roomId}`).emit('hachiMemberKicked', { roomId, userId });
        if (deleteMessages) {
          io.to(`hachi:${roomId}`).emit('hachiMessagesRemoved', { roomId, userId, pinnedMessages: room.pinnedMessages });
        }
      } catch (err) {
        console.error('hachiKickMember error:', err.message);
      }
    });

    // ── Moderator: pin / unpin a message (max 3) ──────────────────
    socket.on('hachiPinMessage', async ({ roomId, messageId }) => {
      if (!socket.user) return;
      try {
        const Hachi = require('../models/Hachi');
        const room = await Hachi.findById(roomId);
        if (!room || !room.isActive) return;
        if (room.creator.toString() !== socket.user._id.toString()) return;

        const msg = room.messages.id(messageId);
        if (!msg) return;

        const pinnedStrs = (room.pinnedMessages || []).map((p) => p.toString());
        const alreadyPinned = pinnedStrs.includes(messageId.toString());

        if (alreadyPinned) {
          room.pinnedMessages = room.pinnedMessages.filter(
            (p) => p.toString() !== messageId.toString()
          );
        } else {
          if (pinnedStrs.length >= 3) {
            socket.emit('hachiError', { message: 'لا يمكن تثبيت أكثر من 3 رسائل.' });
            return;
          }
          room.pinnedMessages.push(messageId);
        }

        await room.save();
        io.to(`hachi:${roomId}`).emit('hachiPinUpdate', {
          roomId,
          pinnedMessages: room.pinnedMessages.map((p) => p.toString()),
        });

        // Notify the message author that their message was pinned (not if they pinned their own)
        if (!alreadyPinned && msg.user.toString() !== socket.user._id.toString()) {
          try {
            const Notification = require('../models/Notification');
            const notif = await Notification.create({
              userId: msg.user,
              type: 'pin',
              fromUser: socket.user._id,
              circle: roomId,
              message: room.title,
            });
            await notif.populate('fromUser', 'name username profilePic');
            io.to(`user:${msg.user}`).emit('notification', notif);
          } catch (notifErr) {
            console.error('Pin notification error:', notifErr.message);
          }
        }
      } catch (err) {
        console.error('hachiPinMessage error:', err.message);
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
