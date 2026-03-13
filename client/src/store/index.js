import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import postsReducer from './slices/postsSlice';
import topicsReducer from './slices/topicsSlice';
import spacesReducer from './slices/spacesSlice';
import notificationsReducer from './slices/notificationsSlice';
import uiReducer from './slices/uiSlice';
import hachiReducer from './slices/hachiSlice';
import dmReducer from './slices/dmSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    posts: postsReducer,
    topics: topicsReducer,
    spaces: spacesReducer,
    notifications: notificationsReducer,
    ui: uiReducer,
    hachi: hachiReducer,
    dm: dmReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // needed for Date objects in state
    }),
});

export default store;
