import { IronButton } from '@/components/IronButton';
import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { useColors } from '@/src/hooks/useColors';
import { MetricsAndFeedbackService } from '@/src/services/MetricsAndFeedbackService';
import { confirm } from '@/src/store/confirmStore';
import { ThemeFx, withAlpha } from '@/src/theme';
import { Stack, router } from 'expo-router';
import { Check, ChevronLeft, Lightbulb, MessageSquareQuote, ShieldAlert } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const FEEDBACK_TYPES = [
    { id: 'bug', label: 'Reportar Bug', icon: ShieldAlert, colorKey: 'red' },
    { id: 'feature_request', label: 'Sugerir Mejora', icon: Lightbulb, colorKey: 'yellow' },
    { id: 'review', label: 'Opinión General', icon: MessageSquareQuote, colorKey: 'primary' },
] as const;

export default function FeedbackScreen() {
    const colors = useColors();
    const [type, setType] = useState<typeof FEEDBACK_TYPES[number]['id']>('feature_request');
    const [subject, setSubject] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const ss = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        scrollContent: {
            padding: 20,
            paddingBottom: 40,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 24,
            gap: 16
        },
        backBtn: {
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.surface,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1.5,
            borderColor: colors.border,
            ...ThemeFx.shadowSm,
        },
        pageTitle: {
            color: colors.text,
            fontWeight: '900',
            fontSize: 24,
            letterSpacing: -0.5,
        },
        pageSub: {
            color: colors.primary.DEFAULT,
            fontSize: 12,
            fontWeight: '800',
            marginTop: 2,
            letterSpacing: 0.5,
            textTransform: 'uppercase'
        },
        description: {
            fontSize: 14,
            color: colors.textMuted,
            lineHeight: 22,
            marginBottom: 20,
        },
        contextBox: {
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
            borderRadius: 20,
            padding: 16,
            marginBottom: 28,
            ...ThemeFx.shadowSm
        },
        contextTitle: {
            color: colors.text,
            fontSize: 12,
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
        },
        contextHint: {
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: '600',
            marginTop: 4,
        },
        contextRow: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 12,
        },
        contextPill: {
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.background,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 12,
            color: colors.textMuted,
            fontSize: 11,
            fontWeight: '700',
        },
        sectionTitle: {
            fontSize: 12,
            fontWeight: '900',
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 12,
            marginLeft: 4,
        },
        typeGrid: {
            flexDirection: 'row',
            gap: 12,
            marginBottom: 32,
        },
        typeBtn: {
            flex: 1,
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 20,
            padding: 16,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            position: 'relative',
            overflow: 'hidden',
            ...ThemeFx.shadowSm
        },
        typeText: {
            fontSize: 11,
            fontWeight: '700',
            color: colors.textMuted,
            textAlign: 'center',
        },
        typeIndicator: {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
        },
        singleInputWrapper: {
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 16,
            marginBottom: 20,
            paddingHorizontal: 12,
        },
        singleInput: {
            height: 52,
            fontSize: 15,
            color: colors.text,
            fontWeight: '600'
        },
        inputWrapper: {
            backgroundColor: colors.surface,
            borderWidth: 1.5,
            borderColor: colors.border,
            borderRadius: 20,
            marginBottom: 8,
            padding: 4,
        },
        input: {
            height: 160,
            padding: 16,
            fontSize: 16,
            color: colors.text,
            fontWeight: '500'
        },
        inputHint: {
            fontSize: 11,
            color: colors.textMuted,
            marginBottom: 24,
            textAlign: 'right',
            fontWeight: '700',
            marginRight: 4
        },
        successContainer: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            backgroundColor: colors.background
        },
        successIconBox: {
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.green,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            ...ThemeFx.shadowMd,
            shadowColor: colors.green
        },
        successTitle: {
            fontSize: 26,
            fontWeight: '900',
            color: colors.text,
            marginBottom: 12,
            textAlign: 'center',
            letterSpacing: -0.5
        },
        successText: {
            fontSize: 15,
            color: colors.textMuted,
            textAlign: 'center',
            lineHeight: 24,
            marginBottom: 32,
            paddingHorizontal: 20
        },
        submitBtn: {
            marginTop: 10
        }
    }), [colors]);

    const handleSubmit = async () => {
        if (!message.trim()) {
            confirm.error('Error', 'Por favor, describe tu problema o sugerencia.');
            return;
        }

        if (message.trim().length < 10) {
            confirm.error('Error', 'El mensaje debe tener al menos 10 caracteres para que podamos entenderte mejor.');
            return;
        }

        try {
            setLoading(true);
            await MetricsAndFeedbackService.submitFeedback(type as any, message.trim(), {
                subject: subject.trim() || undefined,
                contactEmail: contactEmail.trim() || undefined,
                context: 'app_feedback_screen',
            });
            setSuccess(true);
        } catch (e: any) {
            confirm.error('Error de red', e.message || 'No se pudo enviar el feedback. Intenta de nuevo más tarde.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <SafeAreaWrapper style={ss.container}>
                <View style={ss.successContainer}>
                    <View style={ss.successIconBox}>
                        <Check size={40} color={colors.white} strokeWidth={3} />
                    </View>
                    <Text style={ss.successTitle}>¡Gracias por tu reporte!</Text>
                    <Text style={ss.successText}>Tu feedback ha sido guardado de forma segura. Nuestro equipo lo revisará pronto para seguir mejorando IronTrain.</Text>
                    <View style={{ width: '100%', paddingHorizontal: 20 }}>
                        <IronButton
                            label="Volver a Ajustes"
                            onPress={() => router.back()}
                        />
                    </View>
                </View>
            </SafeAreaWrapper>
        );
    }

    return (
        <SafeAreaWrapper style={ss.container} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={ss.scrollContent} keyboardShouldPersistTaps="handled">
                    <View style={ss.header}>
                        <TouchableOpacity onPress={() => router.back()} style={ss.backBtn}>
                            <ChevronLeft size={22} color={colors.text} strokeWidth={2.5} />
                        </TouchableOpacity>
                        <View>
                            <Text style={ss.pageTitle}>Feedback</Text>
                            <Text style={ss.pageSub}>Reporta errores y sugerencias</Text>
                        </View>
                    </View>

                    <Text style={ss.description}>
                        ¿Encontraste un error? ¿Tenés una idea brillante? Tu feedback es vital para evolucionar la plataforma.
                    </Text>

                    <View style={ss.contextBox}>
                        <Text style={ss.contextTitle}>Datos del sistema</Text>
                        <Text style={ss.contextHint}>Adjuntamos estos datos automáticamente para mejorar la calidad del reporte.</Text>
                        <View style={ss.contextRow}>
                            <Text style={ss.contextPill}>Versión</Text>
                            <Text style={ss.contextPill}>Sistema operativo</Text>
                            <Text style={ss.contextPill}>Modelo</Text>
                            <Text style={ss.contextPill}>Usuario</Text>
                        </View>
                    </View>

                    <Text style={ss.sectionTitle}>¿Qué nos quieres contar?</Text>
                    <View style={ss.typeGrid}>
                        {FEEDBACK_TYPES.map((t) => {
                            const Icon = t.icon;
                            const isSelected = type === t.id;
                            const typeColor = t.colorKey === 'primary' ? colors.primary.DEFAULT : (colors as any)[t.colorKey];
                            return (
                                <TouchableOpacity
                                    key={t.id}
                                    style={[
                                        ss.typeBtn,
                                        isSelected && { borderColor: typeColor, backgroundColor: withAlpha(typeColor, '10') }
                                    ]}
                                    onPress={() => setType(t.id)}
                                >
                                    <Icon size={24} color={isSelected ? typeColor : colors.textMuted} />
                                    <Text style={[ss.typeText, isSelected && { color: typeColor, fontWeight: '800' }]}>{t.label}</Text>
                                    {isSelected && <View style={[ss.typeIndicator, { backgroundColor: typeColor }]} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Text style={ss.sectionTitle}>Asunto (opcional)</Text>
                    <View style={ss.singleInputWrapper}>
                        <TextInput
                            style={ss.singleInput}
                            placeholder="Ej: Fallo al compartir rutina..."
                            placeholderTextColor={colors.textMuted}
                            value={subject}
                            onChangeText={setSubject}
                            maxLength={140}
                        />
                    </View>

                    <Text style={ss.sectionTitle}>Email de contacto (opcional)</Text>
                    <View style={ss.singleInputWrapper}>
                        <TextInput
                            style={ss.singleInput}
                            placeholder="tu@email.com"
                            placeholderTextColor={colors.textMuted}
                            value={contactEmail}
                            onChangeText={setContactEmail}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            maxLength={128}
                        />
                    </View>

                    <Text style={ss.sectionTitle}>Tus comentarios</Text>
                    <View style={ss.inputWrapper}>
                        <TextInput
                            style={ss.input}
                            placeholder="Describe el problema o sugerencia..."
                            placeholderTextColor={colors.textMuted}
                            multiline
                            numberOfLines={6}
                            textAlignVertical="top"
                            value={message}
                            onChangeText={setMessage}
                            autoCorrect
                            maxLength={4000}
                        />
                    </View>
                    <Text style={ss.inputHint}>{message.trim().length}/4000 caracteres</Text>

                    <View style={ss.submitBtn}>
                        <IronButton
                            label="Enviar Informe"
                            onPress={handleSubmit}
                            loading={loading}
                            disabled={!message.trim() || loading}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaWrapper>
    );
}

