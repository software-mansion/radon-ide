import { createSlice } from '@reduxjs/toolkit'

interface NavigationState {
  token: string | undefined
  userInfo: any | undefined
  language: string
}

const initialState: NavigationState = {
  token: undefined,
  userInfo: undefined,
  language: 'en',
}

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setToken: (state, action) => {
      state.token = action.payload
    },
    setUserInfo: (state, action) => {
      state.userInfo = action.payload
    },
    setLanguage: (state, action) => {
      state.language = action.payload
    },

    clearUser: (state) => {
      state.token = undefined
      state.userInfo = undefined
    },
  },
})

// Action creators are generated for each case reducer function
export const { setUserInfo, setToken, clearUser, setLanguage } = userSlice.actions
