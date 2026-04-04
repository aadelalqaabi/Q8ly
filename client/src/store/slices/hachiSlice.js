import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { hachiAPI } from '../../services/api';
import { updateUserLocally } from './authSlice';

export const fetchRooms = createAsyncThunk('hachi/fetchRooms', async (category, { rejectWithValue }) => {
  try {
    const res = await hachiAPI.getRooms(category);
    return res.rooms;
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

export const fetchJoinedRooms = createAsyncThunk('hachi/fetchJoinedRooms', async (_, { rejectWithValue }) => {
  try {
    const res = await hachiAPI.getJoinedRooms();
    return res.rooms;
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

export const fetchArchivedRooms = createAsyncThunk('hachi/fetchArchivedRooms', async (category, { rejectWithValue }) => {
  try {
    const res = await hachiAPI.getArchivedRooms(category);
    return res.rooms;
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

export const createRoom = createAsyncThunk('hachi/createRoom', async ({ title, category, isPublic }, { dispatch, rejectWithValue }) => {
  try {
    const res = await hachiAPI.createRoom(title, category, isPublic);
    // Sync updated hachiPoints back into auth state
    if (typeof res.hachiPoints === 'number') {
      dispatch(updateUserLocally({ hachiPoints: res.hachiPoints }));
    }
    return res.room;
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

export const fetchSubjects = createAsyncThunk('hachi/fetchSubjects', async (_, { rejectWithValue }) => {
  try {
    const res = await hachiAPI.getSubjects();
    return res.subjects;
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

export const fetchMoments = createAsyncThunk('hachi/fetchMoments', async (_, { rejectWithValue }) => {
  try {
    const res = await hachiAPI.getMoments();
    return res.moments;
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

export const fetchRoom = createAsyncThunk('hachi/fetchRoom', async (id, { rejectWithValue }) => {
  try {
    const res = await hachiAPI.getRoom(id);
    return res.room;
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

export const closeRoom = createAsyncThunk('hachi/closeRoom', async (id, { rejectWithValue }) => {
  try {
    await hachiAPI.closeRoom(id);
    return id;
  } catch (e) {
    return rejectWithValue(e.message);
  }
});

const hachiSlice = createSlice({
  name: 'hachi',
  initialState: {
    rooms: [],
    archivedRooms: [],
    joinedRooms: [],
    moments: [],
    subjects: [],           // trending subjects [{category, count}]
    momentsLoading: false,
    joinedLoading: false,
    activeRoom: null,
    isLoading: false,
    archivedLoading: false,
    roomLoading: false,
    error: null,
    joinRequests: [],       // pending join requests visible to the creator
    waitingApproval: false, // current user is waiting to be approved in a private room
  },
  reducers: {
    addRoomRealtime(state, { payload }) {
      const exists = state.rooms.some((r) => r._id === payload._id);
      if (!exists) state.rooms.unshift(payload);
    },
    removeRoomRealtime(state, { payload }) {
      // Move closed room to archivedRooms instead of discarding it
      const room = state.rooms.find((r) => r._id === payload.roomId);
      if (room) {
        const alreadyArchived = state.archivedRooms.some((r) => r._id === payload.roomId);
        if (!alreadyArchived) {
          state.archivedRooms.unshift({ ...room, isActive: false });
        }
        state.rooms = state.rooms.filter((r) => r._id !== payload.roomId);
      } else {
        state.rooms = state.rooms.filter((r) => r._id !== payload.roomId);
      }
      if (state.activeRoom?._id === payload.roomId) {
        state.activeRoom = { ...state.activeRoom, isActive: false };
      }
    },
    addOptimisticMessage(state, { payload }) {
      if (state.activeRoom?._id === payload.roomId) {
        state.activeRoom.messages = [...(state.activeRoom.messages || []), payload.message];
      }
    },
    addMessageRealtime(state, { payload }) {
      if (state.activeRoom?._id === payload.roomId) {
        const msgs = state.activeRoom.messages || [];
        // Replace matching optimistic message (same user + text) with the server version
        const optIdx = msgs.findIndex(
          (m) =>
            typeof m._id === 'string' &&
            m._id.startsWith('optimistic_') &&
            m.user?._id?.toString() === payload.message.user?._id?.toString() &&
            m.text === payload.message.text
        );
        if (optIdx !== -1) {
          const next = [...msgs];
          next[optIdx] = payload.message;
          state.activeRoom.messages = next;
        } else {
          state.activeRoom.messages = [...msgs, payload.message];
        }
      }
    },
    updateMemberCount(state, { payload }) {
      const room = state.rooms.find((r) => r._id === payload.roomId);
      if (room) room.memberCount = payload.count;
      if (state.activeRoom?._id === payload.roomId) {
        state.activeRoom.memberCount = payload.count;
      }
    },
    updateReactions(state, { payload }) {
      const room = state.rooms.find((r) => r._id === payload.roomId);
      if (room) room.reactions = payload.reactions;
      if (state.activeRoom?._id === payload.roomId) {
        state.activeRoom.reactions = payload.reactions;
      }
    },
    updateMessageReaction(state, { payload }) {
      if (state.activeRoom?._id === payload.roomId) {
        const msg = state.activeRoom.messages.find(
          (m) => m._id?.toString() === payload.messageId?.toString()
        );
        if (msg) msg.reactions = payload.reactions;
      }
    },
    addJoinRequest(state, { payload }) {
      const exists = state.joinRequests.some(
        (r) => r.user._id?.toString() === payload.user._id?.toString()
      );
      if (!exists) state.joinRequests.push(payload);
    },
    removeJoinRequest(state, { payload }) {
      state.joinRequests = state.joinRequests.filter(
        (r) => r.user._id?.toString() !== payload.userId?.toString()
      );
    },
    setWaitingApproval(state, { payload }) {
      state.waitingApproval = payload;
    },
    removeUserMessages(state, { payload }) {
      // payload: { userId, pinnedMessages }
      if (state.activeRoom) {
        state.activeRoom.messages = state.activeRoom.messages.filter(
          (m) => (m.user?._id ?? m.user)?.toString() !== payload.userId?.toString()
        );
        if (payload.pinnedMessages !== undefined) {
          state.activeRoom.pinnedMessages = payload.pinnedMessages;
        }
      }
    },
    updatePinnedMessages(state, { payload }) {
      // payload: { roomId, pinnedMessages: [id strings] }
      if (state.activeRoom?._id === payload.roomId) {
        state.activeRoom.pinnedMessages = payload.pinnedMessages;
      }
    },
    deleteMessage(state, { payload }) {
      // payload: { roomId, messageId }
      if (state.activeRoom?._id === payload.roomId) {
        state.activeRoom.messages = state.activeRoom.messages.filter(
          (m) => m._id?.toString() !== payload.messageId?.toString()
        );
      }
    },
    clearActiveRoom(state) {
      state.activeRoom = null;
      state.joinRequests = [];
      state.waitingApproval = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRooms.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchRooms.fulfilled, (state, { payload }) => { state.isLoading = false; state.rooms = payload; })
      .addCase(fetchRooms.rejected, (state, { payload }) => { state.isLoading = false; state.error = payload; })

      .addCase(fetchJoinedRooms.pending, (state) => { state.joinedLoading = true; })
      .addCase(fetchJoinedRooms.fulfilled, (state, { payload }) => { state.joinedLoading = false; state.joinedRooms = payload; })
      .addCase(fetchJoinedRooms.rejected, (state) => { state.joinedLoading = false; })

      .addCase(fetchMoments.pending, (state) => { state.momentsLoading = true; })
      .addCase(fetchMoments.fulfilled, (state, { payload }) => { state.momentsLoading = false; state.moments = payload; })
      .addCase(fetchMoments.rejected, (state) => { state.momentsLoading = false; })

      .addCase(fetchArchivedRooms.pending, (state) => { state.archivedLoading = true; })
      .addCase(fetchArchivedRooms.fulfilled, (state, { payload }) => {
        state.archivedLoading = false;
        state.archivedRooms = payload;
      })
      .addCase(fetchArchivedRooms.rejected, (state) => { state.archivedLoading = false; })

      .addCase(createRoom.fulfilled, (state, { payload }) => {
        const exists = state.rooms.some((r) => r._id === payload._id);
        if (!exists) state.rooms.unshift(payload);
      })

      .addCase(fetchSubjects.fulfilled, (state, { payload }) => { state.subjects = payload; })

      .addCase(fetchRoom.pending, (state) => { state.roomLoading = true; })
      .addCase(fetchRoom.fulfilled, (state, { payload }) => {
        state.roomLoading = false;
        // Preserve any optimistic messages that haven't been confirmed yet
        const optimisticMsgs = (state.activeRoom?.messages || []).filter(
          (m) => typeof m._id === 'string' && m._id.startsWith('optimistic_')
        );
        state.activeRoom = payload;
        if (optimisticMsgs.length) {
          state.activeRoom.messages = [...(payload.messages || []), ...optimisticMsgs];
        }
        // Initialise join requests from loaded room data (creator re-opening the screen)
        if (payload.joinRequests?.length) {
          state.joinRequests = payload.joinRequests.map((r) => ({
            roomId: payload._id,
            user: { _id: r.user, name: r.name, username: r.username },
          }));
        }
      })
      .addCase(fetchRoom.rejected, (state) => { state.roomLoading = false; })

      .addCase(closeRoom.fulfilled, (state, { payload }) => {
        const room = state.rooms.find((r) => r._id === payload);
        if (room) {
          const alreadyArchived = state.archivedRooms.some((r) => r._id === payload);
          if (!alreadyArchived) {
            state.archivedRooms.unshift({ ...room, isActive: false });
          }
          state.rooms = state.rooms.filter((r) => r._id !== payload);
        } else {
          state.rooms = state.rooms.filter((r) => r._id !== payload);
        }
        if (state.activeRoom?._id === payload) {
          state.activeRoom = { ...state.activeRoom, isActive: false };
        }
      });
  },
});

export const {
  addRoomRealtime,
  removeRoomRealtime,
  addOptimisticMessage,
  addMessageRealtime,
  updateMemberCount,
  updateReactions,
  updateMessageReaction,
  addJoinRequest,
  removeJoinRequest,
  setWaitingApproval,
  removeUserMessages,
  updatePinnedMessages,
  deleteMessage,
  clearActiveRoom,
} = hachiSlice.actions;

export default hachiSlice.reducer;
