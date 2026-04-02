import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useColors } from '@/src/hooks/useColors';
import { useRouter } from 'expo-router';
import { X } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ThemeStudioPanel } from '../components/ThemeStudioPanel';

export default function ThemeStudioScreen() {
    const colors = useColors();
    const router = useRouter();

    const s = React.useMemo(() => StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        inner: { flex: 1, padding: 14 },
        header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
        headerTitle: { fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.8 },
        headerSubtitle: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
        closeBtn: { width: 36, height: 36, borderRadius: 16, backgroundColor: colors.surfaceLighter, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
    }), [colors]);

    return (
        <SafeAreaWrapper style={s.container}>
            <View style={s.inner}>
                <View style={s.header}>
                    <View>
                        <Text style={s.headerTitle}>Theme Studio</Text>
                        <Text style={s.headerSubtitle}>Creá, activá y gestioná temas</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        style={s.closeBtn}
                        accessibilityRole="button"
                        accessibilityLabel="Cerrar Theme Studio"
                    >
                        <X color={colors.text} size={20} />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
                <ThemeStudioPanel />
            </ScrollView>
            </View>
        </SafeAreaWrapper>
    );
}
