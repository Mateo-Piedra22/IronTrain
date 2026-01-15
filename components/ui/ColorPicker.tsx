import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

interface ColorPickerProps {
    visible: boolean;
    initialColor?: string;
    onClose: () => void;
    onSelect: (color: string) => void;
}

// Simple HSL to Hex Helper
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

// Simple Hex to HSL Helper
function hexToHSL(hex: string): { h: number, s: number, l: number } {
    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 210, s: 50, l: 50 }; // Default Blue

    let r = parseInt(result[1], 16);
    let g = parseInt(result[2], 16);
    let b = parseInt(result[3], 16);

    r /= 255; g /= 255; b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        let d = max - min;
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

export function ColorPicker({ visible, initialColor = '#3b82f6', onClose, onSelect }: ColorPickerProps) {
    const [hue, setHue] = useState(0);
    const [sat, setSat] = useState(100);
    const [lig, setLig] = useState(50);
    const [hex, setHex] = useState(initialColor);

    useEffect(() => {
        if (visible) {
            const hsl = hexToHSL(initialColor);
            setHue(hsl.h);
            setSat(hsl.s);
            setLig(hsl.l);
            setHex(initialColor);
        }
    }, [visible, initialColor]);

    useEffect(() => {
        setHex(hslToHex(hue, sat, lig));
    }, [hue, sat, lig]);

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 bg-iron-950/80 justify-center items-center p-6">
                <View className="bg-iron-900 w-full max-w-sm rounded-2xl p-6 border border-iron-700">
                    <Text className="text-xl font-bold text-iron-950 mb-6">Pick Color</Text>

                    {/* Preview */}
                    <View className="h-24 rounded-xl mb-6 border border-iron-700 flex-row items-center justify-center" style={{ backgroundColor: hex }}>
                        <Text className="text-iron-950 font-bold bg-black/20 px-4 py-2 rounded uppercase text-lg select-text">{hex}</Text>
                    </View>

                    {/* Hue Slider */}
                    <Text className="text-iron-500 text-xs font-bold mb-2 uppercase">Hue</Text>
                    <View className="h-10 mb-6 rounded-full overflow-hidden relative justify-center">
                        <LinearGradient
                            colors={['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={{ flex: 1 }}
                        />
                        <View className="absolute w-full h-full flex-row">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={{ flex: 1 }}
                                    onPress={() => setHue(i * (360 / 20))}
                                />
                            ))}
                        </View>
                        <View pointerEvents="none" className="absolute w-4 h-full bg-white border-2 border-black rounded-full shadow-lg" style={{ left: `${(hue / 360) * 100}%`, transform: [{ translateX: -8 }] }} />
                    </View>

                    {/* Saturation Slider */}
                    <Text className="text-iron-500 text-xs font-bold mb-2 uppercase">Saturation</Text>
                    <View className="h-10 mb-6 rounded-full overflow-hidden relative justify-center bg-iron-800">
                        <LinearGradient
                            colors={['#808080', hslToHex(hue, 100, 50)]}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={{ flex: 1 }}
                        />
                        <View className="absolute w-full h-full flex-row">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={{ flex: 1 }}
                                    onPress={() => setSat(i * 10)}
                                />
                            ))}
                        </View>
                        <View pointerEvents="none" className="absolute w-4 h-full bg-white border-2 border-black rounded-full shadow-lg" style={{ left: `${sat}%`, transform: [{ translateX: -8 }] }} />
                    </View>

                    {/* Lightness Slider */}
                    <Text className="text-iron-500 text-xs font-bold mb-2 uppercase">Lightness</Text>
                    <View className="h-10 mb-6 rounded-full overflow-hidden relative justify-center bg-iron-800">
                        <LinearGradient
                            colors={['#000000', hslToHex(hue, sat, 50), '#ffffff']}
                            start={{ x: 0, y: 0.5 }}
                            end={{ x: 1, y: 0.5 }}
                            style={{ flex: 1 }}
                        />
                        <View className="absolute w-full h-full flex-row">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <TouchableOpacity
                                    key={i}
                                    style={{ flex: 1 }}
                                    onPress={() => setLig(i * 10)}
                                />
                            ))}
                        </View>
                        <View pointerEvents="none" className="absolute w-4 h-full bg-white border-2 border-black rounded-full shadow-lg" style={{ left: `${lig}%`, transform: [{ translateX: -8 }] }} />
                    </View>

                    {/* Actions */}
                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={onClose}
                            className="flex-1 py-4 bg-iron-800 rounded-xl items-center"
                        >
                            <Text className="text-iron-500 font-bold">Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => onSelect(hex)}
                            className="flex-1 py-4 bg-primary rounded-xl items-center"
                        >
                            <Text className="text-white font-bold">Select Clean Color</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
