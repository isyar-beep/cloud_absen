import { create } from 'zustand';

const storedUser = localStorage.getItem('user');

export const useAuthStore = create((set) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  token: localStorage.getItem('token') || null,

  login: (user, token) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
    set({ user, token });
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));
