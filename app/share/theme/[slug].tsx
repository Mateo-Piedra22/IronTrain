import { IronButton } from '@/components/IronButton';
import { ModalScreenOverlayHost } from '@/components/ui/ModalScreenOverlayHost';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useColors } from '@/src/hooks/useColors';
import { useTheme } from '@/src/hooks/useTheme';
import { ThemeColorPatch } from '@/src/theme-engine';
import * as analytics from '@/src/utils/analytics';
import { notify } from '@/src/utils/notify';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, ChevronLeft, Palette } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const getSafePatch = (value: unknown): ThemeColorPatch => {
    if (!value || typeof value !== 'object') return {};
    return value as ThemeColorPatch;
};

export default function ShareThemeScreen() {
    const colors = useColors();
    const router = useRouter();
    const { slug } = useLocalSearchParams<{ slug: string }>();
    const { saveThemeDraft, setActiveThemePackId } = useTheme();

    const [loading, setLoading] = useState(true);
    const [importing, setImporting] = useState(false);
    const [payload, setPayload] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!slug) {
            setError('Slug de theme inválido.');
            setLoading(false);
            return;
        }

        async function fetchTheme() {
            try {
                const response = await fetch(`https://irontrain.motiona.xyz/api/share/theme/${encodeURIComponent(slug)}`);

                if (!response.ok) {
                    if (response.status === 404) throw new Error('El theme no está disponible o fue removido.');
                    throw new Error('No se pudo establecer conexión con IronTrain.');
                }

                const responseData = await response.json();
                if (!responseData.success) throw new Error(responseData.error || 'Error desconocido.');
                setPayload(responseData.data);
            } catch (err: any) {
                setError(err.message || 'Error de carga.');
            } finally {
                setLoading(false);
            }
        }

        void fetchTheme();
    }, [slug]);

    const handleImport = async () => {
        if (!payload) return;

        const lightPatch = getSafePatch(payload.payload?.lightPatch);
        const darkPatch = getSafePatch(payload.payload?.darkPatch);

        setImporting(true);
        try {
            const saveResult = await saveThemeDraft({
                name: String(payload.name || payload.slug || 'Imported Theme').slice(0, 48),
                lightPatch,
                darkPatch,
            });

            if (!saveResult.ok) {
                throw new Error(saveResult.errors.join('\n'));
            }

            if (payload.supportsLight) {
                await setActiveThemePackId('light', saveResult.draft.id);
            }
            if (payload.supportsDark) {
                await setActiveThemePackId('dark', saveResult.draft.id);
            }

            analytics.capture('theme_imported', { source: 'slug_link', slug: payload.slug, version: payload.version });
            notify.success('Theme importado', 'Se guardó y aplicó en los modos compatibles.');
            router.dismissAll();
        } catch (err: any) {
            notify.error('Fallo de importación', err?.message || 'No se pudo importar el theme.');
        } finally {
            setImporting(false);
        }
    };

    const styles = useMemo(() => StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
        loadingText: { marginTop: 16, color: colors.textMuted, fontSize: 14, fontWeight: '700' },
        headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
        backBtn: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: colors.border,
        },
        title: { color: colors.text, fontWeight: '900', fontSize: 24, letterSpacing: -1 },
        subtitle: { color: colors.primary.DEFAULT, fontSize: 11, fontWeight: '800', marginTop: 2, letterSpacing: 0.8 },
        card: {
            backgroundColor: colors.surface,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            padding: 16,
            gap: 14,
        },
        name: { color: colors.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
        desc: { color: colors.textMuted, fontSize: 13, lineHeight: 20, fontWeight: '700' },
        chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
        chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
        chipText: { color: colors.textMuted, fontWeight: '800', fontSize: 11 },
        previewRow: { flexDirection: 'row', gap: 8 },
        swatch: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border },
        ctaWrap: { marginTop: 18 },
        errorIconBox: {
            width: 76,
            height: 76,
            borderRadius: 38,
            backgroundColor: `${colors.red}20`,
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 18,
        },
        errorTitle: { color: colors.text, fontSize: 22, fontWeight: '900' },
        errorText: { marginTop: 10, color: colors.textMuted, textAlign: 'center', fontSize: 14, lineHeight: 20 },
    }), [colors]);

    if (loading) {
        return (
            <SafeAreaWrapper style={styles.screen}>
                <View style={styles.centered}>
                    <ActivityIndicator color={colors.primary.DEFAULT} size="large" />
                    <Text style={styles.loadingText}>Cargando theme...</Text>
                </View>
            </SafeAreaWrapper>
        );
    }

    if (error || !payload) {
        return (
            <SafeAreaWrapper style={styles.screen}>
                <View style={styles.centered}>
                    <View style={styles.errorIconBox}>
                        <AlertCircle size={32} color={colors.red} />
                    </View>
                    <Text style={styles.errorTitle}>Theme no disponible</Text>
                    <Text style={styles.errorText}>{error || 'No se pudo cargar el theme.'}</Text>
                </View>
            </SafeAreaWrapper>
        );
    }

    const preview = (payload.payload?.preview && typeof payload.payload.preview === 'object')
        ? payload.payload.preview as Record<string, string>
        : {};

    return (
        <SafeAreaWrapper style={styles.screen}>
            <ModalScreenOverlayHost>
                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 44 }}>
                    <View style={styles.headerRow}>
                        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                            <ChevronLeft size={20} color={colors.text} />
                        </TouchableOpacity>
                        <View>
                            <Text style={styles.title}>Importar Theme</Text>
                            <Text style={styles.subtitle}>MARKETPLACE_THEME_LINK</Text>
                        </View>
                    </View>

                    <View style={styles.card}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <Palette size={20} color={colors.primary.DEFAULT} />
                            <Text style={styles.name}>{payload.name}</Text>
                        </View>

                        {!!payload.description && <Text style={styles.desc}>{payload.description}</Text>}

                        <View style={styles.previewRow}>
                            <View style={[styles.swatch, { backgroundColor: preview.hero || colors.primary.DEFAULT }]} />
                            <View style={[styles.swatch, { backgroundColor: preview.surface || colors.surface }]} />
                            <View style={[styles.swatch, { backgroundColor: preview.text || colors.text }]} />
                        </View>

                        <View style={styles.chips}>
                            <View style={styles.chip}><Text style={styles.chipText}>v{payload.version}</Text></View>
                            {payload.supportsLight && <View style={styles.chip}><Text style={styles.chipText}>Light</Text></View>}
                            {payload.supportsDark && <View style={styles.chip}><Text style={styles.chipText}>Dark</Text></View>}
                            {(payload.tags || []).slice(0, 4).map((tag: string) => (
                                <View key={`${payload.slug}:${tag}`} style={styles.chip}>
                                    <Text style={styles.chipText}>#{tag}</Text>
                                </View>
                            ))}
                        </View>

                        <View style={styles.ctaWrap}>
                            <IronButton
                                label={importing ? 'Importando...' : 'Importar y aplicar'}
                                onPress={handleImport}
                                loading={importing}
                                variant="solid"
                            />
                        </View>
                    </View>
                </ScrollView>
            </ModalScreenOverlayHost>
        </SafeAreaWrapper>
    );
}
