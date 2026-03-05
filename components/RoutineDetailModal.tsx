import { ExerciseList } from '@/components/ExerciseList';
import { IronButton } from '@/components/IronButton';
import { IronInput } from '@/components/IronInput';
import { RoutineDayWithExercises, routineService } from '@/src/services/RoutineService';
import { SocialService } from '@/src/services/SocialService';
import { useAuthStore } from '@/src/store/authStore';
import { confirm } from '@/src/store/confirmStore';
import { Colors } from '@/src/theme';
import { Routine } from '@/src/types/db';
import { notify } from '@/src/utils/notify';
import { Calendar, ChevronRight, Dumbbell, Edit3, GripVertical, Plus, Send, Share2, Trash2, User, Users, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';

interface RoutineDetailModalProps {
    visible: boolean;
    routineId: string | null;
    onClose: () => void;
    onDeleted: () => void;
}

type ViewMode = 'routine' | 'day';

export function RoutineDetailModal({ visible, routineId, onClose, onDeleted }: RoutineDetailModalProps) {
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
            <View style={[st.dayBlockOuter, isActive && st.dayBlockActive]}>
                <TouchableOpacity
                    style={st.dayBlockHeader}
                    onPress={() => openDay(item)}
                    onLongPress={drag}
                    delayLongPress={200}
                    activeOpacity={0.7}
                >
                    <View style={{ paddingRight: 8, paddingVertical: 4 }}>
                        <GripVertical color={Colors.iron[400]} size={16} />
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                        <View style={st.dayIconBox}>
                            <Calendar color={Colors.primary.DEFAULT} size={18} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={st.dayTitle} numberOfLines={1}>{item.name}</Text>
                        </View>
                    </View>
                    <View style={st.arrowCircle}>
                        <ChevronRight size={16} color={Colors.iron[500]} />
                    </View>
                </TouchableOpacity>

                {/* Show Preview of Exercises Inside the Day Block */}
                <View style={st.dayBlockInner}>
                    {item.exercises.length === 0 ? (
                        <Text style={st.dayMetaEmpty}>Sin ejercicios añadidos.</Text>
                    ) : (
                        item.exercises.map((ex, idx) => (
                            <View key={ex.id} style={st.dayInnerExRow}>
                                <Text style={st.dayInnerExNum}>{idx + 1}.</Text>
                                <Text style={st.dayInnerExText} numberOfLines={1}>{ex.exercise_name}</Text>
                            </View>
                        ))
                    )}
                    <TouchableOpacity style={st.addInnerBtn} onPress={() => openDay(item)}>
                        <Plus size={14} color={Colors.primary.DEFAULT} />
                        <Text style={st.addInnerBtnText}>Gestionar Ejercicios</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScaleDecorator>
    );

    const renderExerciseItem = ({ item, drag, isActive }: RenderItemParams<RoutineDayWithExercises['exercises'][0]>) => (
        <ScaleDecorator>
            <View style={[st.exCard, isActive && st.exCardActive]}>
                <Pressable onLongPress={drag} delayLongPress={200} style={{ paddingVertical: 6, paddingHorizontal: 4 }}>
                    <GripVertical color={Colors.iron[600]} size={16} />
                </Pressable>
                <View style={st.exIconBox}>
                    <Dumbbell color={Colors.primary.DEFAULT} size={16} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={st.exCardTitle} numberOfLines={1}>{item.exercise_name}</Text>
                    {item.category_name ? <Text style={st.exCardMeta}>{item.category_name.toUpperCase()}</Text> : null}
                </View>
                <TouchableOpacity onPress={() => handleDeleteExercise(item.id, item.exercise_name)}
                    style={{ padding: 8, backgroundColor: '#ef444412', borderRadius: 10, borderWidth: 1, borderColor: '#ef444425' }}>
                    <Trash2 size={14} color="#ef4444" />
                </TouchableOpacity>
            </View>
        </ScaleDecorator>
    );

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
            <View style={st.overlay}>
                <View style={st.sheet}>
                    {/* Header */}
                    <View style={st.header}>
                        <View style={{ flex: 1 }}>
                            <Text style={st.headerTitle}>
                                {viewMode === 'day' && selectedDay ? selectedDay.name : routine?.name || 'Rutina'}
                            </Text>
                            <Text style={st.headerSub}>
                                {viewMode === 'day'
                                    ? `${selectedDay?.exercises?.length || 0} ejercicios`
                                    : `${days.length} ${days.length === 1 ? 'día' : 'días'} de entrenamiento`}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={handleClose} style={st.closeBtn}>
                            <X size={18} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={st.centered}><ActivityIndicator size="large" color={Colors.primary.DEFAULT} /></View>
                    ) : viewMode === 'routine' ? (
                        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                            <View style={st.contentArea}>
                                {/* Routine info card */}
                                {routine?.description ? (
                                    <View style={st.infoCard}>
                                        <Text style={st.infoCardText}>{routine.description}</Text>
                                    </View>
                                ) : null}

                                {/* Action buttons row */}
                                <View style={st.btnRow}>
                                    <View style={{ flex: 1 }}>
                                        <TouchableOpacity style={[st.smallBtn, { backgroundColor: Colors.primary.DEFAULT, borderColor: Colors.primary.DEFAULT }]} onPress={handleShareRoutine}>
                                            <Share2 size={12} color="white" />
                                            <Text style={[st.smallBtnText, { color: 'white' }]}>Link</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <TouchableOpacity style={st.smallBtn} onPress={handleOpenFriendPicker}>
                                            <Send size={12} color={Colors.primary.DEFAULT} />
                                            <Text style={st.smallBtnText}>Amigo</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <TouchableOpacity style={st.smallBtn} onPress={() => {
                                            setEditRoutineName(routine?.name || ''); setEditRoutineDesc(routine?.description || ''); setEditRoutinePublic(routine?.is_public === 1); setEditRoutineVisible(true);
                                        }}>
                                            <Edit3 size={12} color={Colors.primary.DEFAULT} />
                                            <Text style={st.smallBtnText}>Edit</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <TouchableOpacity style={[st.smallBtn, { borderColor: '#ef444430' }]} onPress={handleDeleteRoutine}>
                                            <Trash2 size={12} color="#ef4444" />
                                            <Text style={[st.smallBtnText, { color: '#ef4444' }]}>Del</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Section label */}
                                <Text style={st.sectionLabel}>Días de entrenamiento</Text>

                                {/* Days */}
                                {days.length === 0 ? (
                                    <View style={st.emptyBlock}>
                                        <Calendar size={28} color={Colors.iron[400]} />
                                        <Text style={st.emptyTitle}>Sin días definidos</Text>
                                        <Text style={st.emptyText}>Tocá el botón para agregar estructura.</Text>
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
                                <TouchableOpacity style={st.addRow} onPress={handleAddDay}>
                                    <Plus size={18} color={Colors.primary.DEFAULT} />
                                    <Text style={st.addRowText}>Agregar día</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    ) : (
                        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                            <View style={st.contentArea}>
                                {/* Day action buttons */}
                                <View style={st.btnRow}>
                                    <TouchableOpacity style={st.smallBtn} onPress={() => { setEditDayName(selectedDay?.name || ''); setEditDayVisible(true); }}>
                                        <Edit3 size={14} color={Colors.primary.DEFAULT} />
                                        <Text style={st.smallBtnText}>Renombrar</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[st.smallBtn, { borderColor: '#ef444430' }]} onPress={handleDeleteDay}>
                                        <Trash2 size={14} color="#ef4444" />
                                        <Text style={[st.smallBtnText, { color: '#ef4444' }]}>Eliminar día</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={st.sectionLabel}>Ejercicios del día</Text>

                                {dayLoading ? (
                                    <View style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator color={Colors.primary.DEFAULT} /></View>
                                ) : (selectedDay?.exercises || []).length === 0 ? (
                                    <View style={st.emptyBlock}>
                                        <Dumbbell size={28} color={Colors.iron[400]} />
                                        <Text style={st.emptyTitle}>Sin ejercicios</Text>
                                        <Text style={st.emptyText}>Agregá ejercicios a este día.</Text>
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

                                <TouchableOpacity style={st.addRow} onPress={() => setAddExerciseVisible(true)}>
                                    <Plus size={18} color={Colors.primary.DEFAULT} />
                                    <Text style={st.addRowText}>Agregar ejercicio</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    )}
                </View>
            </View>

            {/* Edit Routine */}
            {editRoutineVisible && (
                <Modal transparent visible animationType="fade" onRequestClose={() => setEditRoutineVisible(false)}>
                    <View style={st.innerOverlay}>
                        <View style={st.formBox}>
                            <Text style={st.formTitle}>Editar rutina</Text>
                            <IronInput label="Nombre" value={editRoutineName} onChangeText={setEditRoutineName} autoFocus />
                            <IronInput label="Descripción" value={editRoutineDesc} onChangeText={setEditRoutineDesc} multiline numberOfLines={2} />

                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 4 }}>
                                <View style={{ flex: 1, paddingRight: 16 }}>
                                    <Text style={{ color: Colors.iron[950], fontWeight: 'bold' }}>Hacer Pública</Text>
                                    <Text style={{ color: Colors.iron[500], fontSize: 11 }}>Aparecerá en el Directorio Global para que otros la descarguen.</Text>
                                </View>
                                <Switch value={editRoutinePublic} onValueChange={setEditRoutinePublic} trackColor={{ true: Colors.primary.DEFAULT }} />
                            </View>

                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1 }}><IronButton label="Cancelar" variant="ghost" onPress={() => setEditRoutineVisible(false)} /></View>
                                <View style={{ flex: 1 }}><IronButton label="Guardar" onPress={handleSaveRoutineEdit} disabled={!editRoutineName.trim()} /></View>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Edit Day */}
            {editDayVisible && (
                <Modal transparent visible animationType="fade" onRequestClose={() => setEditDayVisible(false)}>
                    <View style={st.innerOverlay}>
                        <View style={st.formBox}>
                            <Text style={st.formTitle}>Renombrar día</Text>
                            <IronInput label="Nombre del día" value={editDayName} onChangeText={setEditDayName} autoFocus />
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <View style={{ flex: 1 }}><IronButton label="Cancelar" variant="ghost" onPress={() => setEditDayVisible(false)} /></View>
                                <View style={{ flex: 1 }}><IronButton label="Guardar" onPress={handleSaveDayEdit} disabled={!editDayName.trim()} /></View>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {/* Exercise Picker */}
            {addExerciseVisible && (
                <Modal visible transparent animationType="fade" onRequestClose={() => setAddExerciseVisible(false)}>
                    <View style={st.overlay}>
                        <View style={st.sheet}>
                            <View style={st.header}>
                                <View style={{ flex: 1 }}>
                                    <Text style={st.headerTitle}>Seleccionar ejercicio</Text>
                                    <Text style={st.headerSub}>Tocá uno para agregarlo a {selectedDay?.name}</Text>
                                </View>
                                <TouchableOpacity onPress={() => setAddExerciseVisible(false)} style={st.closeBtn}>
                                    <X size={18} color="#fff" />
                                </TouchableOpacity>
                            </View>
                            <View style={{ flex: 1 }}>
                                <ExerciseList onSelect={handleAddExercise} inModal />
                            </View>
                        </View>
                    </View>
                </Modal>
            )}
            {/* Friend Picker */}
            {friendPickerVisible && (
                <Modal visible transparent animationType="fade" onRequestClose={() => setFriendPickerVisible(false)}>
                    <View style={st.overlay}>
                        <View style={st.sheet}>
                            <View style={st.header}>
                                <View style={{ flex: 1 }}>
                                    <Text style={st.headerTitle}>Enviar a amigo</Text>
                                    <Text style={st.headerSub}>Comparte esta rutina al inbox de un amigo</Text>
                                </View>
                                <TouchableOpacity onPress={() => setFriendPickerVisible(false)} style={st.closeBtn}>
                                    <X size={18} color="#fff" />
                                </TouchableOpacity>
                            </View>
                            <View style={{ flex: 1, padding: 16, backgroundColor: Colors.iron[100] }}>
                                {friends.length === 0 ? (
                                    <View style={st.centered}>
                                        <Users size={40} color={Colors.iron[300]} strokeWidth={1} />
                                        <Text style={{ color: Colors.iron[400], textAlign: 'center', marginTop: 12, fontWeight: '600' }}>No tienes amigos agregados.</Text>
                                    </View>
                                ) : (
                                    <FlatList
                                        data={friends}
                                        keyExtractor={(item) => item.friendId}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    backgroundColor: Colors.surface,
                                                    padding: 16,
                                                    borderRadius: 16,
                                                    marginBottom: 10,
                                                    borderWidth: 1,
                                                    borderColor: Colors.iron[300],
                                                    elevation: 2,
                                                    shadowColor: '#000',
                                                    shadowOffset: { width: 0, height: 2 },
                                                    shadowOpacity: 0.05,
                                                    shadowRadius: 4
                                                }}
                                                onPress={() => handleSendToFriend(item.friendId)}
                                                disabled={sendingRoutine}
                                            >
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary.DEFAULT + '15', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primary.DEFAULT + '30' }}>
                                                        <User size={18} color={Colors.primary.DEFAULT} />
                                                    </View>
                                                    <Text style={{ color: Colors.iron[950], fontWeight: '900', fontSize: 16 }}>{item.displayName}</Text>
                                                </View>
                                                {sendingRoutine ? (
                                                    <ActivityIndicator size="small" color={Colors.primary.DEFAULT} />
                                                ) : (
                                                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.iron[100], alignItems: 'center', justifyContent: 'center' }}>
                                                        <Send size={14} color={Colors.primary.DEFAULT} />
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

const st = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 48,
    },
    sheet: {
        backgroundColor: Colors.iron[900],
        borderWidth: 1,
        borderColor: Colors.iron[700],
        borderRadius: 20,
        flex: 1,
        maxHeight: '95%',
        width: '100%',
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.iron[200],
        backgroundColor: Colors.surface,
    },
    headerTitle: { color: Colors.iron[950], fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
    headerSub: { color: Colors.iron[400], fontSize: 11, marginTop: 2 },
    closeBtn: {
        width: 32, height: 32, borderRadius: 10,
        backgroundColor: Colors.primary.DEFAULT, justifyContent: 'center', alignItems: 'center',
    },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Content area — matches CopyWorkoutModal
    contentArea: {
        padding: 16,
        backgroundColor: Colors.iron[100],
        minHeight: '100%',
    },
    sectionLabel: {
        color: Colors.iron[400],
        fontSize: 10,
        marginBottom: 12,
        marginTop: 16,
        textTransform: 'uppercase',
        fontWeight: '800',
        letterSpacing: 1,
    },
    infoCard: {
        backgroundColor: Colors.surface,
        padding: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary.DEFAULT,
    },
    infoCardText: { fontSize: 14, color: Colors.iron[500], lineHeight: 20 },
    btnRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    smallBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 6,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        backgroundColor: Colors.surface,
    },
    smallBtnText: { fontSize: 11, fontWeight: '800', color: Colors.primary.DEFAULT, textTransform: 'uppercase' },

    // Day block (Container that visually differentiates a Day with its inner exercises)
    dayBlockOuter: {
        marginBottom: 16,
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        overflow: 'hidden',
    },
    dayBlockActive: { borderColor: Colors.primary.DEFAULT, elevation: 4, shadowOpacity: 0.12 },
    dayBlockHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: Colors.iron[50], // Slightly lighter/darker
        borderBottomWidth: 1,
        borderBottomColor: Colors.iron[200],
    },
    dayIconBox: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: Colors.primary.DEFAULT + '20',
        borderWidth: 1, borderColor: Colors.primary.DEFAULT + '40',
        justifyContent: 'center', alignItems: 'center',
    },
    dayTitle: { color: Colors.iron[950], fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
    arrowCircle: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: Colors.iron[200], alignItems: 'center', justifyContent: 'center',
    },
    dayBlockInner: {
        padding: 16,
        backgroundColor: Colors.surface,
    },
    dayMetaEmpty: { color: Colors.iron[400], fontSize: 13, fontStyle: 'italic' },
    dayInnerExRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: Colors.iron[100],
    },
    dayInnerExNum: { color: Colors.primary.DEFAULT, fontWeight: '800', fontSize: 13, width: 20 },
    dayInnerExText: { flex: 1, color: Colors.iron[950], fontSize: 14, fontWeight: '900' },
    addInnerBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 12, marginTop: 4
    },
    addInnerBtnText: { color: Colors.primary.DEFAULT, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },

    // Exercise cards — clean flat style
    exCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 12,
        marginBottom: 10,
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.iron[300],
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        gap: 10,
    },
    exCardActive: { borderColor: Colors.primary.DEFAULT, elevation: 4, shadowOpacity: 0.12 },
    exIconBox: {
        width: 38, height: 38, borderRadius: 11,
        backgroundColor: Colors.primary.DEFAULT + '15',
        borderWidth: 1, borderColor: Colors.primary.DEFAULT + '30',
        alignItems: 'center', justifyContent: 'center',
    },
    exCardTitle: { color: Colors.iron[950], fontWeight: '900', fontSize: 16, letterSpacing: -0.3 },
    exCardMeta: { color: Colors.iron[500], fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 },

    addRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        marginTop: 8,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: Colors.primary.DEFAULT + '40',
        borderStyle: 'dashed',
        backgroundColor: Colors.primary.DEFAULT + '06',
    },
    addRowText: { color: Colors.primary.DEFAULT, fontWeight: '800', fontSize: 14 },

    emptyBlock: {
        alignItems: 'center',
        paddingVertical: 32,
        backgroundColor: Colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        borderStyle: 'dashed',
        gap: 10,
    },
    emptyTitle: { fontSize: 15, fontWeight: '800', color: Colors.iron[950] },
    emptyText: { fontSize: 13, color: Colors.iron[500], textAlign: 'center' },

    // Inner form modals
    innerOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    formBox: {
        backgroundColor: Colors.surface,
        width: '100%',
        maxWidth: 360,
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: Colors.iron[700],
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
    },
    formTitle: { fontSize: 20, fontWeight: '900', color: Colors.iron[950], marginBottom: 20, letterSpacing: -0.3 },
});
