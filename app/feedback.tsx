import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { MetricsAndFeedbackService } from '@/src/services/MetricsAndFeedbackService';
import { Colors } from '@/src/theme';
import { Stack, router } from 'expo-router';
import { Check, ChevronLeft, Lightbulb, MessageSquareQuote, ShieldAlert } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const FEEDBACK_TYPES = [
    { id: 'bug', label: 'Reportar Bug', icon: ShieldAlert, color: '#ef4444' },
    { id: 'feature_request', label: 'Sugerir Mejora', icon: Lightbulb, color: '#f59e0b' },
    { id: 'review', label: 'Opinión General', icon: MessageSquareQuote, color: Colors.primary.DEFAULT },
] as const;

export default function FeedbackScreen() {
    const [type, setType] = useState<typeof FEEDBACK_TYPES[number]['id']>('feature_request');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async () => {
        if (!message.trim()) {
            Alert.alert('Error', 'Por favor, describe tu problema o sugerencia.');
            return;
        }

        if (message.trim().length < 10) {
            Alert.alert('Error', 'El mensaje debe tener al menos 10 caracteres para que podamos entenderte mejor.');
            return;
        }

        try {
            setLoading(true);
            await MetricsAndFeedbackService.submitFeedback(type as any, message.trim());
            setSuccess(true);
        } catch (e: any) {
            Alert.alert('Error de red', e.message || 'No se pudo enviar el feedback. Intenta de nuevo más tarde.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <SafeAreaWrapper style={s.container}>
                <View style={s.successContainer}>
                    <View style={s.successIconBox}>
                        <Check size={40} color={Colors.white} />
                    </View>
                    <Text style={s.successTitle}>¡Gracias por tu reporte!</Text>
                    <Text style={s.successText}>Tu feedback ha sido guardado de forma segura. Nuestro equipo lo revisará pronto para seguir mejorando IronTrain.</Text>
                    <TouchableOpacity onPress={() => router.back()} style={s.submitBtn}>
                        <Text style={s.submitBtnText}>Volver a Ajustes</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaWrapper>
        );
    }

    return (
        <SafeAreaWrapper style={s.container} edges={['top', 'left', 'right']}>
            <Stack.Screen options={{ headerShown: false }} />

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
                    <View style={s.header}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
                                <ChevronLeft size={20} color={Colors.iron[950]} />
                            </TouchableOpacity>
                            <View>
                                <Text style={s.pageTitle}>Centro de Feedback</Text>
                                <Text style={s.pageSub}>Reporta errores y sugerencias</Text>
                            </View>
                        </View>
                    </View>

                    <Text style={s.description}>
                        ¿Encontraste un error? ¿Tenés una idea brillante? Tu feedback es vital para evolucionar la plataforma.
                        Tus datos de dispositivo y versión se adjuntarán automáticamente para que podamos replicar errores.
                    </Text>

                    <Text style={s.sectionTitle}>¿Qué nos quieres contar?</Text>
                    <View style={s.typeGrid}>
                        {FEEDBACK_TYPES.map((t) => {
                            const Icon = t.icon;
                            const isSelected = type === t.id;
                            return (
                                <TouchableOpacity
                                    key={t.id}
                                    style={[s.typeBtn, isSelected && { borderColor: t.color, backgroundColor: t.color + '10' }]}
                                    onPress={() => setType(t.id)}
                                >
                                    <Icon size={24} color={isSelected ? t.color : Colors.iron[500]} />
                                    <Text style={[s.typeText, isSelected && { color: t.color, fontWeight: '800' }]}>{t.label}</Text>
                                    {isSelected && <View style={[s.typeIndicator, { backgroundColor: t.color }]} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <Text style={s.sectionTitle}>Tus comentarios</Text>
                    <View style={s.inputWrapper}>
                        <TextInput
                            style={s.input}
                            placeholder="Ej: Falla al guardar la rutina nueva..."
                            placeholderTextColor={Colors.iron[400]}
                            multiline
                            numberOfLines={8}
                            textAlignVertical="top"
                            value={message}
                            onChangeText={setMessage}
                            autoCorrect
                        />
                    </View>

                    <TouchableOpacity
                        style={[s.submitBtn, (!message.trim() || loading) && s.submitBtnDisabled]}
                        onPress={handleSubmit}
                        disabled={!message.trim() || loading}
                    >
                        {loading ? <ActivityIndicator color={Colors.white} /> : <Text style={s.submitBtnText}>Enviar Informe</Text>}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaWrapper>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.iron[900],
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: Colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.iron[300],
    },
    pageTitle: {
        color: Colors.iron[950],
        fontWeight: '900',
        fontSize: 24,
        letterSpacing: -1,
    },
    pageSub: {
        color: Colors.primary.DEFAULT,
        fontSize: 12,
        fontWeight: '800',
        marginTop: 2,
        letterSpacing: 0.5,
    },
    description: {
        fontSize: 14,
        color: Colors.iron[600],
        lineHeight: 22,
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: Colors.iron[400],
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    typeGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 32,
    },
    typeBtn: {
        flex: 1,
        backgroundColor: Colors.white,
        borderWidth: 2,
        borderColor: Colors.iron[200],
        borderRadius: 16,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        position: 'relative',
        overflow: 'hidden',
    },
    typeText: {
        fontSize: 11,
        fontWeight: '600',
        color: Colors.iron[500],
        textAlign: 'center',
    },
    typeIndicator: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 4,
    },
    inputWrapper: {
        backgroundColor: Colors.white,
        borderWidth: 1,
        borderColor: Colors.iron[200],
        borderRadius: 16,
        marginBottom: 32,
        padding: 4,
    },
    input: {
        height: 160,
        padding: 16,
        fontSize: 16,
        color: Colors.iron[950],
    },
    submitBtn: {
        backgroundColor: Colors.primary.DEFAULT,
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.primary.DEFAULT,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    submitBtnDisabled: {
        opacity: 0.5,
    },
    submitBtnText: {
        color: Colors.white,
        fontSize: 15,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    successContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    successIconBox: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.green[500],
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: Colors.iron[950],
        marginBottom: 12,
        textAlign: 'center',
    },
    successText: {
        fontSize: 15,
        color: Colors.iron[600],
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
});
