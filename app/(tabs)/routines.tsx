/**
 * This file exists to satisfy Expo Router's file-based routing.
 * Routines are now accessed via the "Biblioteca" tab (exercises.tsx).
 * This route is hidden from the tab bar via `href: null` in _layout.tsx.
 */
import { Redirect } from 'expo-router';

export default function RoutinesRedirect() {
    return <Redirect href="/(tabs)/exercises" />;
}
