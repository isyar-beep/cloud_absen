import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CameraScreen from './src/screens/CameraScreen';
import { useAuthStore } from './src/store/authStore';

const Stack = createNativeStackNavigator();

export default function App() {
  const { token, restoreSession } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    restoreSession().finally(() => setReady(true));
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
