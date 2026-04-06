import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { SharedRoutineComment, SharedRoutineItem } from '@/src/services/SocialService';
import { workspaceFeedback } from '@/src/social/workspaceFeedback';
import { ThemeFx, withAlpha } from '@/src/theme';
import { RefreshCcw, X } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, SectionList, Text, TouchableOpacity, View } from 'react-native';

type WorkspaceColors = {
    text: string;
    textMuted: string;
    border: string;
    surface: string;
    surfaceLighter: string;
    primary: { DEFAULT: string };
    yellow: string;
    red: string;
};

type WorkspaceCommentsModalProps = {
    visible: boolean;
    colors: WorkspaceColors;
    workspace: SharedRoutineItem | null;
    comments: SharedRoutineComment[];
    loading: boolean;
    draft: string;
    onClose: () => void;
    onRefresh: () => void | Promise<void>;
    onDraftChange: (value: string) => void;
    onSendComment: () => void | Promise<void>;
};

type CommentSection = {
    title: string;
    data: SharedRoutineComment[];
};

function formatDateTime(value?: string | number | Date | null): string {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
    return parsed.toLocaleString();
}

function sectionTitle(comment: SharedRoutineComment): string {
    if (typeof comment.snapshotRevision === 'number') return `Revisión ${comment.snapshotRevision}`;
    if (comment.snapshotId) return 'Snapshot asociado';
    return 'General';
}

export function WorkspaceCommentsModal({
    visible,
    colors,
    workspace,
    comments,
    loading,
    draft,
    onClose,
    onRefresh,
    onDraftChange,
    onSendComment,
}: WorkspaceCommentsModalProps) {
    const [scope, setScope] = useState<'all' | 'snapshot' | 'general'>('all');

    const filtered = useMemo(() => {
        if (scope === 'snapshot') return comments.filter((item) => !!item.snapshotId);
        if (scope === 'general') return comments.filter((item) => !item.snapshotId);
        return comments;
    }, [comments, scope]);

    const sections = useMemo<CommentSection[]>(() => {
        const map = new Map<string, SharedRoutineComment[]>();

        filtered.forEach((comment) => {
            const key = sectionTitle(comment);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(comment);
        });

        return Array.from(map.entries()).map(([title, data]) => ({ title, data }));
    }, [filtered]);

    const snapshotCount = useMemo(() => comments.filter((item) => !!item.snapshotId).length, [comments]);
    const shownCount = filtered.length;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={{ flex: 1, backgroundColor: ThemeFx.backdropStrong, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 48 }}>
                <View style={{ backgroundColor: colors.surfaceLighter, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border, maxHeight: '92%', overflow: 'hidden', ...ThemeFx.shadowLg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1.5, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
                        <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={{ color: colors.text, fontWeight: '900', fontSize: 16 }}>Comentarios del espacio compartido</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                                Espacio: {workspace?.title || 'Espacio compartido'} • {comments.length} comentarios • {snapshotCount} con snapshot
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity
                                onPress={() => {
                                    workspaceFeedback.selection();
                                    void onRefresh();
                                }}
                                style={{ width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceLighter }}
                            >
                                <RefreshCcw size={14} color={colors.textMuted} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    workspaceFeedback.selection();
                                    onClose();
                                }}
                                style={{ width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceLighter }}
                            >
                                <X size={14} color={colors.textMuted} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {(['all', 'snapshot', 'general'] as const).map((value) => {
                            const active = value === scope;
                            const label = value === 'all' ? 'TODOS' : value === 'snapshot' ? 'CON SNAPSHOT' : 'GENERALES';
                            return (
                                <TouchableOpacity
                                    key={`comments-scope-${value}`}
                                    onPress={() => {
                                        workspaceFeedback.selection();
                                        setScope(value);
                                    }}
                                    style={{ borderWidth: 1, borderColor: active ? withAlpha(colors.primary.DEFAULT, '35') : colors.border, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: active ? withAlpha(colors.primary.DEFAULT, '12') : colors.surface }}
                                >
                                    <Text style={{ color: active ? colors.primary.DEFAULT : colors.textMuted, fontSize: 10, fontWeight: '900' }}>{label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Text style={{ color: colors.textMuted, fontSize: 10, paddingHorizontal: 16, paddingBottom: 8 }}>
                        Mostrando {shownCount} de {comments.length} comentarios.
                    </Text>

                    <View style={{ paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                        <View style={{ flex: 1 }}>
                            <IronInput label="Nuevo comentario del espacio" value={draft} onChangeText={onDraftChange} />
                        </View>
                        <View style={{ width: 120, paddingBottom: 2 }}>
                            <IronButton
                                label="Enviar comentario"
                                onPress={() => {
                                    workspaceFeedback.selection();
                                    void onSendComment();
                                }}
                                disabled={!draft.trim() || loading}
                            />
                        </View>
                    </View>

                    {loading ? (
                        <View style={{ paddingVertical: 36, alignItems: 'center', justifyContent: 'center' }}>
                            <ActivityIndicator color={colors.primary.DEFAULT} />
                            <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8, fontWeight: '700' }}>Cargando comentarios…</Text>
                        </View>
                    ) : (
                        <SectionList
                            sections={sections}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 24 }}
                            stickySectionHeadersEnabled
                            renderSectionHeader={({ section }) => (
                                <View style={{ paddingVertical: 6 }}>
                                    <View style={{ alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.surface }}>
                                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '900' }}>{section.title.toUpperCase()}</Text>
                                    </View>
                                </View>
                            )}
                            renderItem={({ item }) => {
                                const actor = item.actorDisplayName || item.actorUsername || item.actorId;

                                return (
                                    <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, padding: 10, marginBottom: 8 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 12, flex: 1 }}>{actor}</Text>
                                            <Text style={{ color: colors.textMuted, fontSize: 10 }}>{formatDateTime(item.createdAt)}</Text>
                                        </View>
                                        <Text style={{ color: colors.text, fontSize: 12, marginTop: 6, lineHeight: 18 }}>{item.message}</Text>
                                        {(typeof item.snapshotRevision === 'number' || item.snapshotId) && (
                                            <View style={{ marginTop: 7, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                                                {typeof item.snapshotRevision === 'number' && (
                                                    <View style={{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: withAlpha(colors.primary.DEFAULT, '12') }}>
                                                        <Text style={{ color: colors.primary.DEFAULT, fontSize: 10, fontWeight: '900' }}>REV {item.snapshotRevision}</Text>
                                                    </View>
                                                )}
                                                {!!item.snapshotId && (
                                                    <View style={{ borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.surfaceLighter, borderWidth: 1, borderColor: colors.border }}>
                                                        <Text style={{ color: colors.textMuted, fontSize: 10, fontWeight: '800' }}>SNAPSHOT</Text>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                );
                            }}
                            ListEmptyComponent={(
                                <View style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 14, backgroundColor: colors.surface }}>
                                    <Text style={{ color: colors.text, fontWeight: '900' }}>Sin comentarios</Text>
                                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>
                                        No hay comentarios para este filtro. Cambiá a “TODOS” o escribí un nuevo comentario.
                                    </Text>
                                </View>
                            )}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}
