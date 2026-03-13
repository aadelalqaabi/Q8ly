import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { dmAPI } from '../../services/api';

export const fetchConversations = createAsyncThunk('dm/fetchConversations', async (_, { rejectWithValue }) => {
  try {
    const res = await dmAPI.getConversations();
    return res.conversations;
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

export const fetchConversation = createAsyncThunk('dm/fetchConversation', async (userId, { rejectWithValue }) => {
  try {
    const res = await dmAPI.getConversation(userId);
    return res;
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

const dmSlice = createSlice({
  name: 'dm',
  initialState: {
    conversations: [],
    activeConversation: null,   // { conversation, other }
    dmUnreadCount: 0,
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
      // Update conversations list preview
      const conv = state.conversations.find((c) => c._id === conversationId);
      if (conv) {
        conv.lastMessage = message.text?.slice(0, 80) || '';
        conv.unread = (conv.unread || 0) + 1;
      }
      state.dmUnreadCount = Math.max(0, state.dmUnreadCount + 1);
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
        state.conversations = action.payload;
        state.dmUnreadCount = action.payload.reduce((sum, c) => sum + (c.unread || 0), 0);
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
      .addCase(sendDmMessage.rejected, (state) => { state.sending = false; });
  },
});

export const { addRealtimeMessage, setDmUnreadCount, clearActiveConversation } = dmSlice.actions;
export default dmSlice.reducer;
