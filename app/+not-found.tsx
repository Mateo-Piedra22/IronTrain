import { useColors } from '@/src/hooks/useColors';
import { Link, Stack } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  const colors = useColors();

  const ss = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    title: {
      fontSize: 24,
      fontWeight: '900',
      color: colors.text,
      marginBottom: 12,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 32,
      fontWeight: '500',
    },
    link: {
      backgroundColor: colors.primary.DEFAULT,
      paddingHorizontal: 24,
      paddingVertical: 14,
      borderRadius: 14,
    },
    linkText: {
      fontSize: 15,
      color: colors.onPrimary,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
  }), [colors]);

  return (
    <>
      <Stack.Screen options={{ title: 'No Encontrado', headerShown: false }} />
      <View style={ss.container}>
        <Text style={ss.title}>Pantalla no encontrada</Text>
        <Text style={ss.subtitle}>Esta ruta no existe o ha sido movida.</Text>

        <Link href="/" style={ss.link}>
          <Text style={ss.linkText}>Volver al inicio</Text>
        </Link>
      </View>
    </>
  );
}
