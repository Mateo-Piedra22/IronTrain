import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Linking, Platform } from 'react-native';
import { confirm } from '../store/confirmStore';

const WEATHER_PERMISSION_PROMPTED_KEY = 'irontrain_weather_location_prompted_v1';

class LocationPermissionsService {
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

    async getCurrentLocation(): Promise<{ lat: number; lon: number; city: string | null } | null> {
        try {
            const hasPermission = await this.requestWeatherBonusPermission(true);
            if (!hasPermission) return null;

            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
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
