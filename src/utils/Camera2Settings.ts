import { NativeModules, Platform, Alert, ToastAndroid } from 'react-native';

const { Camera2SettingsModule } = NativeModules;

export type EdgeMode = 'default' | 'off' | 'fast' | 'high_quality';
export type NoiseReductionMode = 'default' | 'off' | 'minimal' | 'fast' | 'high_quality';

export interface Camera2Settings {
    edgeMode: EdgeMode;
    noiseReductionMode: NoiseReductionMode;
}

const TAG = '[Camera2Settings]';

/**
 * Get available edge modes for each camera
 */
export const getAvailableEdgeModes = async (): Promise<{ [cameraId: string]: EdgeMode[] }> => {
    if (Platform.OS !== 'android' || !Camera2SettingsModule) {
        return {};
    }
    return await Camera2SettingsModule.getAvailableEdgeModes();
};

/**
 * Get available noise reduction modes for each camera
 */
export const getAvailableNoiseReductionModes = async (): Promise<{ [cameraId: string]: NoiseReductionMode[] }> => {
    if (Platform.OS !== 'android' || !Camera2SettingsModule) {
        return {};
    }
    return await Camera2SettingsModule.getAvailableNoiseReductionModes();
};

/**
 * Set edge mode for camera captures
 */
export const setEdgeMode = async (mode: EdgeMode): Promise<boolean> => {
    if (Platform.OS !== 'android' || !Camera2SettingsModule) {
        console.log(TAG, 'setEdgeMode: Not available (non-Android or module missing)');
        return false;
    }
    console.log(TAG, `Setting edge mode to: ${mode}`);
    const result = await Camera2SettingsModule.setEdgeMode(mode);
    console.log(TAG, `Edge mode set result: ${result}`);
    return result;
};

/**
 * Set noise reduction mode for camera captures
 */
export const setNoiseReductionMode = async (mode: NoiseReductionMode): Promise<boolean> => {
    if (Platform.OS !== 'android' || !Camera2SettingsModule) {
        console.log(TAG, 'setNoiseReductionMode: Not available (non-Android or module missing)');
        return false;
    }
    console.log(TAG, `Setting noise reduction mode to: ${mode}`);
    const result = await Camera2SettingsModule.setNoiseReductionMode(mode);
    console.log(TAG, `Noise reduction mode set result: ${result}`);
    return result;
};

/**
 * Get current Camera2 settings
 */
export const getCurrentSettings = async (): Promise<Camera2Settings> => {
    if (Platform.OS !== 'android' || !Camera2SettingsModule) {
        return { edgeMode: 'default', noiseReductionMode: 'default' };
    }
    return await Camera2SettingsModule.getCurrentSettings();
};

/**
 * Apply Camera2 settings from saved preferences
 */
export const applyCamera2Settings = async (settings: Camera2Settings): Promise<void> => {
    if (Platform.OS !== 'android' || !Camera2SettingsModule) {
        return;
    }

    console.log(TAG, '=== Applying Camera2 Settings ===');
    console.log(TAG, `Requested: Edge=${settings.edgeMode}, NR=${settings.noiseReductionMode}`);

    await setEdgeMode(settings.edgeMode);
    await setNoiseReductionMode(settings.noiseReductionMode);

    // Verify settings were applied
    const currentSettings = await getCurrentSettings();
    console.log(TAG, `Applied: Edge=${currentSettings.edgeMode}, NR=${currentSettings.noiseReductionMode}`);
    console.log(TAG, '=================================');
};

/**
 * Debug function to verify Camera2 settings are properly configured
 * Shows both console logs and a Toast/Alert with the information
 */
export const debugCamera2Settings = async (showAlert: boolean = true): Promise<string> => {
    console.log(TAG, '========== DEBUG START ==========');

    if (Platform.OS !== 'android') {
        const msg = 'Camera2 settings only available on Android';
        console.log(TAG, msg);
        console.log(TAG, '========== DEBUG END ==========');
        return msg;
    }

    if (!Camera2SettingsModule) {
        const msg = 'Camera2SettingsModule not available';
        console.log(TAG, msg);
        console.log(TAG, '========== DEBUG END ==========');
        return msg;
    }

    try {
        // Get current settings
        const currentSettings = await getCurrentSettings();
        console.log(TAG, 'Current Settings:', currentSettings);

        // Get available modes for all cameras
        const edgeModes = await getAvailableEdgeModes();
        console.log(TAG, 'Available Edge Modes:', edgeModes);

        const nrModes = await getAvailableNoiseReductionModes();
        console.log(TAG, 'Available Noise Reduction Modes:', nrModes);

        // Build debug info string
        const lines: string[] = [
            '=== Camera2 Settings Debug ===',
            '',
            '【現在の設定 (Current Settings)】',
            `  エッジ補正: ${formatMode(currentSettings.edgeMode)}`,
            `  ノイズ除去: ${formatMode(currentSettings.noiseReductionMode)}`,
            '',
            '【利用可能なモード (Available Modes)】',
        ];

        // Edge modes per camera
        Object.entries(edgeModes).forEach(([cameraId, modes]) => {
            lines.push(`  Camera ${cameraId} - Edge: ${modes.map(formatMode).join(', ')}`);
        });

        // NR modes per camera
        Object.entries(nrModes).forEach(([cameraId, modes]) => {
            lines.push(`  Camera ${cameraId} - NR: ${modes.map(formatMode).join(', ')}`);
        });

        const debugInfo = lines.join('\n');
        console.log(TAG, debugInfo);
        console.log(TAG, '========== DEBUG END ==========');

        // Show to user
        if (showAlert) {
            if (Platform.OS === 'android') {
                // Use Alert for detailed info
                Alert.alert(
                    'Camera2 Settings Debug',
                    `Current Settings:\n` +
                    `• Edge Mode: ${formatMode(currentSettings.edgeMode)}\n` +
                    `• Noise Reduction: ${formatMode(currentSettings.noiseReductionMode)}\n\n` +
                    `Settings are ${currentSettings.edgeMode !== 'default' || currentSettings.noiseReductionMode !== 'default' ? 'ACTIVE ✓' : 'using defaults'}`,
                    [{ text: 'OK' }]
                );
            }
        }

        return debugInfo;
    } catch (error) {
        const errorMsg = `Debug error: ${error}`;
        console.error(TAG, errorMsg);
        console.log(TAG, '========== DEBUG END ==========');
        return errorMsg;
    }
};

/**
 * Format mode for display
 */
const formatMode = (mode: string): string => {
    switch (mode) {
        case 'default': return '自動 (Default)';
        case 'off': return 'OFF';
        case 'fast': return '高速 (Fast)';
        case 'high_quality': return '高画質 (High Quality)';
        case 'minimal': return '最小 (Minimal)';
        default: return mode;
    }
};
