import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColorScheme } from '@/components/useColorScheme';
import { Colors } from '@/src/theme';
import { Tabs } from 'expo-router';
import { BarChart2, Calendar, Dumbbell, Users } from 'lucide-react-native';
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
            backgroundColor: Colors.iron[900],
            borderTopColor: Colors.iron[700],
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
          headerShown: useClientOnlyValue(false, true),
          headerStyle: {
            backgroundColor: Colors.iron[900],
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: Colors.iron[700],
          },
          headerTintColor: Colors.iron[950],
          headerTitleStyle: {
            fontWeight: '900',
            color: Colors.iron[950],
            fontSize: 18,
          },
          tabBarLabelStyle: { fontWeight: 'bold' },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Diario',
            headerShown: false,
            tabBarIcon: ({ color }) => <Calendar color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="exercises"
          options={{
            title: 'Biblioteca',
            headerShown: false,
            tabBarIcon: ({ color }) => <Dumbbell color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="analysis"
          options={{
            title: 'Análisis',
            headerShown: false,
            tabBarIcon: ({ color }) => <BarChart2 color={color} size={24} />,
          }}
        />
        <Tabs.Screen
          name="social"
          options={{
            title: 'Social',
            headerShown: false,
            tabBarIcon: ({ color }) => <Users color={color} size={24} />,
          }}
        />
        {/* Hide the routines file from tab bar — routines are now inside Biblioteca */}
        <Tabs.Screen
          name="routines"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </GestureHandlerRootView>
  );
}
