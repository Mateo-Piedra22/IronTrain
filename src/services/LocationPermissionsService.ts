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
}

export const locationPermissionsService = new LocationPermissionsService();
