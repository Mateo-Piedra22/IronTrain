import { SafeAreaWrapper } from '@/components/ui/SafeAreaWrapper';
import { StatusBar } from 'expo-status-bar';
import { Platform, Text, View } from 'react-native';

export default function ModalScreen() {
  return (
    <SafeAreaWrapper className="flex-1 bg-iron-900 justify-center items-center p-8">
      <View className="items-center mb-8">
        <Text className="text-4xl font-black text-iron-950 mb-2 tracking-tighter uppercase">IronTrain</Text>
        <Text className="text-iron-500 font-bold uppercase tracking-widest text-xs">Strength Evolved</Text>
      </View>

      <View className="bg-iron-800 p-6 rounded-2xl border border-iron-700 w-full mb-8">
        <Text className="text-iron-950 text-center mb-4 font-semibold leading-6">
          "IronTrain is designed for purists. No nonsense, just heavy Iron and progress."
        </Text>
        <Text className="text-iron-500 text-center text-xs italic">
          - The IronTeam
        </Text>
      </View>

      <StatusBar style={Platform.OS === 'ios' ? 'dark' : 'auto'} />
    </SafeAreaWrapper>
  );
}
