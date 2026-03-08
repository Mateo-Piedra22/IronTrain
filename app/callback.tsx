import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { jwtDecode } from 'jwt-decode';
import { AlertCircle, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuthStore } from '../src/store/authStore';
import { Colors } from '../src/theme';
import { notify } from '../src/utils/notify';

const TOKEN_KEY = 'irontrain_auth_token';

export default function AuthCallback() {
    const router = useRouter();
    const { token } = useLocalSearchParams<{ token: string }>();
    const [status, setStatus] = useState<'validating' | 'success' | 'error'>('validating');

    useEffect(() => {
        async function handleToken() {
            // Expo Router params can be array or string
            const rawToken = Array.isArray(token) ? token[0] : token;

            if (!rawToken) {
                console.warn('Auth callback: Token missing in query params');
                setStatus('error');
                return;
            }

            try {
                // Validate JWT structure (should be 3 parts)
                const parts = rawToken.split('.');
                if (parts.length !== 3) {
                    console.error('Invalid token format received:', rawToken.substring(0, 10) + '...', 'Parts:', parts.length);
                    throw new Error('Token mal formed (missing parts). Check encoding/decoding.');
                }

                jwtDecode(rawToken);

                // Save to SecureStore and update global store
                await SecureStore.setItemAsync(TOKEN_KEY, rawToken);
                await useAuthStore.getState().initialize();

                setStatus('success');

                // Brief delay for visual feedback of success
                setTimeout(() => {
                    router.replace('/(tabs)');
                }, 1500);
            } catch (err) {
                console.error('Auth callback error:', err);
                setStatus('error');
                notify.error('Autenticación fallida', 'El token recibido no es válido.');
            }
        }

        handleToken();
    }, [token]);

    return (
        <View style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={styles.card}>
                {status === 'validating' && (
                    <>
                        <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
                        <Text style={styles.title}>Validando Acceso</Text>
                        <Text style={styles.subtitle}>Sincronizando ID con IronTrain Hub...</Text>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <View style={styles.iconCircleSuccess}>
                            <ShieldCheck size={32} color={Colors.green} />
                        </View>
                        <Text style={styles.title}>¡Éxito!</Text>
                        <Text style={styles.subtitle}>Sincronización completada. Entrando a la terminal...</Text>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <View style={styles.iconCircleError}>
                            <AlertCircle size={32} color={Colors.red} />
                        </View>
                        <Text style={styles.title}>Error de Enlace</Text>
                        <Text style={styles.subtitle}>No se pudo completar la sincronización. Regresa al sitio web e intenta de nuevo.</Text>
                        <Text
                            onPress={() => router.replace('/')}
                            style={styles.link}
                        >
                            Volver al inicio
                        </Text>
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.iron[900],
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    card: {
        backgroundColor: Colors.white,
        padding: 40,
        borderRadius: 32,
        borderWidth: 2,
        borderColor: Colors.iron[300],
        alignItems: 'center',
        width: '100%',
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: Colors.iron[950],
        marginTop: 24,
        textTransform: 'uppercase',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 14,
        color: Colors.iron[500],
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 20,
        fontWeight: '600',
    },
    iconCircleSuccess: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.green + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconCircleError: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.red + '15',
        alignItems: 'center',
        justifyContent: 'center',
    },
    link: {
        marginTop: 24,
        color: Colors.primary.DEFAULT,
        fontWeight: '800',
        textDecorationLine: 'underline',
        fontSize: 14,
        textTransform: 'uppercase',
    }
});
