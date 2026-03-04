import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { Colors } from '@/src/theme';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, View } from 'react-native';

export default function ModalScreen() {
  return (
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

      <StatusBar style={Platform.OS === 'ios' ? 'dark' : 'auto'} />
    </SafeAreaWrapper>
  );
}

const ss = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.iron[900], justifyContent: 'center', alignItems: 'center', padding: 32 },
  brand: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 36, fontWeight: '900', color: Colors.iron[950], marginBottom: 6, letterSpacing: -2, textTransform: 'uppercase' },
  tagline: { color: Colors.iron[400], fontWeight: '800', textTransform: 'uppercase', letterSpacing: 4, fontSize: 10 },
  quoteCard: { backgroundColor: Colors.iron[800], padding: 24, borderRadius: 20, borderWidth: 1, borderColor: Colors.iron[700], width: '100%', marginBottom: 32 },
  quoteText: { color: Colors.iron[950], textAlign: 'center', marginBottom: 12, fontWeight: '600', lineHeight: 22, fontSize: 14 },
  quoteAuthor: { color: Colors.iron[400], textAlign: 'center', fontSize: 11, fontStyle: 'italic', fontWeight: '600' },
});
