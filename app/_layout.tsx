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
import { GlobalNoticeHandler } from '../components/GlobalNoticeHandler';
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

SplashScreen.preventAutoHideAsync();

const IronTrainTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.primary.DEFAULT,
    background: Colors.iron[900],
    card: Colors.iron[900],
    text: Colors.iron[950],
    border: Colors.iron[300],
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
  const [fontsLoaded, fontError] = useFonts({});

  useEffect(() => {
    async function initInfo() {
      try {
        const { notificationPermissionsService } = await import('../src/services/NotificationPermissionsService');
        const { locationPermissionsService } = await import('../src/services/LocationPermissionsService');
        await useAuthStore.getState().initialize();
        await dbService.init();
        await configService.init();
        setDbInitialized(true);
        MetricsAndFeedbackService.trackInstallIfNeeded();
        await notificationPermissionsService.requestPermission(false);
        await locationPermissionsService.requestWeatherBonusPermissionOnce();
      } catch (e) {
        console.error('CRITICAL: Initialization failed:', e);
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
        const res = await dbService.getFirst<{ value: string }>('SELECT value FROM settings WHERE key = ?', ['last_pull_sync']);
        if (!res) {
          await dbService.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['last_pull_sync', '0']);
        }
        await syncService.syncBidirectional();
        await configService.reload();

        // Register for push notifications
        const { PushRegistrationService } = await import('../src/services/PushRegistrationService');
        PushRegistrationService.registerForPushNotifications().catch(e => console.warn('Push registration failed:', e));
      } catch (e) {
        notify.error('Sync fallido', 'No se pudo sincronizar con Neon');
        console.error('Initial sync trigger failed:', e);
      }
    };
    runInitialSync();
  }, [dbInitialized, authToken]);

  useEffect(() => {
    if (!dbInitialized) return;
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        syncService.syncBidirectional().catch(e => console.error('Background sync failed:', e));
      }
    });
    return () => unsubscribe();
  }, [dbInitialized]);

  useEffect(() => {
    async function hideSplash() {
      if ((fontsLoaded || fontError) && dbInitialized) {
        await SplashScreen.hideAsync();
      }
    }
    hideSplash();
  }, [fontsLoaded, fontError, dbInitialized]);

  useEffect(() => {
    if (dbInitialized) {
      updateService.init();
    }
  }, [dbInitialized]);

  const updateStatus = useUpdateStore((state) => state.status);
  const installedVersion = useUpdateStore((state) => state.installedVersion);
  const latestVersion = useUpdateStore((state) => state.latestVersion);
  const downloadUrl = useUpdateStore((state) => state.downloadUrl);
  const notesUrl = useUpdateStore((state) => state.notesUrl);

  useEffect(() => {
    if (updateStatus === 'update_available' && !updatePromptShown.current) {
      updatePromptShown.current = true;
      notify.banner(
        `Nueva versión ${latestVersion} lista para descargar.`,
        'info',
        'Actualizar',
        () => {
          const url = downloadUrl ?? notesUrl;
          if (url) Linking.openURL(url);
        }
      );
    }
  }, [updateStatus, latestVersion, downloadUrl, notesUrl]);

  if ((!fontsLoaded && !fontError) || !dbInitialized) {
    return null;
  }

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
              v{installedVersion} {'->'}  v{latestVersion}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              const url = downloadUrl ?? notesUrl;
              if (url) Linking.openURL(url);
            }}
            style={{ backgroundColor: Colors.primary.DEFAULT, width: '100%', paddingVertical: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <Download size={20} color={Colors.white} />
            <Text style={{ color: Colors.white, fontWeight: '900', fontSize: 16 }}>Descargar Actualización</Text>
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
          <GlobalNoticeHandler />
          <TimerOverlay />
          <GlobalConfirmModal />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: Colors.iron[900] },
              headerTintColor: Colors.primary.DEFAULT,
              headerTitleStyle: { fontWeight: 'bold', color: Colors.iron[950] },
              contentStyle: { backgroundColor: Colors.iron[900] },
              animation: 'slide_from_right'
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'IronTrain' }} />
            <Stack.Screen name="changelog" options={{ presentation: 'modal', title: 'Novedades' }} />
            <Stack.Screen name="workout/[id]" options={{ title: 'Sesión', headerBackTitle: 'Atrás' }} />
            <Stack.Screen name="share/routine/[id]" options={{ presentation: 'modal', headerShown: false }} />
          </Stack>
          <ToastContainer />
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
