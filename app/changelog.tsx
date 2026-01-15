import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { ChangelogRelease, ChangelogService } from '@/src/services/ChangelogService';
import { Colors } from '@/src/theme';
import { Stack, useFocusEffect } from 'expo-router';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

function isSameVersion(a: string, b: string) {
    return String(a).trim() === String(b).trim();
}

export default function ChangelogModalScreen() {
    const appVersion = ChangelogService.getAppVersion();
    const [releases, setReleases] = useState<ChangelogRelease[]>(() => ChangelogService.getReleases());
    const [unreleased, setUnreleased] = useState<ChangelogRelease[]>(() => {
        const all = ChangelogService.getReleases({ includeUnreleased: true });
        return all.filter((r) => r.unreleased === true || r.date === null || String(r.date ?? '').trim().toLowerCase() === 'unreleased');
    });

    useFocusEffect(
        useCallback(() => {
            ChangelogService.reload();
            setReleases(ChangelogService.getReleases());
            const all = ChangelogService.getReleases({ includeUnreleased: true });
            setUnreleased(all.filter((r) => r.unreleased === true || r.date === null || String(r.date ?? '').trim().toLowerCase() === 'unreleased'));
        }, [])
    );

    const initialExpanded = useMemo(() => {
        const match = releases.find((r) => isSameVersion(r.version, appVersion));
        return match?.version ?? releases[0]?.version ?? null;
    }, [releases, appVersion]);

    const [expandedVersion, setExpandedVersion] = useState<string | null>(initialExpanded);
    const [showUnreleased, setShowUnreleased] = useState(false);

    useEffect(() => {
        setExpandedVersion((prev) => {
            if (!prev) return initialExpanded;
            const stillExists = releases.some((r) => r.version === prev) || unreleased.some((r) => r.version === prev);
            return stillExists ? prev : initialExpanded;
        });
    }, [initialExpanded, releases, unreleased]);

    const toggle = (v: string) => {
        setExpandedVersion((prev) => prev === v ? null : v);
    };

    const renderRelease = (r: ChangelogRelease) => {
        const expanded = expandedVersion === r.version;
        const isCurrent = isSameVersion(r.version, appVersion);
        return (
            <View key={r.version} className="bg-surface rounded-2xl border border-iron-700 mb-3 overflow-hidden">
                <Pressable
                    onPress={() => toggle(r.version)}
                    className="px-4 py-3 flex-row items-center justify-between active:bg-iron-200"
                    accessibilityRole="button"
                    accessibilityLabel={`Ver cambios ${r.version}`}
                >
                    <View className="flex-1 pr-3">
                        <View className="flex-row items-center justify-between">
                            <Text className="text-iron-950 font-black text-lg">v{r.version}</Text>
                            {isCurrent && (
                                <View className="px-2 py-1 rounded-full bg-primary">
                                    <Text className="text-white text-[10px] font-black">INSTALADA</Text>
                                </View>
                            )}
                        </View>
                        <Text className="text-iron-500 text-xs font-bold mt-1">{r.date ?? '—'}</Text>
                    </View>
                    {expanded ? <ChevronUp size={18} color={Colors.iron[500]} /> : <ChevronDown size={18} color={Colors.iron[500]} />}
                </Pressable>

                {expanded && (
                    <View className="px-4 pb-4">
                        <View className="h-[1px] bg-iron-700 mb-3" />
                        <View className="gap-2">
                            {r.items.map((it, idx) => (
                                <View key={`${r.version}-${idx}`} className="flex-row">
                                    <Text className="text-primary font-black mr-2">•</Text>
                                    <Text className="text-iron-950 flex-1">{it}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </View>
        );
    };

    return (
        <SafeAreaWrapper className="flex-1 bg-iron-900" edges={['left', 'right', 'bottom']}>
            <Stack.Screen options={{ title: 'Novedades' }} />
            <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 24 }}>
                <View className="mb-4">
                    <Text className="text-iron-950 font-black text-2xl">Novedades</Text>
                    <Text className="text-iron-500 text-xs font-bold mt-1">Versión instalada: v{appVersion}</Text>
                </View>

                {releases.length > 0 ? (
                    <View>
                        {releases.map(renderRelease)}

                        {unreleased.length > 0 && (
                            <View className="mt-4">
                                <Pressable
                                    onPress={() => setShowUnreleased((v) => !v)}
                                    className="px-4 py-3 flex-row items-center justify-between bg-surface rounded-2xl border border-iron-700 active:bg-iron-200"
                                    accessibilityRole="button"
                                    accessibilityLabel="Mostrar u ocultar cambios no publicados"
                                >
                                    <Text className="text-iron-950 font-black">Próximamente</Text>
                                    {showUnreleased ? <ChevronUp size={18} color={Colors.iron[500]} /> : <ChevronDown size={18} color={Colors.iron[500]} />}
                                </Pressable>

                                {showUnreleased && (
                                    <View className="mt-3">
                                        {unreleased.map(renderRelease)}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                ) : (
                    <View className="bg-surface p-4 rounded-2xl border border-iron-700">
                        <Text className="text-iron-950 font-bold">No hay changelog disponible</Text>
                        <Text className="text-iron-500 text-xs mt-1">Verifica que `src/changelog.generated.json` exista y esté actualizado.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaWrapper>
    );
}
