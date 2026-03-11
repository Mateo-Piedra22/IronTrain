import { ExerciseList } from '@/components/ExerciseList';
import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { RoutineDayWithExercises, routineService } from '@/src/services/RoutineService';
import { SocialService } from '@/src/services/SocialService';
import { useAuthStore } from '@/src/store/authStore';
import { confirm } from '@/src/store/confirmStore';
import { ThemeFx, withAlpha } from '@/src/theme';
import { Routine } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { Calendar, ChevronRight, Dumbbell, Edit3, GripVertical, Plus, Send, Share2, Trash2, User, Users, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../src/hooks/useColors';
import { BadgePill } from './ui/BadgePill';

interface RoutineDetailModalProps {
    visible: boolean;
    routineId: string | null;
    onClose: () => void;
    onDeleted: () => void;
}

type ViewMode = 'routine' | 'day';

export function RoutineDetailModal({ visible, routineId, onClose, onDeleted }: RoutineDetailModalProps) {
    const colors = useColors();

    const ss = useMemo(() => StyleSheet.create({
        overlay: {
            flex: 1,
            backgroundColor: ThemeFx.backdropStrong,
            justifyContent: 'center',
            paddingHorizontal: 16,
            paddingVertical: 48,
        },
        sheet: {
            backgroundColor: colors.surfaceLighter,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 20,
            flex: 1,
            maxHeight: '95%',
            width: '100%',
            overflow: 'hidden',
            ...ThemeFx.shadowLg,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 18,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
        },
        headerTextContainer: { flex: 1 },
        headerTitle: { color: colors.text, fontWeight: '900', fontSize: 17, letterSpacing: -0.4 },
        headerSub: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 2 },
        closeBtn: {
            width: 32, height: 32, borderRadius: 10,
            backgroundColor: colors.surfaceLighter, justifyContent: 'center', alignItems: 'center',
            borderWidth: 1, borderColor: colors.border,
        },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

        contentArea: {
            padding: 16,
            backgroundColor: colors.surfaceLighter,
            minHeight: '100%',
        },
        scrollContent: { paddingBottom: 40 },
        sectionLabel: {
            color: colors.textMuted,
            fontSize: 10,
            marginBottom: 12,
            marginTop: 20,
            textTransform: 'uppercase',
            fontWeight: '800',
            letterSpacing: 1.2,
            marginLeft: 4,
        },
        infoCard: {
            backgroundColor: colors.surface,
            padding: 16,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderLeftWidth: 4,
            borderLeftColor: colors.primary.DEFAULT,
        },
        infoCardText: { fontSize: 14, color: colors.textMuted, lineHeight: 20, fontWeight: '600' },
        warningCard: {
            backgroundColor: withAlpha(colors.yellow, '15'),
            borderColor: withAlpha(colors.yellow, '40'),
            borderLeftColor: colors.yellow,
        },
        warningLabel: { color: colors.yellow, fontWeight: '900', fontSize: 11, marginBottom: 4, textTransform: 'uppercase' },

        btnRow: {
            flexDirection: 'row',
            gap: 10,
            marginTop: 16,
        },
        btnCol: { flex: 1 },
        smallBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            height: 44,
            borderRadius: 14,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        smallBtnPrimary: {
            backgroundColor: colors.primary.DEFAULT,
            borderColor: colors.primary.DEFAULT,
        },
        smallBtnDanger: {
            borderColor: withAlpha(colors.red, '30'),
            backgroundColor: withAlpha(colors.red, '05'),
        },
        smallBtnText: { fontSize: 12, fontWeight: '800', color: colors.primary.DEFAULT, textTransform: 'uppercase' },
        smallBtnTextWhite: { color: colors.onPrimary },
        smallBtnTextDanger: { color: colors.red },

        dayBlockOuter: {
            marginBottom: 14,
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
            overflow: 'hidden',
        },
        dayBlockActive: { borderColor: colors.primary.DEFAULT, ...ThemeFx.shadowMd },
        dayBlockHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 14,
            paddingHorizontal: 16,
            backgroundColor: colors.surface,
            borderBottomWidth: 1.5,
            borderBottomColor: colors.border,
        },
        dayHeaderContent: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
        dayIconBox: {
            width: 36, height: 36, borderRadius: 11,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '12'),
            borderWidth: 1, borderColor: withAlpha(colors.primary.DEFAULT, '25'),
            justifyContent: 'center', alignItems: 'center',
        },
        dayTitle: { color: colors.text, fontWeight: '900', fontSize: 16, letterSpacing: -0.3, flex: 1 },
        arrowCircle: {
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: colors.surfaceLighter, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: colors.border,
        },
        dayBlockInner: {
            padding: 16,
            backgroundColor: colors.surface,
        },
        dayMetaEmpty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', paddingVertical: 8 },
        dayInnerExRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        dayInnerExNum: { color: colors.primary.DEFAULT, fontWeight: '900', fontSize: 13, width: 22 },
        dayInnerExText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800' },
        dayBadgeContainer: { flexDirection: 'row', gap: 4, marginTop: 4 },
        dayMoreBadge: { backgroundColor: colors.border, paddingHorizontal: 6, borderRadius: 6, justifyContent: 'center', height: 16 },
        dayMoreBadgeText: { fontSize: 9, fontWeight: '900', color: colors.textMuted },

        addInnerBtn: {
            flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 14, marginTop: 6, justifyContent: 'center'
        },
        addInnerBtnText: { color: colors.primary.DEFAULT, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },

        exCard: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 14,
            paddingHorizontal: 16,
            marginBottom: 12,
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
            gap: 12,
        },
        exCardActive: { borderColor: colors.primary.DEFAULT, ...ThemeFx.shadowMd },
        exDragHandle: { paddingVertical: 6, paddingHorizontal: 4 },
        exIconBox: {
            width: 38, height: 38, borderRadius: 12,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '12'),
            borderWidth: 1, borderColor: withAlpha(colors.primary.DEFAULT, '25'),
            alignItems: 'center', justifyContent: 'center',
        },
        exContent: { flex: 1, overflow: 'hidden' },
        exCardTitle: { color: colors.text, fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
        exMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' },
        exCardMeta: { color: colors.textMuted, fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
        exBadgeRow: { flexDirection: 'row', gap: 4, alignItems: 'center' },
        exDeleteBtn: { padding: 10, backgroundColor: withAlpha(colors.red, '10'), borderRadius: 12, borderWidth: 1, borderColor: withAlpha(colors.red, '20') },

        addRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            paddingVertical: 18,
            marginTop: 12,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: withAlpha(colors.primary.DEFAULT, '25'),
            borderStyle: 'dashed',
            backgroundColor: withAlpha(colors.primary.DEFAULT, '05'),
        },
        addRowText: { color: colors.primary.DEFAULT, fontWeight: '900', fontSize: 15, textTransform: 'uppercase', letterSpacing: 0.5 },

        emptyBlock: {
            alignItems: 'center',
            paddingVertical: 48,
            backgroundColor: colors.surface,
            borderRadius: 20,
            borderWidth: 2,
            borderColor: colors.border,
            borderStyle: 'dashed',
            gap: 12,
            marginTop: 8,
        },
        emptyTitle: { fontSize: 16, fontWeight: '900', color: colors.text, letterSpacing: -0.2 },
        emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 32, lineHeight: 20 },

        innerOverlay: {
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 16,
        },
        formBox: {
            backgroundColor: colors.surface,
            width: '100%',
            maxWidth: 380,
            borderRadius: 24,
            padding: 24,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowLg,
        },
        formTitle: { fontSize: 22, fontWeight: '900', color: colors.text, marginBottom: 24, letterSpacing: -0.5 },
        formControlRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 4 },
        formLabelCol: { flex: 1, paddingRight: 16 },
        formLabelMain: { color: colors.text, fontWeight: '800', fontSize: 15 },
        formLabelSub: { color: colors.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
        formActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
        formActionBtn: { flex: 1 },

        friendPickerContent: { flex: 1, padding: 16, backgroundColor: colors.surfaceLighter },
        friendItem: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface,
            padding: 16,
            borderRadius: 20,
            marginBottom: 12,
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
        },
        friendInfo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
        friendAvatar: {
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: withAlpha(colors.primary.DEFAULT, '12'),
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 1.5, borderColor: withAlpha(colors.primary.DEFAULT, '25')
        },
        friendName: { color: colors.text, fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
        friendSendBtn: {
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: colors.surfaceLighter, alignItems: 'center', justifyContent: 'center',
            borderWidth: 1, borderColor: colors.border
        },

        flex1: { flex: 1 },
        rowGap12: { flexDirection: 'row', gap: 12 },
        loadingContainer: { paddingVertical: 40, alignItems: 'center' },
        utilWidth32: { width: 32 },
        utilGripPad: { paddingRight: 8, paddingVertical: 4 },
        utilBadgePillGap: { backgroundColor: colors.border, paddingHorizontal: 4, borderRadius: 4, justifyContent: 'center' },
        utilBadgePillText: { fontSize: 8, fontWeight: '800', color: colors.textMuted },
    }), [colors]);

    const [routine, setRoutine] = useState<Routine | null>(null);
    const [days, setDays] = useState<RoutineDayWithExercises[]>([]);
    const [loading, setLoading] = useState(true);

    const [viewMode, setViewMode] = useState<ViewMode>('routine');
    const [selectedDay, setSelectedDay] = useState<RoutineDayWithExercises | null>(null);
    const [dayLoading, setDayLoading] = useState(false);

    const [editRoutineVisible, setEditRoutineVisible] = useState(false);
    const [editRoutineName, setEditRoutineName] = useState('');
    const [editRoutineDesc, setEditRoutineDesc] = useState('');
    const [editRoutinePublic, setEditRoutinePublic] = useState(false);

    const [editDayVisible, setEditDayVisible] = useState(false);
    const [editDayName, setEditDayName] = useState('');

    const [addExerciseVisible, setAddExerciseVisible] = useState(false);

    // Social Flow
    const authState = useAuthStore();
    const [friendPickerVisible, setFriendPickerVisible] = useState(false);
    const [friends, setFriends] = useState<any[]>([]);
    const [sendingRoutine, setSendingRoutine] = useState(false);

    const loadRoutine = useCallback(async () => {
        if (!routineId) return;
        setLoading(true);
        try {
            const data = await routineService.getRoutineDetails(routineId);
            if (!data) { notify.error('No encontrada', 'La rutina ya no existe.'); onClose(); return; }
            setRoutine(data);
            setDays(data.days);
        } catch (e: any) {
            notify.error('Error', e?.message || 'Error cargando rutina.');
        } finally { setLoading(false); }
    }, [routineId]);

    const loadDayDetail = useCallback(async (dayId: string) => {
        setDayLoading(true);
        try {
            const data = await routineService.getRoutineDayDetails(dayId);
            if (data) setSelectedDay(data);
        } catch (e: any) {
            notify.error('Error', e?.message || 'Error cargando día.');
        } finally { setDayLoading(false); }
    }, []);

    useEffect(() => {
        if (visible && routineId) {
            setViewMode('routine');
            setSelectedDay(null);
            loadRoutine();
        }
    }, [visible, routineId]);

    const handleAddDay = async () => {
        if (!routineId) return;
        try {
            await routineService.addRoutineDay(routineId, `Día ${days.length + 1}`, days.length);
            notify.success('Añadido', `Día ${days.length + 1} creado.`);
            loadRoutine();
        } catch (e: any) { notify.error('Error', e?.message || 'No se pudo añadir.'); }
    };

    const handleSaveRoutineEdit = async () => {
        if (!editRoutineName.trim() || !routineId) return;
        try {
            await routineService.updateRoutine(routineId, editRoutineName.trim(), editRoutineDesc.trim() || undefined, editRoutinePublic ? 1 : 0);
            notify.success('Actualizado', 'Rutina actualizada.');
            setEditRoutineVisible(false);
            loadRoutine();
        } catch (e: any) { notify.error('Error', e?.message || 'Error.'); }
    };

    const handleDeleteRoutine = () => {
        confirm.destructive('Eliminar Rutina', 'Acción irreversible. Se eliminará la rutina y todos sus días.',
            async () => {
                try { if (routineId) await routineService.deleteRoutine(routineId); notify.success('Eliminada', 'Rutina eliminada.'); onDeleted(); onClose(); }
                catch (e: any) { notify.error('Error', e?.message || 'Error.'); }
            }, 'Sí, Eliminar');
    };

    const handleReorderDays = async (data: RoutineDayWithExercises[]) => {
        const snapshot = days; setDays(data);
        try { await routineService.reorderRoutineDays(data.map((d, i) => ({ id: d.id, order_index: i }))); }
        catch { setDays(snapshot); notify.error('Error', 'No se pudo reordenar.'); }
    };

    const openDay = (day: RoutineDayWithExercises) => { setSelectedDay(day); setViewMode('day'); loadDayDetail(day.id); };

    const handleSaveDayEdit = async () => {
        if (!editDayName.trim() || !selectedDay) return;
        try {
            await routineService.updateRoutineDay(selectedDay.id, editDayName.trim(), selectedDay.order_index);
            notify.success('Actualizado', 'Nombre cambiado.');
            setEditDayVisible(false);
            loadDayDetail(selectedDay.id);
        } catch (e: any) { notify.error('Error', e?.message || 'Error.'); }
    };

    const handleDeleteDay = () => {
        if (!selectedDay) return;
        confirm.destructive('Eliminar Día', `¿Eliminar "${selectedDay.name}"?`,
            async () => {
                try { await routineService.deleteRoutineDay(selectedDay.id); notify.success('Eliminado', 'Día eliminado.'); setViewMode('routine'); setSelectedDay(null); loadRoutine(); }
                catch (e: any) { notify.error('Error', e?.message || 'Error.'); }
            }, 'Sí, Eliminar');
    };

    const handleAddExercise = async (exerciseId: string) => {
        if (!selectedDay) return;
        try {
            await routineService.addRoutineExercise(selectedDay.id, exerciseId, selectedDay.exercises.length);
            notify.success('Agregado', 'Ejercicio añadido.');
            setAddExerciseVisible(false);
            loadDayDetail(selectedDay.id);
        } catch (e: any) { notify.error('Error', e?.message || 'Error.'); }
    };

    const handleDeleteExercise = (exId: string, exName: string) => {
        confirm.destructive('Quitar ejercicio', `¿Quitar "${exName}"?`,
            async () => {
                try { await routineService.deleteRoutineExercise(exId); if (selectedDay) loadDayDetail(selectedDay.id); }
                catch (e: any) { notify.error('Error', e?.message || 'Error.'); }
            }, 'Quitar');
    };

    const handleReorderExercises = async (data: RoutineDayWithExercises['exercises']) => {
        if (!selectedDay) return;
        const snapshot = selectedDay.exercises;
        setSelectedDay({ ...selectedDay, exercises: data });
        try { await routineService.reorderRoutineExercises(data.map((e, i) => ({ id: e.id, order_index: i }))); }
        catch { setSelectedDay({ ...selectedDay, exercises: snapshot }); notify.error('Error', 'No se pudo reordenar.'); }
    };

    const handleClose = () => {
        if (viewMode === 'day') { setViewMode('routine'); setSelectedDay(null); loadRoutine(); }
        else { onClose(); }
    };

    const handleShareRoutine = async () => {
        if (!routineId) return;
        try {
            const url = `https://irontrain.motiona.xyz/share/routine/${routineId}`;
            await Share.share({
                message: `¡Mirá mi rutina en IronTrain y descargala gratis!\n\n${url}`,
                url, // For iOS
                title: routine?.name
            });
        } catch (e: any) { notify.error('Error al compartir', e.message); }
    };

    const handleOpenFriendPicker = async () => {
        if (!authState.token) {
            notify.error('Oops', 'Inicia sesión para enviar a amigos.');
            return;
        }
        setFriendPickerVisible(true);
        try {
            const fr = await SocialService.getFriends();
            setFriends(fr.filter((f: any) => f.status === 'accepted'));
        } catch (e: any) {
            notify.error('Error', 'No se pudieron cargar los amigos.');
        }
    };

    const handleSendToFriend = async (friendId: string) => {
        if (!routineId) return;
        setSendingRoutine(true);
        try {
            const payload = await routineService.exportRoutine(routineId);
            await SocialService.sendToInbox(friendId, payload, 'routine');
            notify.success('Enviado', 'Rutina enviada a tu amigo.');
            setFriendPickerVisible(false);
        } catch (e: any) {
            notify.error('Error', e.message || 'No se pudo enviar la rutina.');
        } finally {
            setSendingRoutine(false);
        }
    };

    const renderDayItem = ({ item, drag, isActive }: RenderItemParams<RoutineDayWithExercises>) => (
        <ScaleDecorator>
            <View style={[ss.dayBlockOuter, isActive && ss.dayBlockActive]}>
                <TouchableOpacity
                    style={ss.dayBlockHeader}
                    onPress={() => openDay(item)}
                    onLongPress={drag}
                    delayLongPress={200}
                    activeOpacity={0.7}
                >
                    <View style={ss.utilGripPad}>
                        <GripVertical color={colors.textMuted} size={16} />
                    </View>
                    <View style={ss.dayHeaderContent}>
                        <View style={ss.dayIconBox}>
                            <Calendar color={colors.primary.DEFAULT} size={18} />
                        </View>
                        <View style={ss.flex1}>
                            <Text style={ss.dayTitle} numberOfLines={1}>{item.name}</Text>
                        </View>
                    </View>
                    <View style={ss.arrowCircle}>
                        <ChevronRight size={16} color={colors.textMuted} />
                    </View>
                </TouchableOpacity>

                {/* Show Preview of Exercises Inside the Day Block */}
                <View style={ss.dayBlockInner}>
                    {item.exercises.length === 0 ? (
                        <Text style={ss.dayMetaEmpty}>Sin ejercicios añadidos.</Text>
                    ) : (
                        item.exercises.map((ex, idx) => (
                            <View key={ex.id} style={ss.dayInnerExRow}>
                                <Text style={ss.dayInnerExNum}>{idx + 1}.</Text>
                                <View style={ss.exContent}>
                                    <Text style={ss.dayInnerExText} numberOfLines={1}>{ex.exercise_name}</Text>
                                    {ex.badges && ex.badges.length > 0 && (
                                        <View style={ss.dayBadgeContainer}>
                                            {ex.badges.slice(0, 2).map((b, bIdx) => (
                                                <BadgePill key={`${ex.id}-p-${bIdx}`} name={b.name} color={b.color} icon={b.icon} size="xs" />
                                            ))}
                                            {ex.badges.length > 2 && (
                                                <View style={ss.dayMoreBadge}>
                                                    <Text style={ss.dayMoreBadgeText}>+{ex.badges.length - 2}</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </View>
                            </View>
                        ))
                    )}
                    <TouchableOpacity style={ss.addInnerBtn} onPress={() => openDay(item)}>
                        <Plus size={14} color={colors.primary.DEFAULT} />
                        <Text style={ss.addInnerBtnText}>Gestionar Ejercicios</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScaleDecorator>
    );

    const renderExerciseItem = ({ item, drag, isActive }: RenderItemParams<RoutineDayWithExercises['exercises'][0]>) => (
        <ScaleDecorator>
            <View style={[ss.exCard, isActive && ss.exCardActive]}>
                <Pressable onLongPress={drag} delayLongPress={200} style={ss.exDragHandle}>
                    <GripVertical color={colors.textMuted} size={16} />
                </Pressable>
                <View style={ss.exIconBox}>
                    <Dumbbell color={colors.primary.DEFAULT} size={16} />
                </View>
                <View style={ss.exContent}>
                    <Text style={ss.exCardTitle} numberOfLines={1}>{item.exercise_name}</Text>
                    <View style={ss.exMetaRow}>
                        {item.category_name ? <Text style={ss.exCardMeta}>{item.category_name.toUpperCase()}</Text> : null}

                        {item.badges && item.badges.length > 0 && (
                            <View style={ss.exBadgeRow}>
                                {item.badges.slice(0, 3).map((b, bIdx) => (
                                    <BadgePill key={`${item.id}-b-${bIdx}`} name={b.name} color={b.color} icon={b.icon} size="xs" />
                                ))}
                                {item.badges.length > 3 && (
                                    <View style={ss.dayMoreBadge}>
                                        <Text style={ss.dayMoreBadgeText}>+{item.badges.length - 3}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteExercise(item.id, item.exercise_name)}
                    style={ss.exDeleteBtn}>
                    <Trash2 size={14} color={colors.red} />
                </TouchableOpacity>
            </View>
        </ScaleDecorator>
    );

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
            <View style={ss.overlay}>
                <View style={ss.sheet}>
                    {/* Header */}
                    <View style={ss.header}>
                        <View style={ss.headerTextContainer}>
                            <Text style={ss.headerTitle}>
                                {viewMode === 'day' && selectedDay ? selectedDay.name : routine?.name || 'Rutina'}
                            </Text>
                            <Text style={ss.headerSub}>
                                {viewMode === 'day'
                                    ? `${selectedDay?.exercises?.length || 0} ejercicios`
                                    : `${days.length} ${days.length === 1 ? 'día' : 'días'} de entrenamiento`}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={ss.closeBtn}>
                            <X size={18} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={ss.centered}><ActivityIndicator size="large" color={colors.primary.DEFAULT} /></View>
                    ) : viewMode === 'routine' ? (
                        <ScrollView contentContainerStyle={ss.scrollContent}>
                            <View style={ss.contentArea}>
                                {routine?.is_moderated === 1 ? (
                                    <View style={[ss.infoCard, ss.warningCard]}>
                                        <Text style={ss.warningLabel}>⚠️ ESTADO: OCULTA</Text>
                                        <Text style={ss.infoCardText}>
                                            {routine.moderation_message || 'Esta rutina ha sido ocultada del directorio público por un administrador.'}
                                        </Text>
                                    </View>
                                ) : routine?.description ? (
                                    <View style={ss.infoCard}>
                                        <Text style={ss.infoCardText}>{routine.description}</Text>
                                    </View>
                                ) : null}

                                {/* Action buttons row */}
                                <View style={ss.btnRow}>
                                    <View style={ss.btnCol}>
                                        <TouchableOpacity style={[ss.smallBtn, ss.smallBtnPrimary]} onPress={handleShareRoutine}>
                                            <Share2 size={12} color={colors.onPrimary} />
                                            <Text style={[ss.smallBtnText, ss.smallBtnTextWhite]}>Link</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={ss.btnCol}>
                                        <TouchableOpacity style={ss.smallBtn} onPress={handleOpenFriendPicker}>
                                            <Send size={12} color={colors.primary.DEFAULT} />
                                            <Text style={ss.smallBtnText}>Amigo</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={ss.btnCol}>
                                        <TouchableOpacity style={ss.smallBtn} onPress={() => {
                                            setEditRoutineName(routine?.name || ''); setEditRoutineDesc(routine?.description || ''); setEditRoutinePublic(routine?.is_public === 1); setEditRoutineVisible(true);
                                        }}>
                                            <Edit3 size={12} color={colors.primary.DEFAULT} />
                                            <Text style={ss.smallBtnText}>Edit</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={ss.btnCol}>
                                        <TouchableOpacity style={[ss.smallBtn, ss.smallBtnDanger]} onPress={handleDeleteRoutine}>
                                            <Trash2 size={12} color={colors.red} />
                                            <Text style={[ss.smallBtnText, ss.smallBtnTextDanger]}>Del</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Section label */}
                                <Text style={ss.sectionLabel}>Días de entrenamiento</Text>

                                {/* Days */}
                                {days.length === 0 ? (
                                    <View style={ss.emptyBlock}>
                                        <Calendar size={28} color={colors.textMuted} />
                                        <Text style={ss.emptyTitle}>Sin días definidos</Text>
                                        <Text style={ss.emptyText}>Tocá el botón para agregar estructura.</Text>
                                    </View>
                                ) : (
                                    <DraggableFlatList
                                        data={days}
                                        keyExtractor={(item) => item.id}
                                        onDragEnd={({ data }) => handleReorderDays(data)}
                                        renderItem={renderDayItem}
                                        activationDistance={20}
                                        scrollEnabled={false}
                                    />
                                )}

                                {/* Add day button */}
                                <TouchableOpacity style={ss.addRow} onPress={handleAddDay}>
                                    <Plus size={18} color={colors.primary.DEFAULT} />
                                    <Text style={ss.addRowText}>Agregar día</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    ) : (
                        <ScrollView contentContainerStyle={ss.scrollContent}>
                            <View style={ss.contentArea}>
                                {/* Day action buttons */}
                                <View style={ss.btnRow}>
                                    <View style={ss.btnCol}>
                                        <TouchableOpacity style={ss.smallBtn} onPress={() => { setEditDayName(selectedDay?.name || ''); setEditDayVisible(true); }}>
                                            <Edit3 size={14} color={colors.primary.DEFAULT} />
                                            <Text style={ss.smallBtnText}>Renombrar</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={ss.btnCol}>
                                        <TouchableOpacity style={[ss.smallBtn, ss.smallBtnDanger]} onPress={handleDeleteDay}>
                                            <Trash2 size={14} color={colors.red} />
                                            <Text style={[ss.smallBtnText, ss.smallBtnTextDanger]}>Eliminar día</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <Text style={ss.sectionLabel}>Ejercicios del día</Text>

                                {dayLoading ? (
                                    <View style={ss.loadingContainer}><ActivityIndicator color={colors.primary.DEFAULT} /></View>
                                ) : (selectedDay?.exercises || []).length === 0 ? (
                                    <View style={ss.emptyBlock}>
                                        <Dumbbell size={28} color={colors.textMuted} />
                                        <Text style={ss.emptyTitle}>Sin ejercicios</Text>
                                        <Text style={ss.emptyText}>Agregá ejercicios a este día.</Text>
                                    </View>
                                ) : (
                                    <DraggableFlatList
                                        data={selectedDay?.exercises || []}
                                        keyExtractor={(item) => item.id}
                                        onDragEnd={({ data }) => handleReorderExercises(data)}
                                        renderItem={renderExerciseItem}
                                        activationDistance={20}
                                        scrollEnabled={false}
                                    />
                                )}

                                <TouchableOpacity style={ss.addRow} onPress={() => setAddExerciseVisible(true)}>
                                    <Plus size={18} color={colors.primary.DEFAULT} />
                                    <Text style={ss.addRowText}>Agregar ejercicio</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    )}
                </View>
            </View>

            {/* Edit Routine */}
            {editRoutineVisible && (
                <Modal transparent visible animationType="fade" onRequestClose={() => setEditRoutineVisible(false)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: ThemeFx.backdropStrong }}>
                            <ScrollView
                                contentContainerStyle={ss.innerOverlay}
                                keyboardShouldPersistTaps="handled"
                                bounces={false}
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={ss.formBox}>
                                    <Text style={ss.formTitle}>Editar rutina</Text>
                                    <IronInput label="Nombre" value={editRoutineName} onChangeText={setEditRoutineName} autoFocus />
                                    <IronInput label="Descripción" value={editRoutineDesc} onChangeText={setEditRoutineDesc} multiline numberOfLines={2} />

                                    <View style={ss.formControlRow}>
                                        <View style={ss.formLabelCol}>
                                            <Text style={ss.formLabelMain}>Hacer Pública</Text>
                                            <Text style={ss.formLabelSub}>Aparecerá en el Directorio Global para que otros la descarguen.</Text>
                                        </View>
                                        <Switch value={editRoutinePublic} onValueChange={setEditRoutinePublic} trackColor={{ true: colors.primary.DEFAULT }} />
                                    </View>

                                    <View style={ss.rowGap12}>
                                        <View style={ss.flex1}><IronButton label="Cancelar" variant="ghost" onPress={() => setEditRoutineVisible(false)} /></View>
                                        <View style={ss.flex1}><IronButton label="Guardar" onPress={handleSaveRoutineEdit} disabled={!editRoutineName.trim()} /></View>
                                    </View>
                                </View>
                            </ScrollView>
                        </SafeAreaView>
                    </KeyboardAvoidingView>
                </Modal>
            )}

            {/* Edit Day */}
            {editDayVisible && (
                <Modal transparent visible animationType="fade" onRequestClose={() => setEditDayVisible(false)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                        <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: ThemeFx.backdropStrong }}>
                            <ScrollView
                                contentContainerStyle={ss.innerOverlay}
                                keyboardShouldPersistTaps="handled"
                                bounces={false}
                                showsVerticalScrollIndicator={false}
                            >
                                <View style={ss.formBox}>
                                    <Text style={ss.formTitle}>Renombrar día</Text>
                                    <IronInput label="Nombre del día" value={editDayName} onChangeText={setEditDayName} autoFocus />
                                    <View style={ss.rowGap12}>
                                        <View style={ss.flex1}><IronButton label="Cancelar" variant="ghost" onPress={() => setEditDayVisible(false)} /></View>
                                        <View style={ss.flex1}><IronButton label="Guardar" onPress={handleSaveDayEdit} disabled={!editDayName.trim()} /></View>
                                    </View>
                                </View>
                            </ScrollView>
                        </SafeAreaView>
                    </KeyboardAvoidingView>
                </Modal>
            )}

            {/* Exercise Picker */}
            {addExerciseVisible && (
                <Modal visible transparent animationType="slide" onRequestClose={() => setAddExerciseVisible(false)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                        <SafeAreaView edges={['top', 'left', 'right']} style={ss.overlay}>
                            <View style={ss.sheet}>
                                <View style={ss.header}>
                                    <View style={ss.headerTextContainer}>
                                        <Text style={ss.headerTitle}>Seleccionar ejercicio</Text>
                                        <Text style={ss.headerSub}>Tocá uno para agregarlo a {selectedDay?.name}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => setAddExerciseVisible(false)} style={ss.closeBtn}>
                                        <X size={18} color={colors.text} />
                                    </TouchableOpacity>
                                </View>
                                <View style={ss.flex1}>
                                    <ExerciseList onSelect={handleAddExercise} inModal />
                                </View>
                            </View>
                        </SafeAreaView>
                    </KeyboardAvoidingView>
                </Modal>
            )}
            {/* Friend Picker */}
            {friendPickerVisible && (
                <Modal visible transparent animationType="fade" onRequestClose={() => setFriendPickerVisible(false)}>
                    <View style={ss.overlay}>
                        <View style={ss.sheet}>
                            <View style={ss.header}>
                                <View style={ss.headerTextContainer}>
                                    <Text style={ss.headerTitle}>Enviar a amigo</Text>
                                    <Text style={ss.headerSub}>Comparte esta rutina al inbox de un amigo</Text>
                                </View>
                                <TouchableOpacity onPress={() => setFriendPickerVisible(false)} style={ss.closeBtn}>
                                    <X size={18} color={colors.text} />
                                </TouchableOpacity>
                            </View>
                            <View style={ss.friendPickerContent}>
                                {friends.length === 0 ? (
                                    <View style={ss.centered}>
                                        <Users size={40} color={colors.textMuted} strokeWidth={1} />
                                        <Text style={ss.dayMetaEmpty}>No tienes amigos agregados.</Text>
                                    </View>
                                ) : (
                                    <FlatList
                                        data={friends}
                                        keyExtractor={(item) => item.friendId}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity
                                                style={ss.friendItem}
                                                onPress={() => handleSendToFriend(item.friendId)}
                                                disabled={sendingRoutine}
                                            >
                                                <View style={ss.friendInfo}>
                                                    <View style={ss.friendAvatar}>
                                                        <User size={18} color={colors.primary.DEFAULT} />
                                                    </View>
                                                    <Text style={ss.friendName}>{item.displayName}</Text>
                                                </View>
                                                {sendingRoutine ? (
                                                    <ActivityIndicator size="small" color={colors.primary.DEFAULT} />
                                                ) : (
                                                    <View style={ss.friendSendBtn}>
                                                        <Send size={14} color={colors.primary.DEFAULT} />
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        )}
                                    />
                                )}
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
        </Modal>
    );
}


