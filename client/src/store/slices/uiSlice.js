import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    isDarkMode: false,
    isRTL: false, // Arabic layout
    language: 'en', // 'en' | 'ar'
    nowBarItems: [], // Real-time "Now Bar" items
    kuwaitBrief: null, // Latest Kuwait Brief
    isCreatePostModalOpen: false,
    activeTab: 'home', // bottom tab
  },
  reducers: {
    setDarkMode: (state, action) => { state.isDarkMode = action.payload; },
    setLanguage: (state, action) => {
      state.language = action.payload;
      state.isRTL = action.payload === 'ar';
    },
    setNowBarItems: (state, action) => { state.nowBarItems = action.payload; },
    addNowBarItem: (state, action) => {
      state.nowBarItems.unshift(action.payload);
      if (state.nowBarItems.length > 5) state.nowBarItems.pop();
    },
    setKuwaitBrief: (state, action) => { state.kuwaitBrief = action.payload; },
    openCreatePostModal: (state) => { state.isCreatePostModalOpen = true; },
    closeCreatePostModal: (state) => { state.isCreatePostModalOpen = false; },
    setActiveTab: (state, action) => { state.activeTab = action.payload; },
  },
});

export const {
  setDarkMode, setLanguage, setNowBarItems, addNowBarItem,
  setKuwaitBrief, openCreatePostModal, closeCreatePostModal, setActiveTab,
} = uiSlice.actions;
export default uiSlice.reducer;
