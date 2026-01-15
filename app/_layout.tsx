import { Colors } from '@/src/theme';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Alert } from 'react-native';
import '../components/TimerOverlay';
import { TimerOverlay } from '../components/TimerOverlay';
import '../global.css';
import { configService } from '../src/services/ConfigService';
import { dbService } from '../src/services/DatabaseService';
import { UpdateService } from '../src/services/UpdateService';

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

  // Splash Screen Hiding Logic
  useEffect(() => {
    async function hideSplash() {
      if ((fontsLoaded || fontError) && dbInitialized) {
        await SplashScreen.hideAsync();
      }
    }
    hideSplash();
  }, [fontsLoaded, fontError, dbInitialized]);

  useEffect(() => {
    const ready = (fontsLoaded || !!fontError) && dbInitialized;
    if (!ready) return;
    if (updatePromptShown.current) return;
    updatePromptShown.current = true;

    const timeoutId = setTimeout(() => {
      void (async () => {
        const result = await UpdateService.checkForUpdate();
        if (result.status !== 'update_available') return;

        Alert.alert(
          'Actualización disponible',
          `Hay una nueva versión (v${result.latestVersion}).`,
          [
            { text: 'Más tarde', style: 'cancel' },
            {
              text: 'Descargar',
              onPress: async () => {
                const url = result.downloadUrl ?? result.downloadsPageUrl ?? result.notesUrl;
                if (!url) return;
                try {
                  await Linking.openURL(url);
                } catch {
                  Alert.alert('Error', 'No se pudo abrir el enlace.');
                }
              }
            }
          ]
        );
      })();
    }, 900);

    return () => clearTimeout(timeoutId);
  }, [fontsLoaded, fontError, dbInitialized]);

  // Render Loading Fallback (shouldn't be visible due to Splash Screen, but safe guard)
  if ((!fontsLoaded && !fontError) || !dbInitialized) {
    return null;
  }

  return (

    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={IronTrainTheme}>
          <StatusBar style="dark" backgroundColor={Colors.iron[900]} />
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
