import React from 'react';
import { View } from 'react-native';
import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';

interface SafeAreaWrapperProps extends SafeAreaViewProps {
  children: React.ReactNode;
  centered?: boolean;
  className?: string;
  contentClassName?: string;
}

export function SafeAreaWrapper({ children, style, edges = ['top', 'left', 'right'], centered = false, className, contentClassName, ...props }: SafeAreaWrapperProps) {
  return (
    <SafeAreaView
      className={`flex-1 ${className || 'bg-iron-900'}`}
      style={style}
      edges={edges}
      {...props}
    >
      {centered ? (
        <View className="flex-1 w-full items-center">
          <View className={`flex-1 w-full max-w-[600px] ${contentClassName || ''}`}>
            {children}
          </View>
        </View>
      ) : (
        <View className={`flex-1 w-full ${contentClassName || ''}`}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
