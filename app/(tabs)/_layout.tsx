import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import { Colors } from '@/src/theme';
import { Tabs } from 'expo-router';
import { BarChart2, Calendar, Dumbbell } from 'lucide-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.primary.DEFAULT,
          tabBarInactiveTintColor: Colors.iron[400],
          tabBarStyle: {
            backgroundColor: Colors.iron[900], // Cream
            borderTopColor: Colors.iron[700], // Consistent border
            elevation: 8, // Add shadow for Android
            shadowColor: '#000', // Shadow for iOS
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
          // Disable the static render of the header on web
          // to prevent a hydration error in React Navigation v6.
          headerShown: useClientOnlyValue(false, true),
          tabBarLabelStyle: { fontWeight: 'bold' },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Daily Log',
            headerShown: false,
            // Header components removed as they are now in index.tsx
            tabBarIcon: ({ color }) => <Calendar color={color} size={24} />,
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
