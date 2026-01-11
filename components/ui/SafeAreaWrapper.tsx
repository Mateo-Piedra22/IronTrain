import React from 'react';
import { View, ViewProps } from 'react-native';
import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';

interface SafeAreaWrapperProps extends SafeAreaViewProps {
  children: React.ReactNode;
  centered?: boolean;
}

export function SafeAreaWrapper({ children, style, edges = ['top', 'left', 'right'], centered = true, ...props }: SafeAreaWrapperProps) {
  return (
    <SafeAreaView 
      style={[{ flex: 1, backgroundColor: '#0a0a0a' }, style]} 
      edges={edges}
      {...props}
    >
      <View className={`flex-1 w-full ${centered ? 'items-center' : ''}`}>
        <View className="flex-1 w-full max-w-[600px]">
          {children}
        </View>
      </View>
    </SafeAreaView>
  );
}
