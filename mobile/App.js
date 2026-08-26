import { useEffect, useState } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import CameraScreen from './src/screens/CameraScreen';
import LeavesScreen from './src/screens/LeavesScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import { useAuthStore } from './src/store/authStore';
import { useWarna, useThemeStore } from './src/theme';
import { registerForPushNotifications } from './src/services/notifications';

const Stack = createNativeStackNavigator();

export default function App() {
  const { token, restoreSession } = useAuthStore();
  const muatTema = useThemeStore((s) => s.muat);
  const w = useWarna();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Tema dimuat bersamaan dengan sesi, sebelum layar pertama digambar.
    // Kalau dibaca belakangan, aplikasi sempat berkedip dengan tema yang
    // salah -- menyilaukan kalau pilihannya gelap.
    Promise.all([
      restoreSession().then((restoredToken) => {
        if (restoredToken) registerForPushNotifications();
      }),
      muatTema(),
    ]).finally(() => setReady(true));
  }, []);

  if (!ready) return null;

  // Tema navigasi ikut palet aplikasi. Tanpa ini, latar di balik layar
  // saat berpindah halaman dan header bawaan navigator tetap putih --
  // berkedip terang setiap kali berpindah menu dalam mode gelap.
  const temaNavigasi = {
    ...(w.gelap ? DarkTheme : DefaultTheme),
    colors: {
      ...(w.gelap ? DarkTheme : DefaultTheme).colors,
      background: w.latar,
      card: w.permukaan,
      text: w.teks,
      border: w.garis,
      primary: w.utama,
    },
  };

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={temaNavigasi}>
        {/* Ikon bilah status dibalik mengikuti tema: gelap di atas latar
            terang, terang di atas latar gelap. Sebelumnya dipaku "dark",
            sehingga jam dan ikon sinyal nyaris tak terlihat di mode gelap. */}
        <StatusBar style={w.gelap ? 'light' : 'dark'} />
        <Stack.Navigator
          initialRouteName={token ? 'Dashboard' : 'Login'}
          screenOptions={{
            headerShown: false,
            headerStyle: { backgroundColor: w.permukaan },
            headerTitleStyle: { color: w.teks },
            headerTintColor: w.utama,
            contentStyle: { backgroundColor: w.latar },
          }}
        >
          {/* Dashboard dan Camera memakai kepala layarnya sendiri (hero biru
              dan bilah gelap di atas kamera), jadi header bawaan navigator
              dimatikan supaya tidak bertumpuk dua. */}
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Camera" component={CameraScreen} />
          <Stack.Screen name="Leaves" component={LeavesScreen} options={{ headerShown: true, title: 'Pengajuan Izin' }} />
          <Stack.Screen name="History" component={HistoryScreen} options={{ headerShown: true, title: 'Riwayat Absensi' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
