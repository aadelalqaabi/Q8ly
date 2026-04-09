import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_URL } from '../constants';

let socket = null;

export const initSocket = async () => {
  if (socket && socket.connected) return socket;

  const token = await AsyncStorage.getItem('token');

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  socket.on('connect_error', (err) => {
    console.warn('Socket connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// ── Helper: join a space room ─────────────────────────────────────────────────
export const joinSpaceRoom = (spaceId) => {
  if (socket) socket.emit('joinSpace', spaceId);
};

export const leaveSpaceRoom = (spaceId) => {
  if (socket) socket.emit('leaveSpace', spaceId);
};

// ── Helper: join a post room (live comments) ──────────────────────────────────
export const joinPostRoom = (postId) => {
  if (socket) socket.emit('joinPost', postId);
};

export const leavePostRoom = (postId) => {
  if (socket) socket.emit('leavePost', postId);
};

// ── Helper: typing indicator ──────────────────────────────────────────────────
export const sendTyping = (postId, isTyping) => {
  if (socket) socket.emit('typing', { postId, isTyping });
};

// ── Helper: Hachi chat rooms ──────────────────────────────────────────────────
export const joinHachiRoom = (roomId) => {
  if (socket) socket.emit('joinHachi', roomId);
};

export const leaveHachiRoom = (roomId) => {
  if (socket) socket.emit('leaveHachi', roomId);
};

export const sendHachiMessage = (roomId, text, replyTo = null) => {
  if (socket) socket.emit('hachiSend', { roomId, text, replyTo });
};

export const sendHachiReaction = (roomId, type) => {
  if (socket) socket.emit('hachiReact', { roomId, type });
};

export const sendHachiVoice = (roomId, voiceUrl, voiceDuration) => {
  if (socket) socket.emit('hachiSendVoice', { roomId, voiceUrl, voiceDuration });
};

export const sendHachiMessageReaction = (roomId, messageId, emoji) => {
  if (socket) socket.emit('hachiMessageReact', { roomId, messageId, emoji });
};

export const sendHachiKick = (roomId, userId, deleteMessages = false) => {
  if (socket) socket.emit('hachiKickMember', { roomId, userId, deleteMessages });
};

export const approveHachiJoin = (roomId, userId) => {
  if (socket) socket.emit('hachiApproveJoin', { roomId, userId });
};

export const rejectHachiJoin = (roomId, userId) => {
  if (socket) socket.emit('hachiRejectJoin', { roomId, userId });
};

export const sendHachiImage = (roomId, imageUrl, isLive = false) => {
  if (socket) socket.emit('hachiSendImage', { roomId, imageUrl, isLive });
};

export const sendHachiVideo = (roomId, videoUrl, videoThumbnail, isLive = false) => {
  if (socket) socket.emit('hachiSendVideo', { roomId, videoUrl, videoThumbnail, isLive });
};

export const sendHachiReport = (roomId, messageId, reason = 'other') => {
  if (socket) socket.emit('hachiReportMessage', { roomId, messageId, reason });
};

export default { initSocket, getSocket, disconnectSocket, joinSpaceRoom, leaveSpaceRoom, joinPostRoom, leavePostRoom, sendTyping, joinHachiRoom, leaveHachiRoom, sendHachiMessage, sendHachiVoice, sendHachiReaction, sendHachiMessageReaction, sendHachiKick, approveHachiJoin, rejectHachiJoin, sendHachiImage, sendHachiVideo };
