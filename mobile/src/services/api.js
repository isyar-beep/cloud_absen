import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// PENTING: ganti dengan URL backend production Anda saat build APK final
const API_URL = 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
