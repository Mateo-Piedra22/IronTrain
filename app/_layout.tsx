import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AlertTriangle, Download } from 'lucide-react-native';
import { PostHogProvider } from 'posthog-react-native';
import { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GlobalNoticeHandler } from '../components/GlobalNoticeHandler';
import { TimerOverlay } from '../components/TimerOverlay';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { GlobalBanner } from '../components/ui/GlobalBanner';
import { ToastContainer } from '../components/ui/ToastContainer';
import '../global.css';
import { ThemeProvider as AppThemeProvider } from '../src/contexts/ThemeContext';
import { useTheme } from '../src/hooks/useTheme';
import { configService } from '../src/services/ConfigService';
import { dbService } from '../src/services/DatabaseService';
import { feedbackService } from '../src/services/FeedbackService';
import { MetricsAndFeedbackService } from '../src/services/MetricsAndFeedbackService';
import { syncScheduler } from '../src/services/SyncSchedulerService';
import { updateService } from '../src/services/UpdateService';
import { useAuthStore } from '../src/store/authStore';
import { useConfirmStore } from '../src/store/confirmStore';
import { useUpdateStore } from '../src/store/updateStore';
import { posthog } from '../src/utils/analytics';
import { logger } from '../src/utils/logger';
import { notify } from '../src/utils/notify';

SplashScreen.preventAutoHideAsync();

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

function MainAppContent({ dbInitialized, fontsLoaded, fontError, installedVersion, latestVersion, downloadUrl, notesUrl }: any) {
  const { activeTheme, currentNavTheme, statusBarStyle } = useTheme();
  const updateStatus = useUpdateStore((state) => state.status);

  if ((!fontsLoaded && !fontError) || !dbInitialized) {
    return null;
  }

  if (updateStatus === 'deprecated') {
    return (
      <View style={{ flex: 1, backgroundColor: activeTheme.colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <StatusBar style={statusBarStyle} />
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <AlertTriangle size={64} color={activeTheme.colors.primary.DEFAULT} />
          <Text style={{ color: activeTheme.colors.text, fontSize: 22, fontWeight: '900', marginTop: 16, textAlign: 'center' }}>
            Actualización Requerida
          </Text>
          <Text style={{ color: activeTheme.colors.textMuted, textAlign: 'center', marginTop: 8, paddingHorizontal: 16, lineHeight: 20 }}>
            Tu versión de IronTrain es demasiado antigua y ya no es compatible. Por favor, actualiza para continuar.
          </Text>
          <Text style={{ color: activeTheme.colors.textMuted, fontSize: 11, marginTop: 16, fontVariant: ['tabular-nums'], fontWeight: '600' }}>
            v{installedVersion} {'->'}  v{latestVersion}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            const url = downloadUrl ?? notesUrl;
            if (url) Linking.openURL(url);
          }}
          style={{ backgroundColor: activeTheme.colors.primary.DEFAULT, width: '100%', paddingVertical: 16, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Download size={20} color={activeTheme.colors.onPrimary} />
          <Text style={{ color: activeTheme.colors.onPrimary, fontWeight: '900', fontSize: 16 }}>Descargar Actualización</Text>
        </TouchableOpacity>
      </View>
    );
  }
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationThemeProvider value={currentNavTheme}>
        <StatusBar style={statusBarStyle} backgroundColor={activeTheme.colors.background} />
        <GlobalBanner />
        <GlobalNoticeHandler />
        <TimerOverlay />
        <GlobalConfirmModal />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: activeTheme.colors.background },
            headerTintColor: activeTheme.colors.primary.DEFAULT,
            headerTitleStyle: { fontWeight: 'bold', color: activeTheme.colors.text },
            contentStyle: { backgroundColor: activeTheme.colors.background },
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
      </NavigationThemeProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [dbInitialized, setDbInitialized] = useState(false);
  const updatePromptShown = useRef(false);
  const authToken = useAuthStore((s) => s.token);
  const lastSyncedTokenRef = useRef<string | null>(null);
  const [fontsLoaded, fontError] = useFonts({});

  const updateStatus = useUpdateStore((state) => state.status);
  const installedVersion = useUpdateStore((state) => state.installedVersion);
  const latestVersion = useUpdateStore((state) => state.latestVersion);
  const downloadUrl = useUpdateStore((state) => state.downloadUrl);
  const notesUrl = useUpdateStore((state) => state.notesUrl);

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
        await notificationPermissionsService.requestPermissionOnce(false);
        await locationPermissionsService.requestWeatherBonusPermissionOnce();
      } catch (e) {
        logger.captureException(e, { scope: 'RootLayout.initInfo', message: 'Initialization failed' });
        notify.error('Error', 'No se pudo iniciar la aplicación. Reiniciá e intentá de nuevo.');
      }
    }
    initInfo();
  }, []);

  useEffect(() => {
    return () => {
      feedbackService.dispose().catch((e) => {
        logger.captureException(e, { scope: 'RootLayout.cleanup', message: 'feedbackService.dispose failed' });
      });
      syncScheduler.dispose();
    };
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

        syncScheduler.init();
        await syncScheduler.syncNow();
        await configService.reload();

        const { PushRegistrationService } = await import('../src/services/PushRegistrationService');
        PushRegistrationService.registerForPushNotifications().catch(e => {
          logger.captureException(e, { scope: 'RootLayout.runInitialSync', message: 'Push registration failed' });
        });
      } catch (e) {
        notify.error('Sync fallido', 'No se pudo sincronizar con Neon');
        logger.captureException(e, { scope: 'RootLayout.runInitialSync', message: 'Initial sync trigger failed' });
      }
    };
    runInitialSync();
  }, [dbInitialized, authToken]);

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

  return (
    <PostHogProvider client={posthog}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <MainAppContent
            dbInitialized={dbInitialized}
            fontsLoaded={fontsLoaded}
            fontError={fontError}
            installedVersion={installedVersion}
            latestVersion={latestVersion}
            downloadUrl={downloadUrl}
            notesUrl={notesUrl}
          />
        </AppThemeProvider>
      </SafeAreaProvider>
    </PostHogProvider>
  );
}
