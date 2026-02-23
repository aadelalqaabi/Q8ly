import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../constants';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor – attach JWT
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor – handle global errors
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const message = error.response?.data?.message || error.message || 'Something went wrong';

    if (error.response?.status === 401) {
      // Token expired or invalid – clear storage
      await AsyncStorage.multiRemove(['token', 'user']);
      // The auth slice will handle redirect via state change
    }

    return Promise.reject({ message, status: error.response?.status });
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updatePassword: (data) => api.put('/auth/password', data),
  updatePushToken: (token) => api.put('/auth/push-token', { expoPushToken: token }),
};

// ── Posts ─────────────────────────────────────────────────────────────────────
export const postsAPI = {
  getFeed: (params) => api.get('/posts/feed', { params }),
  getTrending: (params) => api.get('/posts/trending', { params }),
  getPost: (id) => api.get(`/posts/${id}`),
  createPost: (data) => api.post('/posts', data),
  deletePost: (id) => api.delete(`/posts/${id}`),
  toggleLike: (id) => api.post(`/posts/${id}/like`),
  repost: (id, comment) => api.post(`/posts/${id}/repost`, { comment }),
  reportPost: (id, data) => api.post(`/posts/${id}/report`, data),
  votePoll: (id, optionIndex) => api.post(`/posts/${id}/vote`, { optionIndex }),
  getComments: (id, params) => api.get(`/posts/${id}/comments`, { params }),
  addComment: (id, data) => api.post(`/posts/${id}/comments`, data),
  likeComment: (postId, id) => api.post(`/posts/${postId}/comments/${id}/like`),
  deleteComment: (postId, id) => api.delete(`/posts/${postId}/comments/${id}`),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const usersAPI = {
  getProfile: (username) => api.get(`/users/${username}`),
  getUserPosts: (username, params) => api.get(`/users/${username}/posts`, { params }),
  getFollowers: (username) => api.get(`/users/${username}/followers`),
  getFollowing: (username) => api.get(`/users/${username}/following`),
  toggleFollow: (id) => api.post(`/users/${id}/follow`),
  toggleBlock: (id) => api.post(`/users/${id}/block`),
  updateProfile: (data) => api.put('/users/profile', data),
  searchUsers: (q, params) => api.get('/users/search', { params: { q, ...params } }),
  getSuggestions: () => api.get('/users/suggestions'),
  reportUser: (id, data) => api.post(`/users/${id}/report`, data),
};

// ── Topics ────────────────────────────────────────────────────────────────────
export const topicsAPI = {
  getTrending: (params) => api.get('/topics/trending', { params }),
  getAll: (params) => api.get('/topics', { params }),
  getBySlug: (slug) => api.get(`/topics/${slug}`),
  getPosts: (slug, params) => api.get(`/topics/${slug}/posts`, { params }),
  toggleFollow: (id) => api.post(`/topics/${id}/follow`),
  toggleMute: (id) => api.post(`/topics/${id}/mute`),
  search: (q) => api.get('/topics/search', { params: { q } }),
};

// ── Spaces ────────────────────────────────────────────────────────────────────
export const spacesAPI = {
  getAll: (params) => api.get('/spaces', { params }),
  getBySlug: (slug) => api.get(`/spaces/${slug}`),
  getFeed: (slug, params) => api.get(`/spaces/${slug}/feed`, { params }),
  create: (data) => api.post('/spaces', data),
  toggleJoin: (id) => api.post(`/spaces/${id}/join`),
  search: (q) => api.get('/spaces/search', { params: { q } }),
};

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/count'),
  markAsRead: (ids) => api.put('/notifications/read', { ids }),
  delete: (id) => api.delete(`/notifications/${id}`),
};

// ── Events ────────────────────────────────────────────────────────────────────
export const eventsAPI = {
  getAll: (params) => api.get('/events', { params }),
  getById: (id) => api.get(`/events/${id}`),
  create: (data) => api.post('/events', data),
  toggleRsvp: (id) => api.post(`/events/${id}/rsvp`),
};

// ── Upload ────────────────────────────────────────────────────────────────────
export const uploadAPI = {
  images: (formData) => api.post('/upload/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  profilePic: (formData) => api.post('/upload/profile-pic', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  coverPhoto: (formData) => api.post('/upload/cover-photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};

export default api;
