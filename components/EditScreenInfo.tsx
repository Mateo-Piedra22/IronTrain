import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';
import { ExternalLink } from './ExternalLink';
import { MonoText } from './StyledText';

export default function EditScreenInfo({ path }: { path: string }) {
  const colors = useColors();

  const ss = useMemo(() => StyleSheet.create({
    container: {
      paddingHorizontal: 20,
    },
    getStartedContainer: {
      alignItems: 'center',
      marginHorizontal: 30,
    },
    getStartedText: {
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
      color: colors.textMuted,
      fontWeight: '500',
    },
    codeHighlightContainer: {
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      marginVertical: 12,
      backgroundColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      borderWidth: 1,
      borderColor: colors.border,
    },
    codeText: {
      color: colors.text,
      fontSize: 13,
    },
    helpContainer: {
      marginTop: 20,
      alignItems: 'center',
    },
    helpLink: {
      paddingVertical: 10,
    },
    helpLinkText: {
      textAlign: 'center',
      color: colors.primary.DEFAULT,
      fontWeight: '700',
      fontSize: 13,
    },
  }), [colors]);

  return (
    <View style={ss.container}>
      <View style={ss.getStartedContainer}>
        <Text style={ss.getStartedText}>
          Abre el código de esta pantalla:
        </Text>

        <View style={ss.codeHighlightContainer}>
          <MonoText style={ss.codeText}>{path}</MonoText>
        </View>

        <Text style={ss.getStartedText}>
          Cambia cualquier texto, guarda el archivo y la app se actualizará automáticamente.
        </Text>
      </View>

      <View style={ss.helpContainer}>
        <ExternalLink
          style={ss.helpLink}
          href="https://docs.expo.io/get-started/create-a-new-app/#opening-the-app-on-your-phonetablet">
          <Text style={ss.helpLinkText}>
            Toca aquí si tu app no se actualiza automáticamente
          </Text>
        </ExternalLink>
      </View>
    </View>
  );
}
