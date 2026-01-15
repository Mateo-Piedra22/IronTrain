import { IronButton } from '@/components/IronButton';
import { Colors } from '@/src/theme';
import { Pause, Play, RotateCcw, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface IntervalTimerModalProps {
    visible: boolean;
    onClose: () => void;
}

type TimerState = 'idle' | 'work' | 'rest' | 'finished';

export function IntervalTimerModal({ visible, onClose }: IntervalTimerModalProps) {
    // Config
    const [workDuration, setWorkDuration] = useState('20');
    const [restDuration, setRestDuration] = useState('10');
    const [rounds, setRounds] = useState('8');

    // State
    const [status, setStatus] = useState<TimerState>('idle');
    const [currentRound, setCurrentRound] = useState(1);
    const [timeLeft, setTimeLeft] = useState(parseInt(workDuration));
    const [isPaused, setIsPaused] = useState(false);

    const intervalRef = useRef<any>(null);

    // Audio would go here (expo-av)

    useEffect(() => {
        if (!visible) {
            handleReset();
        }
    }, [visible]);

    useEffect(() => {
        if (status === 'idle' || status === 'finished' || isPaused) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
        }

        intervalRef.current = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    handlePhaseChange();
                    return prev; // Phase change will reset timer
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [status, isPaused]);

    const handlePhaseChange = () => {
        // Logic for state transitions
        if (status === 'work') {
            if (currentRound >= parseInt(rounds) && parseInt(restDuration) === 0) {
                // End if no rest needed on last round (usually there isn't)
                setStatus('finished');
            } else {
                setStatus('rest');
                setTimeLeft(parseInt(restDuration));
            }
        } else if (status === 'rest') {
            if (currentRound >= parseInt(rounds)) {
                setStatus('finished');
            } else {
                setCurrentRound(r => r + 1);
                setStatus('work');
                setTimeLeft(parseInt(workDuration));
            }
        }
    };

    const handleStart = () => {
        setStatus('work');
        setTimeLeft(parseInt(workDuration));
        setCurrentRound(1);
        setIsPaused(false);
    };

    const handlePause = () => setIsPaused(!isPaused);

    const handleReset = () => {
        setStatus('idle');
        setIsPaused(false);
        setTimeLeft(parseInt(workDuration));
        setCurrentRound(1);
    };

    const getBgColor = () => {
        switch (status) {
            case 'work': return 'bg-green-600';
            case 'rest': return 'bg-red-600';
            case 'finished': return 'bg-green-600';
            default: return 'bg-iron-900';
        }
    };

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    if (status === 'idle') {
        // Config Mode
        return (
            <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
                <View className="flex-1 bg-iron-900 p-6">
                    <View className="flex-row justify-between items-center mb-8">
                        <Text className="text-iron-950 font-bold text-2xl">Interval Timer</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X color={Colors.iron[950]} size={28} />
                        </TouchableOpacity>
                    </View>

                    <View className="space-y-6">
                        <View>
                            <Text className="text-iron-500 mb-2 uppercase font-bold text-xs">Work (seconds)</Text>
                            <TextInput
                                value={workDuration}
                                onChangeText={setWorkDuration}
                                keyboardType="numeric"
                                className="bg-iron-800 text-iron-950 text-3xl font-bold p-4 rounded-xl text-center"
                            />
                        </View>

                        <View>
                            <Text className="text-iron-500 mb-2 uppercase font-bold text-xs">Rest (seconds)</Text>
                            <TextInput
                                value={restDuration}
                                onChangeText={setRestDuration}
                                keyboardType="numeric"
                                className="bg-iron-800 text-iron-950 text-3xl font-bold p-4 rounded-xl text-center"
                            />
                        </View>

                        <View>
                            <Text className="text-iron-500 mb-2 uppercase font-bold text-xs">Rounds</Text>
                            <TextInput
                                value={rounds}
                                onChangeText={setRounds}
                                keyboardType="numeric"
                                className="bg-iron-800 text-iron-950 text-3xl font-bold p-4 rounded-xl text-center"
                            />
                        </View>
                    </View>

                    <View className="mt-auto">
                        <IronButton label="START WORKOUT" onPress={handleStart} variant="solid" size="lg" />
                    </View>
                </View>
            </Modal>
        );
    }

    // Active Mode
    return (
        <Modal visible={visible} animationType="fade">
            <View className={`flex-1 ${getBgColor()} justify-center items-center relative`}>
                <TouchableOpacity onPress={onClose} className="absolute top-12 right-6 p-2 bg-iron-950/20 rounded-full">
                    <X color="white" size={28} />
                </TouchableOpacity>

                <View className="items-center">
                    <Text className="text-iron-950/80 font-bold text-2xl mb-4 uppercase tracking-widest">
                        {status === 'work' ? 'WORK IT!' : status === 'rest' ? 'REST' : 'COMPLETE'}
                    </Text>

                    <Text className="text-iron-950 font-black text-9xl">
                        {status === 'finished' ? 'DONE' : formatTime(timeLeft)}
                    </Text>

                    <Text className="text-iron-950/60 text-xl font-bold mt-4">
                        Round {currentRound} / {rounds}
                    </Text>
                </View>

                {status !== 'finished' && (
                    <View className="absolute bottom-12 flex-row gap-6">
                        <TouchableOpacity onPress={handleReset} className="p-6 bg-white/20 rounded-full">
                            <RotateCcw color="white" size={32} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handlePause} className="p-6 bg-white rounded-full">
                            {isPaused ? <Play color="black" size={32} fill="black" /> : <Pause color="black" size={32} fill="black" />}
                        </TouchableOpacity>
                    </View>
                )}

                {status === 'finished' && (
                    <View className="absolute bottom-12 w-full px-6">
                        <IronButton label="Close" onPress={onClose} variant="outline" />
                    </View>
                )}
            </View>
        </Modal>
    );
}
