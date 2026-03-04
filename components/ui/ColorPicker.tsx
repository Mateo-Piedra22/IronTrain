import { Colors } from '@/src/theme';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Modal, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

/** Draggable slider track that responds to both taps and pan gestures */
function SliderTrack({ value, max, onChange, children }: {
    value: number; max: number; onChange: (v: number) => void; children: React.ReactNode;
}) {
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
}

export function ColorPicker({ visible, initialColor = '#3b82f6', onClose, onSelect }: ColorPickerProps) {
    const [hue, setHue] = useState(0);
    const [sat, setSat] = useState(100);
    const [lig, setLig] = useState(50);
    const [hex, setHex] = useState(initialColor);

    useEffect(() => {
        if (visible) {
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
                            colors={['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000']}
                            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                            style={ss.gradient}
                        />
                    </SliderTrack>

                    {/* Saturation */}
                    <Text style={ss.sliderLabel}>Saturación</Text>
                    <SliderTrack value={sat} max={100} onChange={(v) => setSat(Math.round(v))}>
                        <LinearGradient
                            colors={['#808080', hslToHex(hue, 100, 50)]}
                            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                            style={ss.gradient}
                        />
                    </SliderTrack>

                    {/* Lightness */}
                    <Text style={ss.sliderLabel}>Luminosidad</Text>
                    <SliderTrack value={lig} max={100} onChange={(v) => setLig(Math.round(v))}>
                        <LinearGradient
                            colors={['#000000', hslToHex(hue, sat, 50), '#ffffff']}
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

const ss = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    sheet: { backgroundColor: Colors.iron[900], width: '100%', maxWidth: 380, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.iron[700] },
    title: { fontSize: 18, fontWeight: '900', color: Colors.iron[950], marginBottom: 20, letterSpacing: -0.3 },
    preview: { height: 80, borderRadius: 14, marginBottom: 24, borderWidth: 1, borderColor: Colors.iron[700], alignItems: 'center', justifyContent: 'center' },
    previewBadge: { backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
    previewText: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 1 },
    sliderLabel: { color: Colors.iron[400], fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.8 },
    trackOuter: { height: 40, borderRadius: 20, overflow: 'hidden', position: 'relative', justifyContent: 'center', marginBottom: 20 },
    gradient: { flex: 1, borderRadius: 20 },
    thumb: { position: 'absolute', width: 20, height: '100%', backgroundColor: '#fff', borderWidth: 2, borderColor: '#000', borderRadius: 10, transform: [{ translateX: -10 }], shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
    actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
    cancelBtn: { flex: 1, paddingVertical: 14, backgroundColor: Colors.iron[800], borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.iron[700] },
    cancelText: { color: Colors.iron[400], fontWeight: '800', fontSize: 14 },
    selectBtn: { flex: 1, paddingVertical: 14, backgroundColor: Colors.primary.DEFAULT, borderRadius: 14, alignItems: 'center' },
    selectText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
