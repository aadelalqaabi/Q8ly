import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { topicsAPI } from '../../services/api';

export const fetchTrendingTopics = createAsyncThunk('topics/fetchTrending', async (_, { rejectWithValue }) => {
  try {
    const response = await topicsAPI.getTrending({ limit: 20 });
    return response;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const fetchAllTopics = createAsyncThunk('topics/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const response = await topicsAPI.getAll(params);
    return response;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const toggleFollowTopic = createAsyncThunk('topics/toggleFollow', async (topicId, { rejectWithValue }) => {
  try {
    const response = await topicsAPI.toggleFollow(topicId);
    return { topicId, ...response };
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

const topicsSlice = createSlice({
  name: 'topics',
  initialState: {
    trendingTopics: [],
    allTopics: [],
    followedTopics: [], // IDs
    mutedTopics: [],    // IDs
    isLoading: false,
    error: null,
  },
  reducers: {
    setFollowedTopics: (state, action) => { state.followedTopics = action.payload; },
    setMutedTopics: (state, action) => { state.mutedTopics = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTrendingTopics.pending, (state) => { state.isLoading = true; })
      .addCase(fetchTrendingTopics.fulfilled, (state, action) => {
        state.isLoading = false;
        state.trendingTopics = action.payload.topics;
      })
      .addCase(fetchTrendingTopics.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder.addCase(fetchAllTopics.fulfilled, (state, action) => {
      state.allTopics = action.payload.topics;
    });

    builder.addCase(toggleFollowTopic.fulfilled, (state, action) => {
      const { topicId, following } = action.payload;
      if (following) {
        if (!state.followedTopics.includes(topicId)) state.followedTopics.push(topicId);
      } else {
        state.followedTopics = state.followedTopics.filter((id) => id !== topicId);
      }
      // Update followersCount in lists
      const update = (list) => {
        const topic = list.find((t) => t._id === topicId);
        if (topic) topic.followersCount = action.payload.followersCount;
      };
      update(state.trendingTopics);
      update(state.allTopics);
    });
  },
});

export const { setFollowedTopics, setMutedTopics } = topicsSlice.actions;
export default topicsSlice.reducer;
