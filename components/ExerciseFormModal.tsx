import { Colors } from '@/src/theme';
import { Check, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { CategoryService } from '../src/services/CategoryService';
import { ExerciseService } from '../src/services/ExerciseService';
import { Category, Exercise, ExerciseType } from '../src/types/db';

interface ExerciseFormModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: () => void;
    initialData?: Exercise | null;
}

export function ExerciseFormModal({ visible, onClose, onSave, initialData }: ExerciseFormModalProps) {
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [type, setType] = useState<ExerciseType>('weight_reps');
    const [categories, setCategories] = useState<Category[]>([]);

    // Reset form when modal opens
    useEffect(() => {
        if (visible) {
            loadCategories();
            if (initialData) {
                setName(initialData.name);
                setCategoryId(initialData.category_id);
                setType(initialData.type);
            } else {
                setName('');
                setCategoryId('');
                setType('weight_reps');
            }
        }
    }, [visible, initialData]);

    const loadCategories = async () => {
        const cats = await CategoryService.getAll();
        setCategories(cats);
        // Default to first category if creating new
        if (!initialData && cats.length > 0 && !categoryId) {
            setCategoryId(cats[0].id);
        }
    };

    const handleSave = async () => {
        if (!name.trim() || !categoryId) return;

        try {
            if (initialData) {
                await ExerciseService.update(initialData.id, { name, category_id: categoryId, type });
            } else {
                await ExerciseService.create({ name, category_id: categoryId, type });
            }
            onSave();
            onClose();
        } catch (e) {
            console.error('Failed to save exercise', e);
        }
    };

    const EXERCISE_TYPES: { id: ExerciseType; label: string }[] = [
        { id: 'weight_reps', label: 'Weight & Reps' },
        { id: 'reps_only', label: 'Reps Only' },
        { id: 'distance_time', label: 'Distance & Time' },
        { id: 'weight_only', label: 'Weight Only' },
    ];

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1 bg-black/50 justify-end"
            >
                <View className="bg-iron-900 rounded-t-3xl h-[85%] border-t border-iron-700">

                    {/* Header */}
                    <View className="flex-row items-center justify-between p-4 border-b border-iron-800">
                        <TouchableOpacity onPress={onClose} className="p-2">
                            <X color={Colors.iron[400]} />
                        </TouchableOpacity>
                        <Text className="text-white text-lg font-bold">
                            {initialData ? 'Edit Exercise' : 'New Exercise'}
                        </Text>
                        <TouchableOpacity onPress={handleSave} className="p-2">
                            <Check color={Colors.primary.dark} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1 p-4">
                        {/* Name Input */}
                        <Text className="text-iron-400 text-xs font-bold uppercase mb-2">Name</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder="e.g. Bench Press"
                            placeholderTextColor={Colors.iron[400]}
                            className="bg-iron-800 text-white p-4 rounded-xl text-lg mb-6 border border-iron-700"
                        />

                        {/* Category Picker */}
                        <Text className="text-iron-400 text-xs font-bold uppercase mb-2">Category</Text>
                        <View className="flex-row flex-wrap mb-6">
                            {categories.map(cat => (
                                <TouchableOpacity
                                    key={cat.id}
                                    onPress={() => setCategoryId(cat.id)}
                                    className={`mr-2 mb-2 px-4 py-2 rounded-full border ${categoryId === cat.id
                                        ? 'bg-iron-800 border-primary'
                                        : 'bg-iron-800 border-iron-700'
                                        }`}
                                >
                                    <Text className={categoryId === cat.id ? 'text-primary font-bold' : 'text-iron-400'}>
                                        {cat.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Type Picker */}
                        <Text className="text-iron-400 text-xs font-bold uppercase mb-2">Tracking Type</Text>
                        <View className="mb-6">
                            {EXERCISE_TYPES.map(t => (
                                <TouchableOpacity
                                    key={t.id}
                                    onPress={() => setType(t.id)}
                                    className={`flex-row items-center justify-between p-4 mb-2 rounded-xl bg-iron-800 border ${type === t.id ? 'border-primary' : 'border-iron-700'
                                        }`}
                                >
                                    <Text className="text-white font-semibold">{t.label}</Text>
                                    {type === t.id && <View className="w-3 h-3 bg-primary rounded-full" />}
                                </TouchableOpacity>
                            ))}
                        </View>

                    </ScrollView>

                    <View className="p-4 bg-iron-900 border-t border-iron-800 mb-6">
                        <TouchableOpacity
                            onPress={handleSave}
                            className="bg-primary p-4 rounded-xl items-center"
                        >
                            <Text className="text-white font-bold text-lg">Save Exercise</Text>
                        </TouchableOpacity>
                    </View>

                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}
