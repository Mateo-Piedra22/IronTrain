import React from 'react';
import { View } from 'react-native';
import { SafeAreaView, SafeAreaViewProps } from 'react-native-safe-area-context';
import { useColors } from '../../src/hooks/useColors';

interface SafeAreaWrapperProps extends SafeAreaViewProps {
  children: React.ReactNode;
  centered?: boolean;
  contentStyle?: any;
}

export function SafeAreaWrapper({ children, style, edges = ['top', 'left', 'right'], centered = false, contentStyle, ...props }: SafeAreaWrapperProps) {
  const colors = useColors();
  return (
    <SafeAreaView
      style={[{ flex: 1, backgroundColor: colors.background }, style]}
      edges={edges}
      {...props}
    >
      {centered ? (
        <View style={{ flex: 1, width: '100%', alignItems: 'center' }}>
          <View style={[{ flex: 1, width: '100%', maxWidth: 600 }, contentStyle]}>
            {children}
          </View>
        </View>
      ) : (
        <View style={[{ flex: 1, width: '100%' }, contentStyle]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
