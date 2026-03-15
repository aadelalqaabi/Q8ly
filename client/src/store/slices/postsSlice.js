import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { postsAPI } from '../../services/api';

// ── Async Thunks ──────────────────────────────────────────────────────────────

export const fetchFeed = createAsyncThunk('posts/fetchFeed', async ({ tab, page = 1 }, { rejectWithValue }) => {
  try {
    const response = await postsAPI.getFeed({ tab, page, limit: 20 });
    return { ...response, tab, page };
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const fetchTrending = createAsyncThunk('posts/fetchTrending', async (page = 1, { rejectWithValue }) => {
  try {
    const response = await postsAPI.getTrending({ page, limit: 20 });
    return { ...response, page };
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const createPost = createAsyncThunk('posts/create', async (data, { rejectWithValue }) => {
  try {
    const response = await postsAPI.createPost(data);
    return response;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const toggleLike = createAsyncThunk('posts/toggleLike', async (postId, { rejectWithValue }) => {
  try {
    const response = await postsAPI.toggleLike(postId);
    return { postId, ...response };
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const deletePost = createAsyncThunk('posts/delete', async (postId, { rejectWithValue }) => {
  try {
    await postsAPI.deletePost(postId);
    return postId;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

// ── Slice ─────────────────────────────────────────────────────────────────────

const postsSlice = createSlice({
  name: 'posts',
  initialState: {
    forYouPosts: [],
    followingPosts: [],
    trendingPosts: [],
    hotPosts: [],
    isLoading: false,
    isLoadingMore: false,
    error: null,
    forYouPage: 1,
    followingPage: 1,
    trendingPage: 1,
    forYouHasMore: true,
    followingHasMore: true,
    trendingHasMore: true,
    createPostLoading: false,
    createPostError: null,
  },
  reducers: {
    clearCreatePostError: (state) => { state.createPostError = null; },
    // Add a post in real-time (from socket)
    addPostRealtime: (state, action) => {
      state.forYouPosts.unshift(action.payload);
      state.followingPosts.unshift(action.payload);
    },
    // Update like status optimistically
    updatePostLike: (state, action) => {
      const { postId, liked, likesCount } = action.payload;
      const updatePost = (list) => {
        const post = list.find((p) => p._id === postId);
        if (post) { post.isLiked = liked; post.likesCount = likesCount; }
      };
      updatePost(state.forYouPosts);
      updatePost(state.followingPosts);
      updatePost(state.trendingPosts);
    },
    removePost: (state, action) => {
      const id = action.payload;
      state.forYouPosts = state.forYouPosts.filter((p) => p._id !== id);
      state.followingPosts = state.followingPosts.filter((p) => p._id !== id);
      state.trendingPosts = state.trendingPosts.filter((p) => p._id !== id);
    },
    updateBookmark: (state, action) => {
      const { postId, bookmarked } = action.payload;
      const update = (list) => {
        const post = list.find((p) => p._id === postId);
        if (post) post.isBookmarked = bookmarked;
      };
      update(state.forYouPosts);
      update(state.followingPosts);
      update(state.trendingPosts);
    },
  },
  extraReducers: (builder) => {
    // Fetch feed
    builder
      .addCase(fetchFeed.pending, (state, action) => {
        if (action.meta.arg.page === 1) {
          state.isLoading = true;
          state.forYouHasMore = true;
          state.followingHasMore = true;
        } else {
          state.isLoadingMore = true;
        }
        state.error = null;
      })
      .addCase(fetchFeed.fulfilled, (state, action) => {
        const { posts, hotPosts, pagination, tab, page } = action.payload;
        state.isLoading = false;
        state.isLoadingMore = false;

        const key = tab === 'following' ? 'followingPosts' : 'forYouPosts';
        const pageKey = tab === 'following' ? 'followingPage' : 'forYouPage';
        const hasMoreKey = tab === 'following' ? 'followingHasMore' : 'forYouHasMore';

        if (page === 1) {
          // Preserve client-side isBookmarked:true to survive stale-cache race conditions
          const bookmarkedIds = new Set(state[key].filter((p) => p.isBookmarked).map((p) => p._id));
          state[key] = posts.map((p) => ({ ...p, isBookmarked: bookmarkedIds.has(p._id) || p.isBookmarked }));
          if (hotPosts?.length) state.hotPosts = hotPosts;
        } else {
          state[key] = [...state[key], ...posts];
        }
        state[pageKey] = page;
        state[hasMoreKey] = pagination.hasMore ?? (page < (pagination.pages || 1));
      })
      .addCase(fetchFeed.rejected, (state, action) => {
        state.isLoading = false;
        state.isLoadingMore = false;
        state.error = action.payload;
        state.forYouHasMore = false;
        state.followingHasMore = false;
      });

    // Fetch trending
    builder
      .addCase(fetchTrending.fulfilled, (state, action) => {
        const { posts, page } = action.payload;
        if (page === 1) state.trendingPosts = posts;
        else state.trendingPosts = [...state.trendingPosts, ...posts];
        state.trendingPage = page;
      });

    // Create post
    builder
      .addCase(createPost.pending, (state) => { state.createPostLoading = true; state.createPostError = null; })
      .addCase(createPost.fulfilled, (state, action) => {
        state.createPostLoading = false;
        state.forYouPosts.unshift(action.payload.post);
        state.followingPosts.unshift(action.payload.post);
      })
      .addCase(createPost.rejected, (state, action) => {
        state.createPostLoading = false;
        state.createPostError = action.payload;
      });

    // Toggle like
    builder.addCase(toggleLike.fulfilled, (state, action) => {
      const { postId, liked, likesCount } = action.payload;
      const updatePost = (list) => {
        const post = list.find((p) => p._id === postId);
        if (post) { post.isLiked = liked; post.likesCount = likesCount; }
      };
      updatePost(state.forYouPosts);
      updatePost(state.followingPosts);
      updatePost(state.trendingPosts);
    });

    // Delete post
    builder.addCase(deletePost.fulfilled, (state, action) => {
      const id = action.payload;
      state.forYouPosts = state.forYouPosts.filter((p) => p._id !== id);
      state.followingPosts = state.followingPosts.filter((p) => p._id !== id);
      state.trendingPosts = state.trendingPosts.filter((p) => p._id !== id);
    });
  },
});

export const { clearCreatePostError, addPostRealtime, updatePostLike, removePost, updateBookmark } = postsSlice.actions;
export default postsSlice.reducer;
