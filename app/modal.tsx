import { ModalScreenOverlayHost } from '@/components/ui/ModalScreenOverlayHost';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useColors } from '@/src/hooks/useColors';
import { ThemeFx } from '@/src/theme';
import { StatusBar } from 'expo-status-bar';
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

export default function ModalScreen() {
  const colors = useColors();

  const ss = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32
    },
    brand: {
      alignItems: 'center',
      marginBottom: 32
    },
    title: {
      fontSize: 36,
      fontWeight: '900',
      color: colors.text,
      marginBottom: 6,
      letterSpacing: -2,
      textTransform: 'uppercase'
    },
    tagline: {
      color: colors.primary.DEFAULT,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 4,
      fontSize: 10
    },
    quoteCard: {
      backgroundColor: colors.surface,
      padding: 24,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
      width: '100%',
      marginBottom: 32,
      ...ThemeFx.shadowSm
    },
    quoteText: {
      color: colors.text,
      textAlign: 'center',
      marginBottom: 12,
      fontWeight: '600',
      lineHeight: 22,
      fontSize: 14
    },
    quoteAuthor: {
      color: colors.textMuted,
      textAlign: 'center',
      fontSize: 11,
      fontStyle: 'italic',
      fontWeight: '600'
    },
  }), [colors]);

  return (
    <ModalScreenOverlayHost>
      <SafeAreaWrapper style={ss.container}>
        <View style={ss.brand}>
          <Text style={ss.title}>IronTrain</Text>
          <Text style={ss.tagline}>Strength Evolved</Text>
        </View>

        <View style={ss.quoteCard}>
          <Text style={ss.quoteText}>
            "IronTrain is designed for purists. No nonsense, just heavy Iron and progress."
          </Text>
          <Text style={ss.quoteAuthor}>- The IronTeam</Text>
        </View>

        <StatusBar style={Platform.OS === 'ios' ? (colors.isDark ? 'light' : 'dark') : 'auto'} />
      </SafeAreaWrapper>
    </ModalScreenOverlayHost>
  );
}
