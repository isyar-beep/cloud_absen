import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAuthStore = create((set) => ({
  user: null,
  token: null,

  login: async (user, token) => {
    await AsyncStorage.setItem('user', JSON.stringify(user));
    await AsyncStorage.setItem('token', token);
    set({ user, token });
  },

  restoreSession: async () => {
    const userStr = await AsyncStorage.getItem('user');
    const token = await AsyncStorage.getItem('token');
    if (userStr && token) {
      set({ user: JSON.parse(userStr), token });
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('user');
    await AsyncStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));
