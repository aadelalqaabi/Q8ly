import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dmAPI } from '../../services/api';

export const fetchConversations = createAsyncThunk('dm/fetchConversations', async (_, { rejectWithValue }) => {
  try {
    return await dmAPI.getConversations(); // { conversations, requests }
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

export const fetchConversation = createAsyncThunk('dm/fetchConversation', async (userId, { rejectWithValue }) => {
  try {
    return await dmAPI.getConversation(userId);
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

export const sendDmMessage = createAsyncThunk('dm/sendMessage', async ({ userId, text }, { rejectWithValue }) => {
  try {
    const res = await dmAPI.sendMessage(userId, text);
    return res.message;
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

export const acceptDmRequest = createAsyncThunk('dm/acceptRequest', async (conversationId, { rejectWithValue }) => {
  try {
    await dmAPI.acceptRequest(conversationId);
    return conversationId;
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

export const denyDmRequest = createAsyncThunk('dm/denyRequest', async (conversationId, { rejectWithValue }) => {
  try {
    await dmAPI.denyRequest(conversationId);
    return conversationId;
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

const dmSlice = createSlice({
  name: 'dm',
  initialState: {
    conversations: [],
    requests: [],
    activeConversation: null,
    dmUnreadCount: 0,
    needsRefresh: false,
    loading: false,
    sending: false,
    error: null,
  },
  reducers: {
    addRealtimeMessage(state, action) {
      const { conversationId, message } = action.payload;
      if (state.activeConversation?.conversation?._id === conversationId) {
        state.activeConversation.conversation.messages.push(message);
      }
      const conv = state.conversations.find((c) => c._id === conversationId)
        || state.requests.find((c) => c._id === conversationId);
      if (conv) {
        conv.lastMessage = message.text?.slice(0, 80) || '';
        conv.lastMessageAt = message.createdAt || new Date().toISOString();
        conv.unread = (conv.unread || 0) + 1;
      } else {
        // New conversation not in list yet — signal a refresh
        state.needsRefresh = true;
      }
      state.dmUnreadCount = Math.max(0, state.dmUnreadCount + 1);
    },
    clearNeedsRefresh(state) {
      state.needsRefresh = false;
    },
    setDmUnreadCount(state, action) {
      state.dmUnreadCount = action.payload;
    },
    clearActiveConversation(state) {
      state.activeConversation = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchConversations.pending, (state) => { state.loading = true; })
      .addCase(fetchConversations.fulfilled, (state, action) => {
        state.loading = false;
        state.conversations = action.payload.conversations || [];
        state.requests = action.payload.requests || [];
        const all = [...(action.payload.conversations || []), ...(action.payload.requests || [])];
        state.dmUnreadCount = all.reduce((sum, c) => sum + (c.unread || 0), 0);
      })
      .addCase(fetchConversations.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      .addCase(fetchConversation.pending, (state) => { state.loading = true; })
      .addCase(fetchConversation.fulfilled, (state, action) => {
        state.loading = false;
        state.activeConversation = action.payload;
      })
      .addCase(fetchConversation.rejected, (state, action) => { state.loading = false; state.error = action.payload; })

      .addCase(sendDmMessage.pending, (state) => { state.sending = true; })
      .addCase(sendDmMessage.fulfilled, (state, action) => {
        state.sending = false;
        if (state.activeConversation?.conversation) {
          state.activeConversation.conversation.messages.push(action.payload);
        }
      })
      .addCase(sendDmMessage.rejected, (state) => { state.sending = false; })

      .addCase(acceptDmRequest.fulfilled, (state, action) => {
        const convId = action.payload;
        const idx = state.requests.findIndex((c) => c._id === convId);
        if (idx !== -1) {
          const conv = { ...state.requests[idx], status: 'accepted' };
          state.requests.splice(idx, 1);
          state.conversations.unshift(conv);
        }
      })
      .addCase(denyDmRequest.fulfilled, (state, action) => {
        state.requests = state.requests.filter((c) => c._id !== action.payload);
      });
  },
});

export const { addRealtimeMessage, setDmUnreadCount, clearActiveConversation, clearNeedsRefresh } = dmSlice.actions;
export default dmSlice.reducer;
