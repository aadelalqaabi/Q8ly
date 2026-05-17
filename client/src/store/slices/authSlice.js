import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../../services/api';
import { initSocket, disconnectSocket } from '../../services/socket';
import { upsertCurrentAccount } from '../../utils/accountsStore';

// ── Async Thunks ──────────────────────────────────────────────────────────────

export const register = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const response = await authAPI.register(data);
    await AsyncStorage.setItem('token', response.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.user));
    await initSocket();
    return response;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const login = createAsyncThunk('auth/login', async (data, { rejectWithValue }) => {
  try {
    const response = await authAPI.login(data);
    await AsyncStorage.setItem('token', response.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.user));
    await initSocket();
    return response;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const sendOtp = createAsyncThunk('auth/sendOtp', async (phone, { rejectWithValue }) => {
  try {
    return await authAPI.sendOtp(phone);
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const verifyOtp = createAsyncThunk('auth/verifyOtp', async ({ phone, code, name }, { rejectWithValue }) => {
  try {
    const response = await authAPI.verifyOtp(phone, code, name);
    await AsyncStorage.setItem('token', response.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.user));
    // Save into multi-account store
    await upsertCurrentAccount(response.token, response.user);
    await initSocket();
    return response;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const getMe = createAsyncThunk('auth/getMe', async (_, { rejectWithValue }) => {
  try {
    const response = await authAPI.getMe();
    return response;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const restoreSession = createAsyncThunk('auth/restoreSession', async (_, { rejectWithValue }) => {
  const token = await AsyncStorage.getItem('token');
  const userStr = await AsyncStorage.getItem('user');

  if (!token || !userStr) return null;

  const storedUser = JSON.parse(userStr);

  try {
    // Refresh user data from server
    const response = await authAPI.getMe();
    await AsyncStorage.setItem('user', JSON.stringify(response.user));
    await initSocket();
    return { token, user: response.user };
  } catch (error) {
    // Token explicitly rejected — wipe and force re-login
    if (error.status === 401) {
      await AsyncStorage.multiRemove(['token', 'user']);
      return rejectWithValue('Session expired');
    }
    // Network/server unreachable — restore from cache so user stays logged in
    await initSocket();
    return { token, user: storedUser };
  }
});

export const logout = createAsyncThunk('auth/logout', async () => {
  await AsyncStorage.multiRemove(['token', 'user']);
  disconnectSocket();
});

export const claimDailyBonus = createAsyncThunk('auth/claimDailyBonus', async (_, { rejectWithValue }) => {
  try {
    return await authAPI.dailyBonus();
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

export const switchToAccount = createAsyncThunk('auth/switchToAccount', async ({ token, user }) => {
  await AsyncStorage.setItem('token', token);
  await AsyncStorage.setItem('user', JSON.stringify(user));
  disconnectSocket();
  await initSocket();
  return { token, user };
});

export const updateProfile = createAsyncThunk('auth/updateProfile', async (data, { rejectWithValue }) => {
  try {
    const { usersAPI } = await import('../../services/api');
    const response = await usersAPI.updateProfile(data);
    await AsyncStorage.setItem('user', JSON.stringify(response.user));
    return response;
  } catch (error) {
    return rejectWithValue(error.message);
  }
});

// ── Slice ─────────────────────────────────────────────────────────────────────

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: null,
    isAuthenticated: false,
    isGuest: false,
    needsName: false,
    isLoading: false,
    isSessionRestored: false,
    error: null,
  },
  reducers: {
    clearError: (state) => { state.error = null; },
    updateUserLocally: (state, action) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    },
    enterGuestMode: (state) => {
      state.isGuest = true;
    },
    exitGuestMode: (state) => {
      state.isGuest = false;
    },
  },
  extraReducers: (builder) => {
    // Send OTP
    builder
      .addCase(sendOtp.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(sendOtp.fulfilled, (state) => { state.isLoading = false; })
      .addCase(sendOtp.rejected, (state, action) => { state.isLoading = false; state.error = action.payload; });

    // Verify OTP → login/register
    builder
      .addCase(verifyOtp.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(verifyOtp.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.isGuest = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.needsName = action.payload.isNewUser && !action.payload.user?.name;
      })
      .addCase(verifyOtp.rejected, (state, action) => { state.isLoading = false; state.error = action.payload; });

    // Register
    builder
      .addCase(register.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Login
    builder
      .addCase(login.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isAuthenticated = true;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });

    // Get Me
    builder
      .addCase(getMe.fulfilled, (state, action) => {
        state.user = action.payload.user;
      });

    // Restore session
    builder
      .addCase(restoreSession.pending, (state) => { state.isLoading = true; })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSessionRestored = true;
        if (action.payload) {
          state.isAuthenticated = true;
          state.isGuest = false;
          state.user = action.payload.user;
          state.token = action.payload.token;
          state.needsName = !action.payload.user?.name;
        } else {
          // No saved session — require sign-up
          state.isGuest = false;
        }
      })
      .addCase(restoreSession.rejected, (state) => {
        state.isLoading = false;
        state.isSessionRestored = true;
        state.isAuthenticated = false;
        state.isGuest = false; // Session expired — require sign-in
        state.user = null;
        state.token = null;
      });

    // Logout → back to sign-in
    builder.addCase(logout.fulfilled, (state) => {
      state.isAuthenticated = false;
      state.isGuest = false;
      state.user = null;
      state.token = null;
    });

    // Switch account
    builder.addCase(switchToAccount.fulfilled, (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.isGuest = false;
      state.needsName = false;
    });

    // Update profile
    builder
      .addCase(updateProfile.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = { ...state.user, ...action.payload.user };
        if (action.payload.user?.name) state.needsName = false;
      })
      .addCase(updateProfile.rejected, (state, action) => { state.isLoading = false; state.error = action.payload; });

    // Daily bonus
    builder.addCase(claimDailyBonus.fulfilled, (state, action) => {
      if (state.user && !action.payload.alreadyClaimed) {
        state.user = { ...state.user, hachiPoints: action.payload.hachiPoints };
      }
    });

  },
});

export const { clearError, updateUserLocally, enterGuestMode, exitGuestMode } = authSlice.actions;
export default authSlice.reducer;
