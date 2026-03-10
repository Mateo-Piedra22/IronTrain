import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useColors } from '@/src/hooks/useColors';
import { Tabs } from 'expo-router';
import { BarChart2, Calendar, Dumbbell, Users } from 'lucide-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function TabLayout() {
  const colors = useColors();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary.DEFAULT,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            elevation: 8,
            shadowColor: colors.black,
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
          },
          headerShown: useClientOnlyValue(false, true),
          headerStyle: {
            backgroundColor: colors.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: '900',
            color: colors.text,
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
