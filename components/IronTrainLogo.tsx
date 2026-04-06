import { useColors } from '@/src/hooks/useColors';
import { logger } from '@/src/utils/logger';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import React, { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

type Props = {
    size?: number;
    color?: string;
    accentColor?: string;
};

let svgXmlCache: { uri: string; xml: string } | null = null;
let svgXmlLoadPromise: { uri: string; promise: Promise<string> } | null = null;

async function loadLogoSvgXml(): Promise<string> {
    const asset = Asset.fromModule(require('../assets/images/irontrain-logo-mono.svg'));
    const cacheKey = asset.uri;

    if (svgXmlCache && svgXmlCache.uri === cacheKey) return svgXmlCache.xml;
    if (svgXmlLoadPromise && svgXmlLoadPromise.uri === cacheKey) return svgXmlLoadPromise.promise;

    const promise = (async () => {
        try {
            if (!asset.localUri) await asset.downloadAsync();
            const uri = asset.localUri ?? asset.uri;
            const xml = await FileSystem.readAsStringAsync(uri);
            svgXmlCache = { uri: cacheKey, xml };
            return xml;
        } catch (e) {
            logger.captureException(e, { scope: 'IronTrainLogo.loadLogoSvgXml', message: 'Failed to load SVG asset' });
            throw e;
        }
    })();

    svgXmlLoadPromise = { uri: cacheKey, promise };

    return promise;
}

export function normalizeSvgXmlForColor(xml: string, color: string, accentColor: string): string {
    // Validate input
    if (!xml || typeof xml !== 'string') {
        return xml || '';
    }

    // Remove XML declaration first as it can cause issues with SvgXml
    let result = xml.replace(/<\?xml[^>]*\?>/gi, '');
    
    // Remove all existing fill attributes
    result = result.replace(/\sfill="[^"]*"/gi, '');
    
    const accentPathIds = new Set<string>([
        //'irontrain-inner-peak-1',
        //'irontrain-inner-peak-2',
        'irontrain-inner-dot-1',
        //'irontrain-outer-circle',
        'irontrain-inner-shield-peak-1',
        'irontrain-inner-shield-peak-2',
        //'irontrain-inner-head',
        //'irontrain-inner-man-shield',
        'irontrain-inner-shield-bottom',
    ]);

    // Apply color to each path. Prefer stable IDs over fragile path indices.
    // Use a replace callback to avoid brittle string replacement.
    const pathTagRegex = /<path\b[^>]*\/?>/gi;
    if (!pathTagRegex.test(result)) {
        // Fallback: apply main color to root SVG if no paths found
        result = result.replace('<svg', `<svg fill="${color}"`);
    } else {
        // Reset regex state after .test
        pathTagRegex.lastIndex = 0;
        result = result.replace(pathTagRegex, (pathTag) => {
            const idMatch = pathTag.match(/\sid=("([^"]+)"|'([^']+)')/i);
            const id = idMatch?.[2] ?? idMatch?.[3];
            const fillValue = id && accentPathIds.has(id) ? accentColor : color;

            if (pathTag.endsWith('/>')) {
                return pathTag.replace(/\/>$/, ` fill="${fillValue}"/>`);
            }
            return pathTag.replace(/>$/, ` fill="${fillValue}">`);
        });
    }
    
    // Ensure viewBox exists
    if (!result.includes('viewBox=')) {
        result = result.replace('<svg', '<svg viewBox="0 0 2048 2048"');
    }
    
    return result;
}

export function IronTrainLogo({ size = 100, color, accentColor }: Props) {
    const colors = useColors();
    const resolvedColor =
        color ??
        colors.logoPrimary ??
        (colors.isDark ? colors.iron?.[800] : colors.iron?.[900]) ??
        colors.text ??
        (colors.isDark ? colors.iron?.[700] : colors.iron?.[700]) ??
        colors.primary?.DEFAULT ??
        '#9CA3AF';
    const resolvedAccentColor =
        accentColor ??
        colors.logoAccent ??
        (colors.isDark ? colors.primary?.light : colors.primary?.dark) ??
        colors.primary?.DEFAULT ??
        colors.onPrimary ??
        resolvedColor;
    const [rawXml, setRawXml] = useState<string | null>(svgXmlCache?.xml ?? null);
    const [loadError, setLoadError] = useState<boolean>(false);

    useEffect(() => {
        let mounted = true;
        if (!rawXml && !loadError) {
            loadLogoSvgXml()
                .then((xml) => {
                    if (!mounted) return;
                    setRawXml(xml);
                    setLoadError(false);
                })
                .catch((e) => {
                    if (!mounted) return;
                    logger.captureException(e, { scope: 'IronTrainLogo.useEffect', message: 'Error loading SVG' });
                    setRawXml(null);
                    setLoadError(true);
                });
        }
        return () => {
            mounted = false;
        };
    }, [rawXml, loadError]);

    const themedXml = useMemo(() => {
        if (!rawXml) return '';
        try {
            const result = normalizeSvgXmlForColor(rawXml, resolvedColor, resolvedAccentColor);
            return result || '';
        } catch (e) {
            logger.captureException(e, { scope: 'IronTrainLogo.useMemo', message: 'Error normalizing SVG XML' });
            return '';
        }
    }, [rawXml, resolvedColor, resolvedAccentColor]);

    if (loadError) {
        return (
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: resolvedColor, fontSize: size / 8, fontWeight: '900' }}>IT</Text>
            </View>
        );
    }

    if (!themedXml || themedXml === '') {
        return (
            <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: resolvedColor, fontSize: size / 8, fontWeight: '900' }}>IT</Text>
            </View>
        );
    }

    return <SvgXml key={`${resolvedColor}-${resolvedAccentColor}`} xml={themedXml} width={size} height={size} />;
}
