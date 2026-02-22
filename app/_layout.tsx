import { ChangelogService } from '@/src/services/ChangelogService';
import { Colors } from '@/src/theme';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AlertTriangle, Download } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../components/TimerOverlay';
import { TimerOverlay } from '../components/TimerOverlay';
import { GlobalBanner } from '../components/ui/GlobalBanner';
import { ToastContainer } from '../components/ui/ToastContainer';
import '../global.css';
import { configService } from '../src/services/ConfigService';
import { dbService } from '../src/services/DatabaseService';
import { updateService } from '../src/services/UpdateService';
import { useUpdateStore } from '../src/store/updateStore';
import { notify } from '../src/utils/notify';

/**
 * IronTrain Entry Point
 * 
 * Responsibilities:
 * 1. Initialize Global Database (Offline-first).
 * 2. Load Assets/Fonts.
 * 3. Configure Global Theme (IronTrain Industrial).
 * 4. Manage Splash Screen.
 */

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// IronTrain Cream & Coffee Theme
// Cream Background (#fff7f1), Coffee Primary (#5c2e2e), Dark Text (#321414)
const IronTrainTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.primary.DEFAULT, // Marrón Rojizo
    background: Colors.iron[900], // Cream
    card: Colors.iron[900], // Cream (Header)
    text: Colors.iron[950], // Dark Coffee
    border: Colors.iron[300], // Light Gray
    notification: Colors.primary.DEFAULT,
  },
};

export default function RootLayout() {
  const router = useRouter();
  const [dbInitialized, setDbInitialized] = useState(false);
  const updatePromptShown = useRef(false);
  const [fontsLoaded, fontError] = useFonts({
    // Add custom fonts here if required (e.g., Inter/Roboto)
  });

  // Database Initialization Logic
  useEffect(() => {
    async function initInfo() {
      try {
        await dbService.init();
        await configService.init();
        setDbInitialized(true);
      } catch (e) {
        console.error('CRITICAL: Database init failed:', e);
        // In production, we should log this to a crash reporting service (Sentry)
      }
    }
    initInfo();
  }, []);

  // What's new proactive banner
  useEffect(() => {
    if (dbInitialized) {
      const currentVersion = ChangelogService.getAppVersion();
      const lastAppVersion = configService.get('lastViewedChangelogVersion') || '0.0.0';
      if (lastAppVersion !== '0.0.0' && currentVersion !== lastAppVersion) {
        notify.banner(
          `¡Actualizado a v${currentVersion}! Toca para ver qué hay de nuevo. 🎉`,
          'success',
          'Novedades',
          () => router.push('/changelog'),
          true
        );
      }
      if (lastAppVersion !== currentVersion) {
        configService.set('lastViewedChangelogVersion', currentVersion);
      }
    }
  }, [dbInitialized, router]);

  // Splash Screen Hiding Logic
  useEffect(() => {
    async function hideSplash() {
      if ((fontsLoaded || fontError) && dbInitialized) {
        await SplashScreen.hideAsync();
      }
    }
    hideSplash();
  }, [fontsLoaded, fontError, dbInitialized]);

  // Initialize Update Service
  useEffect(() => {
    updateService.init();
  }, []);

  // Monitor Update Status (Blocking & Notifications)
  const updateStatus = useUpdateStore((state) => state.status);
  const installedVersion = useUpdateStore((state) => state.installedVersion);
  const latestVersion = useUpdateStore((state) => state.latestVersion);
  const downloadUrl = useUpdateStore((state) => state.downloadUrl);
  const notesUrl = useUpdateStore((state) => state.notesUrl);

  const updateInfo = {
    installedVersion,
    latestVersion,
    downloadUrl,
    notesUrl,
    downloadsPageUrl: downloadUrl // fallback
  };

  useEffect(() => {
    if (updateStatus === 'update_available' && !updatePromptShown.current) {
      updatePromptShown.current = true;
      notify.banner(
        `Nueva versión ${updateInfo.latestVersion} lista para descargar.`,
        'info',
        'Actualizar',
        () => {
          const url = updateInfo.downloadUrl ?? updateInfo.notesUrl;
          if (url) Linking.openURL(url);
        }
      );
    }
  }, [updateStatus, updateInfo]);

  // Render Loading Fallback (shouldn't be visible due to Splash Screen, but safe guard)
  if ((!fontsLoaded && !fontError) || !dbInitialized) {
    return null;
  }

  // FORCE UPDATE BLOCKING SCREEN
  if (updateStatus === 'deprecated') {
    return (
      <SafeAreaProvider>
        <View className="flex-1 bg-iron-900 items-center justify-center p-6">
          <StatusBar style="light" />
          <View className="items-center mb-8">
            <AlertTriangle size={64} color={Colors.primary.DEFAULT} />
            <Text className="text-iron-950 text-2xl font-bold mt-4 text-center">
              Actualización Requerida
            </Text>
            <Text className="text-iron-600 text-center mt-2 px-4">
              Tu versión de IronTrain es demasiado antigua y ya no es compatible. Por favor, actualiza para continuar.
            </Text>
            <Text className="text-iron-500 text-xs mt-4 font-mono">
              v{updateInfo.installedVersion} {'->'} v{updateInfo.latestVersion}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              const url = updateInfo.downloadUrl ?? updateInfo.notesUrl;
              if (url) Linking.openURL(url);
            }}
            className="bg-primary w-full py-4 rounded-xl flex-row items-center justify-center gap-2"
          >
            <Download size={20} color="white" />
            <Text className="text-white font-bold text-lg">Descargar Actualización</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  return (

    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={IronTrainTheme}>
          <StatusBar style="dark" backgroundColor={Colors.iron[900]} />
          <ToastContainer />
          <GlobalBanner />
          <TimerOverlay />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: Colors.iron[900], // Cream
              },
              headerTintColor: Colors.primary.DEFAULT, // Primary
              headerTitleStyle: {
                fontWeight: 'bold',
                color: Colors.iron[950] // Dark Coffee
              },
              contentStyle: {
                backgroundColor: Colors.iron[900] // Cream Body
              },
              animation: 'slide_from_right' // Smooth native transition
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal"
              options={{
                presentation: 'modal',
                title: 'IronTrain'
              }}
            />
            <Stack.Screen
              name="changelog"
              options={{
                presentation: 'modal',
                title: 'Novedades'
              }}
            />
            {/* Dynamic workout screen */}
            <Stack.Screen
              name="workout/[id]"
              options={{
                title: 'Sesión',
                headerBackTitle: 'Atrás'
              }}
            />
          </Stack>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
