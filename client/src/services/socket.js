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

export default { initSocket, getSocket, disconnectSocket, joinSpaceRoom, leaveSpaceRoom, joinPostRoom, leavePostRoom, sendTyping };
