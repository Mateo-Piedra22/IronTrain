import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import '../global.css';

import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TimerOverlay } from '../components/TimerOverlay';
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

// IronTrain Industrial Theme
// Slate 900 Background, Orange 500 Primary
const IronTrainTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#f97316', // Orange 500
    background: '#0f172a', // Slate 900
    card: '#1e293b', // Slate 800
    text: '#f1f5f9', // Slate 100
    border: '#334155', // Slate 700
    notification: '#f97316',
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
          <StatusBar style="light" backgroundColor="#0f172a" />
          <TimerOverlay />
          <Stack
            screenOptions={{
              headerStyle: {
                backgroundColor: '#0f172a', // Slate 900
              },
              headerTintColor: '#f97316', // Orange 500
              headerTitleStyle: {
                fontWeight: 'bold',
                color: '#f1f5f9' // Slate 100
              },
              contentStyle: {
                backgroundColor: '#0f172a'
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
