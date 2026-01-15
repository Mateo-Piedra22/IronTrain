import { Colors } from '@/src/theme';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../components/TimerOverlay';
import { TimerOverlay } from '../components/TimerOverlay';
import '../global.css';
import { dbService } from '../src/services/DatabaseService';

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
  const [fontsLoaded, fontError] = useFonts({
    // Add custom fonts here if required (e.g., Inter/Roboto)
  });

  // Database Initialization Logic
  useEffect(() => {
    async function initInfo() {
      try {
        await dbService.init();
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
            {/* Dynamic workout screen */}
            <Stack.Screen
              name="workout/[id]"
              options={{
                title: 'Session',
                headerBackTitle: 'Back'
              }}
            />
          </Stack>
        </ThemeProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
