import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { notificationsAPI } from '../../services/api';

export const fetchNotifications = createAsyncThunk('notifications/fetch', async (params, { rejectWithValue }) => {
  try {
    const response = await notificationsAPI.getAll(params);
    return response;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const markAsRead = createAsyncThunk('notifications/markAsRead', async (ids, { rejectWithValue }) => {
  try {
    await notificationsAPI.markAsRead(ids);
    return ids;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    notifications: [],
    unreadCount: 0,
    isLoading: false,
    error: null,
  },
  reducers: {
    addNotificationRealtime: (state, action) => {
      state.notifications.unshift(action.payload);
      state.unreadCount += 1;
    },
    setUnreadCount: (state, action) => {
      state.unreadCount = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => { state.isLoading = true; })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.isLoading = false;
        state.notifications = action.payload.notifications;
        state.unreadCount = action.payload.unreadCount;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder.addCase(markAsRead.fulfilled, (state, action) => {
      const ids = action.payload;
      if (!ids || ids.length === 0) {
        // Mark all
        state.notifications.forEach((n) => { n.read = true; });
        state.unreadCount = 0;
      } else {
        ids.forEach((id) => {
          const n = state.notifications.find((n) => n._id === id);
          if (n && !n.read) { n.read = true; state.unreadCount = Math.max(0, state.unreadCount - 1); }
        });
      }
    });
  },
});

export const { addNotificationRealtime, setUnreadCount } = notificationsSlice.actions;
export default notificationsSlice.reducer;
