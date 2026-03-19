import { Stack, useLocalSearchParams, useRootNavigationState, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';
import { AlertCircle, ShieldCheck } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../src/hooks/useColors';
import { useAuthStore } from '../src/store/authStore';
import { ThemeFx, withAlpha } from '../src/theme';
import { logger } from '../src/utils/logger';
import { notify } from '../src/utils/notify';

const TOKEN_KEY = 'irontrain_auth_token';

export default function AuthCallback() {
    const router = useRouter();
    const colors = useColors();
    const rootNavigationState = useRootNavigationState();
    const { token } = useLocalSearchParams<{ token: string }>();
    const [status, setStatus] = useState<'validating' | 'success' | 'error'>('validating');

    const ss = useMemo(() => StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
        },
        card: {
            backgroundColor: colors.surface,
            padding: 40,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            alignItems: 'center',
            width: '100%',
            ...ThemeFx.shadowSm
        },
        title: {
            fontSize: 22,
            fontWeight: '900',
            color: colors.text,
            marginTop: 24,
            textTransform: 'uppercase',
            letterSpacing: -0.5,
        },
        subtitle: {
            fontSize: 14,
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: 8,
            lineHeight: 20,
            fontWeight: '600',
        },
        iconCircleSuccess: {
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: withAlpha(colors.green, '15'),
            alignItems: 'center',
            justifyContent: 'center',
        },
        iconCircleError: {
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: withAlpha(colors.red, '15'),
            alignItems: 'center',
            justifyContent: 'center',
        },
        link: {
            marginTop: 24,
            color: colors.primary.DEFAULT,
            fontWeight: '900',
            textDecorationLine: 'none',
            fontSize: 14,
            textTransform: 'uppercase',
            letterSpacing: 1,
        }
    }), [colors]);

    useEffect(() => {
        // Wait for router/navigation to be ready
        if (!rootNavigationState?.key) return;

        async function handleToken() {
            // Expo Router params can be array or string
            const rawToken = Array.isArray(token) ? token[0] : token;

            if (!rawToken) {
                logger.warn('Auth callback: token missing in query params', { scope: 'callback.handleToken' });
                setStatus('error');
                return;
            }

            try {
                // Validate JWT structure (should be 3 parts)
                const parts = rawToken.split('.');
                if (parts.length !== 3) {
                    logger.error('Auth callback: invalid token format received', { scope: 'callback.handleToken', partsLength: parts.length });
                    throw new Error('Token mal formed (missing parts). Check encoding/decoding.');
                }

                jwtDecode(rawToken);

                // Save to SecureStore and update global store
                await SecureStore.setItemAsync(TOKEN_KEY, rawToken);

                // Set flag for initial sync modal
                useAuthStore.getState().setNeedsInitialSync(true);
                await useAuthStore.getState().initialize();

                setStatus('success');

                // Brief delay for visual feedback of success
                setTimeout(() => {
                    if (router) {
                        router.replace('/(tabs)');
                    }
                }, 2000);
            } catch (err) {
                logger.captureException(err, { scope: 'callback.handleToken', message: 'Auth callback failed' });
                setStatus('error');
                notify.error('Autenticación fallida', 'El token recibido no es válido.');
            }
        }

        handleToken();
    }, [token, rootNavigationState?.key]);

    return (
        <View style={ss.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={ss.card}>
                {status === 'validating' && (
                    <>
                        <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
                        <Text style={ss.title}>Validando Acceso</Text>
                        <Text style={ss.subtitle}>Sincronizando ID con IronTrain Hub...</Text>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <View style={ss.iconCircleSuccess}>
                            <ShieldCheck size={32} color={colors.green} />
                        </View>
                        <Text style={ss.title}>¡Éxito!</Text>
                        <Text style={ss.subtitle}>Sincronización completada. Entrando a la terminal...</Text>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <View style={ss.iconCircleError}>
                            <AlertCircle size={32} color={colors.red} />
                        </View>
                        <Text style={ss.title}>Error de Enlace</Text>
                        <Text style={ss.subtitle}>No se pudo completar la sincronización. Regresa al sitio web e intenta de nuevo.</Text>
                        <Text
                            onPress={() => router.replace('/')}
                            style={ss.link}
                        >
                            Volver al inicio
                        </Text>
                    </>
                )}
            </View>
        </View>
    );
}
