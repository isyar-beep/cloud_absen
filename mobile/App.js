import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CameraScreen from './src/screens/CameraScreen';
import LeavesScreen from './src/screens/LeavesScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import { useAuthStore } from './src/store/authStore';
import { registerForPushNotifications } from './src/services/notifications';

const Stack = createNativeStackNavigator();

export default function App() {
  const { token, restoreSession } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    restoreSession().then((restoredToken) => {
      if (restoredToken) registerForPushNotifications();
    }).finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        initialRouteName={token ? 'Dashboard' : 'Login'}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ headerShown: true, title: 'Cloud Absen' }} />
        <Stack.Screen name="Camera" component={CameraScreen} options={{ headerShown: true, title: 'Ambil Foto Absensi' }} />
        <Stack.Screen name="Leaves" component={LeavesScreen} options={{ headerShown: true, title: 'Pengajuan Izin' }} />
        <Stack.Screen name="History" component={HistoryScreen} options={{ headerShown: true, title: 'Riwayat Absensi' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
