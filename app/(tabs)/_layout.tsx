import { Link, Tabs } from 'expo-router';
import { BarChart2, Calendar, Dumbbell, Info } from 'lucide-react-native';
import React from 'react';
import { Pressable } from 'react-native';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          // Disable the static render of the header on web
          // to prevent a hydration error in React Navigation v6.
          headerShown: useClientOnlyValue(false, true),
          tabBarLabelStyle: { fontWeight: 'bold' },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Daily Log',
            tabBarIcon: ({ color }) => <Calendar color={color} size={24} />,
            headerRight: () => (
              <Link href="/modal" asChild>
                <Pressable>
                  {({ pressed }) => (
                    <Info
                      size={25}
                      color={Colors[colorScheme ?? 'light'].text}
                      style={{ marginRight: 15, opacity: pressed ? 0.5 : 1 }}
                    />
                  )}
                </Pressable>
              </Link>
            ),
          }}
        />
        <Tabs.Screen
          name="exercises"
          options={{
            title: 'Library',
            tabBarIcon: ({ color }) => <Dumbbell color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="analysis"
          options={{
            title: 'Analysis',
            tabBarIcon: ({ color }) => <BarChart2 color={color} size={24} />,
          }}
        />
      </Tabs>
    </GestureHandlerRootView>
  );
}
