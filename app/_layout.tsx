import { ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { AlertTriangle, Download } from 'lucide-react-native';
import { PostHogProvider, PostHogSurveyProvider } from 'posthog-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GlobalNoticeHandler } from '../components/GlobalNoticeHandler';
import MaintenanceMode from '../components/MaintenanceMode';
import { SyncConflictModal } from '../components/SyncConflictModal';
import { TimerOverlay } from '../components/TimerOverlay';
import { WorkoutTimerSync } from '../components/WorkoutTimerSync';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { GlobalBanner } from '../components/ui/GlobalBanner';
import { SyncingOverlay } from '../components/ui/SyncingOverlay';
import { ToastContainer } from '../components/ui/ToastContainer';
import '../global.css';
import { ThemeProvider as AppThemeProvider } from '../src/contexts/ThemeContext';
import { useTheme } from '../src/hooks/useTheme';
import { configService } from '../src/services/ConfigService';
import { dbService } from '../src/services/DatabaseService';
import { feedbackService } from '../src/services/FeedbackService';

import { syncScheduler } from '../src/services/SyncSchedulerService';
import { SyncDiagnostics, syncService } from '../src/services/SyncService';
import { updateService } from '../src/services/UpdateService';
import { useAuthStore } from '../src/store/authStore';
import { useConfirmStore } from '../src/store/confirmStore';
import { useUpdateStore } from '../src/store/updateStore';
import { posthog } from '../src/utils/analytics';
import { logger } from '../src/utils/logger';
import { notify } from '../src/utils/notify';

SplashScreen.preventAutoHideAsync();

type InitErrorInfo = {
  title: string;
  message: string;
  detail?: string;
  notifyTitle: string;
  notifyMessage: string;
};

function classifyInitError(error: any): InitErrorInfo {
  const raw = String(error?.message || error || '').trim();
  const message = raw.toLowerCase();

  if (message.includes('timeout') || message.includes('timed out')) {
    return {
      title: 'Inicio detenido',
      message: 'La inicialización tardó más de lo esperado y parece haberse quedado colgada.',
      detail: raw || undefined,
      notifyTitle: 'Inicio en timeout',
      notifyMessage: 'La app tardó demasiado en iniciar. Tocá Reintentar para relanzar la carga.'
    };
  }

  if (message.includes('sqlite') || message.includes('sql') || message.includes('database') || message.includes('duplicate column')) {
    return {
      title: 'Error de base de datos',
      message: 'La app no pudo inicializar la base local. Esto suele pasar por un cambio de esquema incompatible.',
      detail: raw || undefined,
      notifyTitle: 'Inicio fallido (DB)',
      notifyMessage: 'No se pudo abrir/inicializar la base local. Tocá Reintentar o reinstalá si persiste.'
    };
  }

  if (message.includes('permission') || message.includes('denied') || message.includes('notifee') || message.includes('location')) {
    return {
      title: 'Error de permisos',
      message: 'Hubo un problema solicitando permisos del dispositivo durante el arranque.',
      detail: raw || undefined,
      notifyTitle: 'Inicio fallido (Permisos)',
      notifyMessage: 'Revisá permisos de notificaciones/ubicación y tocá Reintentar.'
    };
  }

  if (message.includes('securestore') || message.includes('auth') || message.includes('token')) {
    return {
      title: 'Error de sesión/configuración',
      message: 'No se pudo restaurar la sesión o configuración local al iniciar.',
      detail: raw || undefined,
      notifyTitle: 'Inicio fallido (Sesión)',
      notifyMessage: 'No se pudo restaurar sesión/configuración. Probá Reintentar.'
    };
  }

  return {
    title: 'Error al iniciar',
    message: 'No se pudo completar el inicio de la app.',
    detail: raw || undefined,
    notifyTitle: 'Inicio fallido',
    notifyMessage: 'La app no pudo iniciar correctamente. Tocá Reintentar.'
  };
}

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

function MainAppContent({ dbInitialized, fontsLoaded, fontError, installedVersion, latestVersion, downloadUrl, notesUrl, initError, onRetryInit }: any) {
  const { activeTheme, currentNavTheme, statusBarStyle } = useTheme();
  const themeRenderKey = `${activeTheme.id}-${activeTheme.mode}`;
  const updateStatus = useUpdateStore((state) => state.status);
  const { needsInitialSync, setNeedsInitialSync, token: authToken } = useAuthStore();
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [syncDiagnostics, setSyncDiagnostics] = useState<SyncDiagnostics | null>(null);
  const [isSyncingInitial, setIsSyncingInitial] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleCopyDiagnostics = useCallback(async () => {
    if (!initError) return;
    const diagnosticText = [
      '[IronTrain Init Error]',
      `Title: ${initError.title}`,
      `Message: ${initError.message}`,
      `Detail: ${initError.detail || 'N/A'}`,
      `Timestamp: ${new Date().toISOString()}`
    ].join('\n');

    try {
      await Clipboard.setStringAsync(diagnosticText);
      notify.success('Diagnóstico copiado', 'Ya podés pegarlo en el reporte.');
    } catch {
      notify.error('No se pudo copiar', 'Copiá manualmente el mensaje de error.');
    }
  }, [initError]);

  useEffect(() => {
    if (needsInitialSync && dbInitialized && authToken) {
      const checkConflicts = async () => {
        setSyncError(null);
        setIsSyncingInitial(true);
        try {
          const diag = await syncService.getDiagnostics();

          if (diag.local.hasData && diag.remote.hasData) {
            setSyncDiagnostics(diag);
            setSyncModalVisible(true);
            setIsSyncingInitial(false);
          } else if (diag.remote.hasData && !diag.local.hasData) {
            // New device / Reinstalled: Pull everything from cloud
            await syncService.pullCloudSnapshot();
            setNeedsInitialSync(false);
            setIsSyncingInitial(false);
            notify.success('Datos recuperados', 'Tu historial se ha sincronizado correctamente.');
          } else if (diag.local.hasData && !diag.remote.hasData) {
            // New account / First sync: Push everything to cloud
            await syncService.pushLocalSnapshot();
            setNeedsInitialSync(false);
            setIsSyncingInitial(false);
            notify.success('Copia guardada', 'Tus datos se han respaldado en la nube.');
          } else {
            // Both empty: Just clear the flag
            setNeedsInitialSync(false);
            setIsSyncingInitial(false);
          }
        } catch (e: any) {
          logger.captureException(e, { scope: 'MainAppContent.checkConflicts' });
          setSyncError(e?.message || 'Error en la sincronización inicial');
          setIsSyncingInitial(false);
        }
      };
      checkConflicts();
    }
  }, [needsInitialSync, dbInitialized, authToken]);

  if (initError) {
    return (
      <View style={{ flex: 1, backgroundColor: activeTheme.colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <StatusBar style={statusBarStyle} />
        <View style={{ alignItems: 'center', marginBottom: 20 }}>
          <AlertTriangle size={56} color={activeTheme.colors.red} />
          <Text style={{ color: activeTheme.colors.text, fontSize: 20, fontWeight: '900', marginTop: 16, textAlign: 'center' }}>
            {initError.title}
          </Text>
          <Text style={{ color: activeTheme.colors.textMuted, textAlign: 'center', marginTop: 8, lineHeight: 20 }}>
            {initError.message}
          </Text>
          {!!initError.detail && (
            <Text style={{ color: activeTheme.colors.textMuted, textAlign: 'center', marginTop: 10, fontSize: 12 }} numberOfLines={3}>
              {initError.detail}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={onRetryInit}
          style={{ backgroundColor: activeTheme.colors.primary.DEFAULT, width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
        >
          <Text style={{ color: activeTheme.colors.onPrimary, fontWeight: '900', fontSize: 16 }}>Reintentar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleCopyDiagnostics}
          style={{ marginTop: 10, borderWidth: 1, borderColor: activeTheme.colors.primary.DEFAULT, width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
        >
          <Text style={{ color: activeTheme.colors.primary.DEFAULT, fontWeight: '900', fontSize: 16 }}>Copiar diagnóstico</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
      <NavigationThemeProvider key={themeRenderKey} value={currentNavTheme}>
        <StatusBar style={statusBarStyle} backgroundColor={activeTheme.colors.background} />
        <SyncingOverlay
          visible={isSyncingInitial}
          error={syncError}
          onRetry={() => setNeedsInitialSync(true)}
          onCancel={() => {
            setNeedsInitialSync(false);
            setSyncError(null);
          }}
        />
        <GlobalBanner />
        <GlobalNoticeHandler />
        <TimerOverlay />
        <WorkoutTimerSync />
        <GlobalConfirmModal />
        <SyncConflictModal
          visible={syncModalVisible}
          diagnostics={syncDiagnostics}
          onClose={() => {
            setSyncModalVisible(false);
            setNeedsInitialSync(false);
          }}
          onComplete={() => {
            setSyncModalVisible(false);
            setNeedsInitialSync(false);
          }}
        />
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
          <Stack.Screen name="theme-studio" options={{ headerShown: false }} />
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
  const [initError, setInitError] = useState<InitErrorInfo | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);
  const updatePromptShown = useRef(false);
  const authToken = useAuthStore((s) => s.token);
  const lastSyncedTokenRef = useRef<string | null>(null);
  const [fontsLoaded, fontError] = useFonts({});

  const updateStatus = useUpdateStore((state) => state.status);
  const installedVersion = useUpdateStore((state) => state.installedVersion);
  const latestVersion = useUpdateStore((state) => state.latestVersion);
  const downloadUrl = useUpdateStore((state) => state.downloadUrl);
  const notesUrl = useUpdateStore((state) => state.notesUrl);

  const initInfo = useCallback(async () => {
    try {
      setInitAttempt((n) => n + 1);
      setInitError(null);
      setDbInitialized(false);

      const { notificationPermissionsService } = await import('../src/services/NotificationPermissionsService');
      const { locationPermissionsService } = await import('../src/services/LocationPermissionsService');

      await useAuthStore.getState().initialize();
      await dbService.init();
      await configService.init();
      setDbInitialized(true);
      await notificationPermissionsService.requestPermissionOnce(false);
      await locationPermissionsService.requestWeatherBonusPermissionOnce();
    } catch (e: any) {
      const info = classifyInitError(e);
      logger.captureException(e, {
        scope: 'RootLayout.initInfo',
        message: 'Initialization failed',
        initErrorTitle: info.title,
        initErrorMessage: info.message
      });
      setInitError(info);
      notify.error(info.notifyTitle, info.notifyMessage);
    }
  }, []);

  useEffect(() => {
    initInfo();
  }, [initInfo]);

  useEffect(() => {
    if (dbInitialized || initError || initAttempt === 0) return;

    const timeoutId = setTimeout(() => {
      const info = classifyInitError(new Error('Initialization timeout (> 15s)'));
      logger.captureException(new Error('Initialization timeout (> 15s)'), {
        scope: 'RootLayout.initWatchdog',
        message: 'Initialization appears hung'
      });
      setInitError(info);
      notify.error(info.notifyTitle, info.notifyMessage);
    }, 15000);

    return () => clearTimeout(timeoutId);
  }, [dbInitialized, initError, initAttempt]);

  useEffect(() => {
    return () => {
      feedbackService.dispose().catch((e) => {
        logger.captureException(e, { scope: 'RootLayout.cleanup', message: 'feedbackService.dispose failed' });
      });
      syncScheduler.dispose();
    };
  }, []);

  useEffect(() => {
    const { needsInitialSync } = useAuthStore.getState();
    if (!dbInitialized || !authToken || needsInitialSync) return;
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
      if ((fontsLoaded || fontError) && (dbInitialized || !!initError)) {
        await SplashScreen.hideAsync();
      }
    }
    hideSplash();
  }, [fontsLoaded, fontError, dbInitialized, initError]);

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
      <PostHogSurveyProvider>
        <SafeAreaProvider>
          <AppThemeProvider>
            <MaintenanceMode>
              <MainAppContent
                dbInitialized={dbInitialized}
                fontsLoaded={fontsLoaded}
                fontError={fontError}
                installedVersion={installedVersion}
                latestVersion={latestVersion}
                downloadUrl={downloadUrl}
                notesUrl={notesUrl}
                initError={initError}
                onRetryInit={initInfo}
              />
            </MaintenanceMode>
          </AppThemeProvider>
        </SafeAreaProvider>
      </PostHogSurveyProvider>
    </PostHogProvider>
  );
}
