import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { ToastContainer } from './ToastContainer';

type ModalScreenOverlayHostProps = {
    children: React.ReactNode;
} & Omit<ViewProps, 'children'>;

export function ModalScreenOverlayHost({ children, style, ...rest }: ModalScreenOverlayHostProps) {
    return (
        <View style={[styles.container, style]} {...rest}>
            {children}
            <ToastContainer />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
