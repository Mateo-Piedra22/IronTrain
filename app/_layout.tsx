import { ChangelogService } from '@/src/services/ChangelogService';
import { Colors } from '@/src/theme';
import NetInfo from '@react-native-community/netinfo';
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
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { GlobalBanner } from '../components/ui/GlobalBanner';
import { ToastContainer } from '../components/ui/ToastContainer';
import '../global.css';
import { configService } from '../src/services/ConfigService';
import { dbService } from '../src/services/DatabaseService';
import { MetricsAndFeedbackService } from '../src/services/MetricsAndFeedbackService';
import { syncService } from '../src/services/SyncService';
import { updateService } from '../src/services/UpdateService';
import { useAuthStore } from '../src/store/authStore';
import { useConfirmStore } from '../src/store/confirmStore';
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

function GlobalConfirmModal() {
  const { visible, config, hide } = useConfirmStore();
  return (
    <ConfirmModal
      visible={visible}
      onClose={hide}
      title={config.title}
      message={config.message}
      variant={config.variant}
      buttons={config.buttons?.map((b: any) => ({
        ...b,
        onPress: b.onPress ?? hide,
      }))}
    />
  );
}

export default function RootLayout() {
  const router = useRouter();
  const [dbInitialized, setDbInitialized] = useState(false);
  const updatePromptShown = useRef(false);
  const authToken = useAuthStore((s) => s.token);
  const lastSyncedTokenRef = useRef<string | null>(null);
  const [fontsLoaded, fontError] = useFonts({
    // Add custom fonts here if required (e.g., Inter/Roboto)
  });

  // Database and Auth Initialization Logic
  useEffect(() => {
    async function initInfo() {
      try {
        await useAuthStore.getState().initialize();
        await dbService.init();
        await configService.init();
        setDbInitialized(true);
        // Track install analytics asynchronously
        MetricsAndFeedbackService.trackInstallIfNeeded();
      } catch (e) {
        console.error('CRITICAL: Initialization failed:', e);
        // In production, we should log this to a crash reporting service (Sentry)
      }
    }
    initInfo();
  }, []);

  useEffect(() => {
    if (!dbInitialized || !authToken) return;
    if (lastSyncedTokenRef.current === authToken) return;
    lastSyncedTokenRef.current = authToken;

    const runInitialSync = async () => {
      try {
        // We ensure last_pull_sync starts at 0 if it's the first time, 
        // ensuring we pull EVERYTHING if needed.
        const res = await dbService.getFirst<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['last_pull_sync']);
        if (!res) {
          await dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['last_pull_sync', '0']);
        }
        await syncService.syncBidirectional();
      } catch (e) {
        notify.error('Sync fallido', 'No se pudo sincronizar con Neon');
        console.error('Initial sync trigger failed:', e);
      }
    };

    runInitialSync();
  }, [dbInitialized, authToken]);

  // What's new proactive banner
  useEffect(() => {
    if (dbInitialized) {
      const currentVersion = ChangelogService.getAppVersion();
      const lastAppVersion = configService.get('lastViewedChangelogVersion') || '0.0.0';
      if (lastAppVersion !== '0.0.0' && currentVersion !== lastAppVersion) {
        notify.banner(
          `¡Actualizado a v${currentVersion}! Toca para ver qué hay de nuevo.`,
          'success',
          'Novedades',
          () => router.push('/changelog'),
          true
        );
      }
    }
  }, [dbInitialized, router]);

  // Network Monitoring for Sync
  useEffect(() => {
    if (!dbInitialized) return;

    const unsubscribe = NetInfo.addEventListener(state => {
      // If we go from offline to online, trigger bidirectional sync
      if (state.isConnected && state.isInternetReachable) {
        syncService.syncBidirectional().catch(e => {
          console.error('Background sync failed:', e);
        });
      }
    });

    return () => unsubscribe();
  }, [dbInitialized]);

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
    if (dbInitialized) {
      updateService.init();
    }
  }, [dbInitialized]);

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
        <View style={{ flex: 1, backgroundColor: Colors.iron[900], alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <StatusBar style="light" />
          <View style={{ alignItems: 'center', marginBottom: 32 }}>
            <AlertTriangle size={64} color={Colors.primary.DEFAULT} />
            <Text style={{ color: Colors.iron[950], fontSize: 22, fontWeight: '900', marginTop: 16, textAlign: 'center' }}>
              Actualización Requerida
            </Text>
            <Text style={{ color: Colors.iron[500], textAlign: 'center', marginTop: 8, paddingHorizontal: 16, lineHeight: 20 }}>
              Tu versión de IronTrain es demasiado antigua y ya no es compatible. Por favor, actualiza para continuar.
            </Text>
            <Text style={{ color: Colors.iron[400], fontSize: 11, marginTop: 16, fontVariant: ['tabular-nums'], fontWeight: '600' }}>
              v{updateInfo.installedVersion} {'->'}  v{updateInfo.latestVersion}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              const url = updateInfo.downloadUrl ?? updateInfo.notesUrl;
              if (url) Linking.openURL(url);
            }}
            style={{ backgroundColor: Colors.primary.DEFAULT, width: '100%', paddingVertical: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Download size={20} color="white" />
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Descargar Actualización</Text>
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
          <GlobalBanner />
          <TimerOverlay />
          <GlobalConfirmModal />
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
            {/* Social Share Preview Modal */}
            <Stack.Screen
              name="share/routine/[id]"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
          </Stack>
          <ToastContainer />
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
