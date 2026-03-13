import { useColors } from '@/src/hooks/useColors';
import { configService } from '@/src/services/ConfigService';
import { DuplicateGroup, DuplicateResolutionService } from '@/src/services/DuplicateResolutionService';
import { feedbackService } from '@/src/services/FeedbackService';
import { confirm } from '@/src/store/confirmStore';
import { ThemeFx, withAlpha } from '@/src/theme';
import { notify } from '@/src/utils/notify';
import { CheckCircle2, ChevronDown, Merge, ShieldOff, Trash2 } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function DuplicateResolutionModal({ visible, onClose }: Props) {
  const colors = useColors();

  const ss = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.surface },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: 14,
          backgroundColor: colors.surface,
          borderBottomWidth: 1.5,
          borderBottomColor: colors.border,
        },
        backBtn: {
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.surfaceLighter,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: colors.border,
        },
        title: { fontSize: 18, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
        sub: { fontSize: 11, fontWeight: '800', color: colors.textMuted, marginTop: 2 },

        content: { padding: 16, paddingBottom: 120 },

        groupCard: {
          backgroundColor: colors.surface,
          borderRadius: 18,
          borderWidth: 1.5,
          borderColor: colors.border,
          padding: 14,
          marginBottom: 12,
          ...ThemeFx.shadowSm,
        },
        groupTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
        groupTitle: { fontSize: 14, fontWeight: '900', color: colors.text },
        pill: {
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.surfaceLighter,
        },
        pillText: { fontSize: 10, fontWeight: '900', color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },

        candidateRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 10,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
        radioOuter: {
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        radioOuterActive: { borderColor: colors.primary.DEFAULT },
        radioInner: {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.primary.DEFAULT,
        },
        candName: { flex: 1, color: colors.text, fontWeight: '800' },
        candMeta: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },

        actionsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
        actionBtn: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderRadius: 14,
          paddingVertical: 12,
          borderWidth: 1.5,
        },
        actionPrimary: { backgroundColor: colors.primary.DEFAULT, borderColor: colors.primary.DEFAULT },
        actionPrimaryText: { color: colors.onPrimary, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase', fontSize: 11 },
        actionSecondary: { backgroundColor: colors.surface, borderColor: colors.border },
        actionSecondaryText: { color: colors.textMuted, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase', fontSize: 11 },
        actionDanger: { backgroundColor: withAlpha(colors.red, '0A'), borderColor: withAlpha(colors.red, '25') },
        actionDangerText: { color: colors.red, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase', fontSize: 11 },

        centered: { paddingVertical: 36, alignItems: 'center', justifyContent: 'center' },
        emptyTitle: { fontSize: 16, fontWeight: '900', color: colors.text },
        emptySub: { marginTop: 6, fontSize: 13, fontWeight: '700', color: colors.textMuted, textAlign: 'center' },
      }),
    [colors]
  );

  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [softGroups, setSoftGroups] = useState<DuplicateGroup[]>([]);
  const [masterByKey, setMasterByKey] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const scan = await DuplicateResolutionService.scanAllDuplicates();
      const ignored = new Set(configService.get('ignoredDuplicateKeys') ?? []);
      const filteredHard = (scan.hard ?? []).filter((g) => !ignored.has(g.key));
      const filteredSoft = (scan.soft ?? []).filter((g) => !ignored.has(g.key));

      setGroups(filteredHard);
      setSoftGroups(filteredSoft);
      const nextMaster: Record<string, string> = {};
      for (const g of filteredHard) {
        nextMaster[g.key] = g.candidates?.[0]?.id ?? '';
      }
      setMasterByKey(nextMaster);
    } catch (e: any) {
      notify.error('Error', e?.message || 'No se pudo escanear duplicados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      load();
    }
  }, [visible]);

  const ignoreGroup = async (g: DuplicateGroup) => {
    try {
      const prev = configService.get('ignoredDuplicateKeys') ?? [];
      const next = Array.from(new Set([...prev, g.key])).slice(0, 2000);
      await configService.set('ignoredDuplicateKeys', next);
      setGroups((cur) => cur.filter((x) => x.key !== g.key));
      setSoftGroups((cur) => cur.filter((x) => x.key !== g.key));
      feedbackService.buttonPress();
      notify.success('Ignorado', 'No volverá a aparecer este aviso.');
    } catch (e: any) {
      notify.error('Error', e?.message || 'No se pudo ignorar.');
    }
  };

  const mergeGroup = async (g: DuplicateGroup) => {
    const masterId = masterByKey[g.key];
    if (!masterId) return;
    const deleteIds = (g.candidates ?? []).map((c) => c.id).filter((id) => id !== masterId);
    if (deleteIds.length === 0) return;

    confirm.custom({
      title: 'Resolver duplicados',
      message: 'Se fusionarán registros y se actualizarán referencias. Esta acción no se puede deshacer.',
      variant: 'warning',
      buttons: [
        { label: 'Cancelar', onPress: confirm.hide, variant: 'ghost' },
        {
          label: 'Fusionar',
          onPress: async () => {
            confirm.hide();
            setLoading(true);
            try {
              await DuplicateResolutionService.mergeGroup({ group: g, masterId, deleteIds });
              setGroups((cur) => cur.filter((x) => x.key !== g.key));
              feedbackService.dayCompleted();
              notify.success('Listo', 'Duplicados resueltos.');
            } catch (e: any) {
              notify.error('Error', e?.message || 'No se pudo fusionar.');
            } finally {
              setLoading(false);
            }
          },
          variant: 'solid',
        },
      ],
    });
  };

  const deleteAllButMaster = async (g: DuplicateGroup) => {
    const masterId = masterByKey[g.key];
    if (!masterId) return;
    const deleteIds = (g.candidates ?? []).map((c) => c.id).filter((id) => id !== masterId);
    if (deleteIds.length === 0) return;

    confirm.custom({
      title: 'Eliminar duplicados',
      message: 'Se eliminarán los duplicados y se conservará un solo registro (master).',
      variant: 'destructive',
      buttons: [
        { label: 'Cancelar', onPress: confirm.hide, variant: 'ghost' },
        {
          label: 'Eliminar',
          onPress: async () => {
            confirm.hide();
            setLoading(true);
            try {
              await DuplicateResolutionService.mergeGroup({ group: g, masterId, deleteIds });
              setGroups((cur) => cur.filter((x) => x.key !== g.key));
              feedbackService.buttonPress();
              notify.success('Eliminados', 'Duplicados eliminados.');
            } catch (e: any) {
              notify.error('Error', e?.message || 'No se pudo eliminar.');
            } finally {
              setLoading(false);
            }
          },
          destructive: true,
        },
      ],
    });
  };

  const onPickMaster = (key: string, masterId: string) => {
    setMasterByKey((prev) => ({ ...prev, [key]: masterId }));
    feedbackService.selection();
  };

  const totalGroups = groups.length + softGroups.length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={ss.container} edges={['top', 'bottom', 'left', 'right']}>
        <View style={ss.header}>
          <TouchableOpacity onPress={onClose} style={ss.backBtn} accessibilityRole="button" accessibilityLabel="Cerrar">
            <ChevronDown size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={ss.title}>Duplicados detectados</Text>
            <Text style={ss.sub}>Elegí un master y resolvé cada grupo</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        {loading ? (
          <View style={ss.centered}>
            <ActivityIndicator color={colors.primary.DEFAULT} />
          </View>
        ) : totalGroups === 0 ? (
          <View style={ss.centered}>
            <CheckCircle2 size={34} color={colors.green} />
            <Text style={[ss.emptyTitle, { marginTop: 12 }]}>Todo en orden</Text>
            <Text style={ss.emptySub}>No se encontraron duplicados.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={ss.content} showsVerticalScrollIndicator={false}>
            {softGroups.length > 0 && (
              <View style={[ss.groupCard, { backgroundColor: withAlpha(colors.yellow, '10'), borderColor: withAlpha(colors.yellow, '35') }]}
              >
                <Text style={[ss.groupTitle, { color: colors.yellow }]}>Revisión recomendada</Text>
                <Text style={[ss.candMeta, { marginTop: 6 }]}>Estos posibles duplicados son sugerencias. Solo podés ignorarlos desde acá.</Text>
              </View>
            )}

            {softGroups.map((g) => (
              <View key={g.key} style={[ss.groupCard, { borderColor: withAlpha(colors.yellow, '35') }]}>
                <View style={ss.groupTitleRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={ss.groupTitle} numberOfLines={1}>{g.label}</Text>
                    <Text style={[ss.candMeta, { marginTop: 4 }]} numberOfLines={1}>{g.type.toUpperCase()} · {g.candidates.length} registros · POSIBLE</Text>
                  </View>
                  <View style={[ss.pill, { borderColor: withAlpha(colors.yellow, '35') }]}>
                    <Text style={[ss.pillText, { color: colors.yellow }]}>SOFT</Text>
                  </View>
                </View>

                {(g.candidates ?? []).map((c) => (
                  <View key={c.id} style={ss.candidateRow}>
                    <View style={ss.radioOuter} />
                    <Text style={ss.candName} numberOfLines={1}>{c.name}</Text>
                    <Text style={ss.candMeta} numberOfLines={1}>{c.origin_id ? 'ORIGIN' : 'LOCAL'}</Text>
                  </View>
                ))}

                <View style={ss.actionsRow}>
                  <TouchableOpacity
                    onPress={() => ignoreGroup(g)}
                    style={[ss.actionBtn, ss.actionSecondary]}
                    accessibilityRole="button"
                    accessibilityLabel="Ignorar"
                  >
                    <ShieldOff size={14} color={colors.textMuted} />
                    <Text style={ss.actionSecondaryText}>Ignorar</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                </View>
              </View>
            ))}

            {groups.map((g) => (
              <View key={g.key} style={ss.groupCard}>
                <View style={ss.groupTitleRow}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={ss.groupTitle} numberOfLines={1}>{g.label}</Text>
                    <Text style={[ss.candMeta, { marginTop: 4 }]} numberOfLines={1}>{g.type.toUpperCase()} · {g.candidates.length} registros</Text>
                  </View>
                  <View style={ss.pill}>
                    <Text style={ss.pillText}>MASTER</Text>
                  </View>
                </View>

                {(g.candidates ?? []).map((c) => {
                  const active = masterByKey[g.key] === c.id;
                  return (
                    <Pressable key={c.id} onPress={() => onPickMaster(g.key, c.id)} style={ss.candidateRow} accessibilityRole="button">
                      <View style={[ss.radioOuter, active && ss.radioOuterActive]}>{active ? <View style={ss.radioInner} /> : null}</View>
                      <Text style={ss.candName} numberOfLines={1}>{c.name}</Text>
                      <Text style={ss.candMeta} numberOfLines={1}>{c.origin_id ? 'ORIGIN' : 'LOCAL'}</Text>
                    </Pressable>
                  );
                })}

                <View style={ss.actionsRow}>
                  <TouchableOpacity
                    onPress={() => mergeGroup(g)}
                    style={[ss.actionBtn, ss.actionPrimary]}
                    accessibilityRole="button"
                    accessibilityLabel="Fusionar duplicados"
                  >
                    <Merge size={14} color={colors.onPrimary} />
                    <Text style={ss.actionPrimaryText}>Fusionar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => ignoreGroup(g)}
                    style={[ss.actionBtn, ss.actionSecondary]}
                    accessibilityRole="button"
                    accessibilityLabel="Ignorar"
                  >
                    <ShieldOff size={14} color={colors.textMuted} />
                    <Text style={ss.actionSecondaryText}>Ignorar</Text>
                  </TouchableOpacity>
                </View>

                <View style={[ss.actionsRow, { marginTop: 8 }]}>
                  <TouchableOpacity
                    onPress={() => deleteAllButMaster(g)}
                    style={[ss.actionBtn, ss.actionDanger]}
                    accessibilityRole="button"
                    accessibilityLabel="Eliminar duplicados"
                  >
                    <Trash2 size={14} color={colors.red} />
                    <Text style={ss.actionDangerText}>Eliminar</Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }} />
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
