import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Linking, Platform } from 'react-native';
import { confirm } from '../store/confirmStore';
import { isOptimizationFlagEnabled } from '../utils/optimizationFlags';

const WEATHER_PERMISSION_PROMPTED_KEY = 'irontrain_weather_location_prompted_v1';

class LocationPermissionsService {
    private resolveAccuracy(silent: boolean): Location.Accuracy {
        if (!isOptimizationFlagEnabled('socialRealtimeV2')) {
            return Location.Accuracy.High;
        }

        return silent ? Location.Accuracy.Balanced : Location.Accuracy.High;
    }

    async requestWeatherBonusPermission(explainDenied = false): Promise<boolean> {
        try {
            const current = await Location.getForegroundPermissionsAsync();
            if (current.status === 'granted') return true;

            const result = await Location.requestForegroundPermissionsAsync();
            if (result.status === 'granted') return true;

            if (explainDenied) {
                confirm.ask(
                    'Permiso de ubicación',
                    'Para aplicar correctamente el multiplicador por lluvia o frío al finalizar entrenamientos, habilita ubicación en uso.',
                    () => {
                        if (Platform.OS === 'ios') {
                            Linking.openURL('app-settings:');
                        } else {
                            Linking.openSettings();
                        }
                    },
                    'Ir a Configuración'
                );
            }
            return false;
        } catch {
            return false;
        }
    }

    async requestWeatherBonusPermissionOnce(): Promise<boolean> {
        try {
            const prompted = await SecureStore.getItemAsync(WEATHER_PERMISSION_PROMPTED_KEY);
            if (prompted === 'true') {
                return this.requestWeatherBonusPermission(false);
            }
            const granted = await this.requestWeatherBonusPermission(true);
            await SecureStore.setItemAsync(WEATHER_PERMISSION_PROMPTED_KEY, 'true');
            return granted;
        } catch {
            return false;
        }
    }

    async getCurrentLocation(silent = false): Promise<{ lat: number; lon: number; city: string | null } | null> {
        try {
            // If silent, we only want to get it if we already have permission, 
            // OR if we haven't prompted the user even once yet.
            if (silent) {
                const current = await Location.getForegroundPermissionsAsync();
                const prompted = await SecureStore.getItemAsync(WEATHER_PERMISSION_PROMPTED_KEY);

                // If it's undetermined and we never prompted, we can prompt even if silent=true 
                // because the user expects a better experience on the first load of the Social tab. 
                // But once it's denied or prompted, we respect silence.
                if (current.status === 'undetermined' && !prompted) {
                    const granted = await this.requestWeatherBonusPermissionOnce();
                    if (!granted) return null;
                } else if (current.status !== 'granted') {
                    return null;
                }
            } else {
                const hasPermission = await this.requestWeatherBonusPermission(true);
                if (!hasPermission) return null;
            }

            const position = await Location.getCurrentPositionAsync({
                accuracy: this.resolveAccuracy(silent),
            });

            const { latitude: lat, longitude: lon } = position.coords;

            // Reverse geocoding to get city name
            const [address] = await Location.reverseGeocodeAsync({
                latitude: lat,
                longitude: lon,
            });

            return {
                lat,
                lon,
                city: address?.city ?? address?.subregion ?? address?.region ?? null,
            };
        } catch {
            return null;
        }
    }
}

export const locationPermissionsService = new LocationPermissionsService();
