import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { spacesAPI } from '../../services/api';

export const fetchSpaces = createAsyncThunk('spaces/fetchAll', async (params, { rejectWithValue }) => {
  try {
    const response = await spacesAPI.getAll(params);
    return response;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const toggleJoinSpace = createAsyncThunk('spaces/toggleJoin', async (spaceId, { rejectWithValue }) => {
  try {
    const response = await spacesAPI.toggleJoin(spaceId);
    return { spaceId, ...response };
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

const spacesSlice = createSlice({
  name: 'spaces',
  initialState: {
    spaces: [],
    joinedSpaces: [], // IDs
    isLoading: false,
    error: null,
  },
  reducers: {
    setJoinedSpaces: (state, action) => { state.joinedSpaces = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSpaces.pending, (state) => { state.isLoading = true; })
      .addCase(fetchSpaces.fulfilled, (state, action) => {
        state.isLoading = false;
        state.spaces = action.payload.spaces;
      })
      .addCase(fetchSpaces.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    builder.addCase(toggleJoinSpace.fulfilled, (state, action) => {
      const { spaceId, joined } = action.payload;
      if (joined) {
        if (!state.joinedSpaces.includes(spaceId)) state.joinedSpaces.push(spaceId);
      } else {
        state.joinedSpaces = state.joinedSpaces.filter((id) => id !== spaceId);
      }
      const space = state.spaces.find((s) => s._id === spaceId);
      if (space) space.membersCount = action.payload.membersCount;
    });
  },
});

export const { setJoinedSpaces } = spacesSlice.actions;
export default spacesSlice.reducer;
