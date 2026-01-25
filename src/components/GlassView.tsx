import React, { forwardRef } from 'react';
import { BlurView } from '@react-native-community/blur';
import { StyleSheet, View, ViewProps, StyleProp, ViewStyle } from 'react-native';

export type GlassViewProps = ViewProps & {
    containerStyle?: StyleProp<ViewStyle>;
    glassStyle?: StyleProp<ViewStyle>;
};

export const GlassView = forwardRef<View, GlassViewProps>(
    ({ children, glassStyle, containerStyle, ...rest }, ref) => {
        return (
            <View style={containerStyle} ref={ref}>
                <BlurView
                    {...rest}
                    blurType="light"
                    blurAmount={10}
                    reducedTransparencyFallbackColor="white"
                    style={[glassStyle, styles.blurView]}
                >
                    {children}
                </BlurView>
            </View>
        );
    },
);

const styles = StyleSheet.create({
    blurView: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
});
