import { ThemeFx, withAlpha } from '@/src/theme';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Modal, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useColors } from '../../src/hooks/useColors';

interface ColorPickerProps {
    visible: boolean;
    initialColor?: string;
    onClose: () => void;
    onSelect: (color: string) => void;
}

function hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHSL(hex: string): { h: number, s: number, l: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 210, s: 50, l: 50 };
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

const HUE_GRADIENT = [0, 60, 120, 180, 240, 300, 360].map((h) => hslToHex(h, 100, 50)) as [string, string, ...string[]];
const SATURATION_BASE = hslToHex(0, 0, 50);
const LIGHTNESS_START = hslToHex(0, 0, 0);
const LIGHTNESS_END = hslToHex(0, 0, 100);

export function ColorPicker({ visible, initialColor, onClose, onSelect }: ColorPickerProps) {
    const colors = useColors();
    const [hue, setHue] = useState(0);
    const [sat, setSat] = useState(100);
    const [lig, setLig] = useState(50);
    const [hex, setHex] = useState(initialColor || colors.blue);

    const ss = useMemo(() => StyleSheet.create({
        overlay: { flex: 1, backgroundColor: ThemeFx.backdropStrong, justifyContent: 'center', alignItems: 'center', padding: 24 },
        sheet: { backgroundColor: colors.surface, width: '100%', maxWidth: 380, borderRadius: 24, padding: 24, borderWidth: 1.5, borderColor: colors.border, ...ThemeFx.shadowLg },
        title: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 20, letterSpacing: -0.3 },
        preview: { height: 80, borderRadius: 16, marginBottom: 24, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
        previewBadge: { backgroundColor: withAlpha(colors.black, '4D'), paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
        previewText: { color: colors.white, fontWeight: '900', fontSize: 15, letterSpacing: 1 },
        sliderLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.8 },
        trackOuter: { height: 40, borderRadius: 20, overflow: 'hidden', position: 'relative', justifyContent: 'center', marginBottom: 20 },
        gradient: { flex: 1, borderRadius: 20 },
        thumb: { position: 'absolute', width: 22, height: '100%', backgroundColor: colors.white, borderWidth: 2.5, borderColor: colors.black, borderRadius: 11, transform: [{ translateX: -11 }], ...ThemeFx.shadowSm },
        actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
        cancelBtn: { flex: 1, paddingVertical: 14, backgroundColor: colors.surfaceLighter, borderRadius: 14, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
        cancelText: { color: colors.textMuted, fontWeight: '800', fontSize: 14 },
        selectBtn: { flex: 1, paddingVertical: 14, backgroundColor: colors.primary.DEFAULT, borderRadius: 14, alignItems: 'center', ...ThemeFx.shadowSm },
        selectText: { color: colors.onPrimary, fontWeight: '900', fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
    }), [colors]);

    /** Draggable slider track that responds to both taps and pan gestures */
    const SliderTrack = useCallback(({ value, max, onChange, children }: {
        value: number; max: number; onChange: (v: number) => void; children: React.ReactNode;
    }) => {
        const widthRef = useRef(0);
        const panResponder = useRef(
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: (evt) => {
                    const x = evt.nativeEvent.locationX;
                    if (widthRef.current > 0) onChange(Math.max(0, Math.min(max, (x / widthRef.current) * max)));
                },
                onPanResponderMove: (evt) => {
                    const x = evt.nativeEvent.locationX;
                    if (widthRef.current > 0) onChange(Math.max(0, Math.min(max, (x / widthRef.current) * max)));
                },
            })
        ).current;

        const onLayout = (e: LayoutChangeEvent) => { widthRef.current = e.nativeEvent.layout.width; };

        return (
            <View style={ss.trackOuter} onLayout={onLayout} {...panResponder.panHandlers}>
                {children}
                <View pointerEvents="none" style={[ss.thumb, { left: `${(value / max) * 100}%` }]} />
            </View>
        );
    }, [ss]);

    useEffect(() => {
        if (visible && initialColor) {
            const hsl = hexToHSL(initialColor);
            setHue(hsl.h); setSat(hsl.s); setLig(hsl.l); setHex(initialColor);
        }
    }, [visible, initialColor]);

    useEffect(() => { setHex(hslToHex(hue, sat, lig)); }, [hue, sat, lig]);

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={ss.overlay}>
                <View style={ss.sheet}>
                    <Text style={ss.title}>Elegir color</Text>

                    {/* Preview */}
                    <View style={[ss.preview, { backgroundColor: hex }]}>
                        <View style={ss.previewBadge}>
                            <Text style={ss.previewText}>{hex.toUpperCase()}</Text>
                        </View>
                    </View>

                    {/* Hue */}
                    <Text style={ss.sliderLabel}>Matiz</Text>
                    <SliderTrack value={hue} max={360} onChange={(v) => setHue(Math.round(v))}>
                        <LinearGradient
                            colors={HUE_GRADIENT}
                            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                            style={ss.gradient}
                        />
                    </SliderTrack>

                    {/* Saturation */}
                    <Text style={ss.sliderLabel}>Saturación</Text>
                    <SliderTrack value={sat} max={100} onChange={(v) => setSat(Math.round(v))}>
                        <LinearGradient
                            colors={[SATURATION_BASE, hslToHex(hue, 100, 50)]}
                            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                            style={ss.gradient}
                        />
                    </SliderTrack>

                    {/* Lightness */}
                    <Text style={ss.sliderLabel}>Luminosidad</Text>
                    <SliderTrack value={lig} max={100} onChange={(v) => setLig(Math.round(v))}>
                        <LinearGradient
                            colors={[LIGHTNESS_START, hslToHex(hue, sat, 50), LIGHTNESS_END]}
                            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                            style={ss.gradient}
                        />
                    </SliderTrack>

                    {/* Actions */}
                    <View style={ss.actions}>
                        <TouchableOpacity onPress={onClose} style={ss.cancelBtn} activeOpacity={0.8}>
                            <Text style={ss.cancelText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onSelect(hex)} style={ss.selectBtn} activeOpacity={0.8}>
                            <Text style={ss.selectText}>Elegir color</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

