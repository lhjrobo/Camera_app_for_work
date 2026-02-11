import { NativeModules, Platform, Alert, ToastAndroid } from 'react-native';

const { Camera2SettingsModule } = NativeModules;

export type EdgeMode = 'default' | 'off' | 'fast' | 'high_quality';
export type NoiseReductionMode = 'default' | 'off' | 'minimal' | 'fast' | 'high_quality';
export type TonemapMode = 'default' | 'contrast_curve' | 'fast' | 'high_quality' | 'gamma_value' | 'preset_curve';
export type HdrMode = boolean;
export type ColorCorrectionMode = 'default' | 'fast' | 'high_quality' | 'transform_matrix';

export interface Camera2Settings {
    edgeMode: EdgeMode;
    noiseReductionMode: NoiseReductionMode;
    tonemapMode: TonemapMode;
    hdrMode: HdrMode;
    colorCorrectionMode: ColorCorrectionMode;
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
 * Get available tonemap modes (DRO) for each camera
 */
export const getAvailableTonemapModes = async (): Promise<{ [cameraId: string]: TonemapMode[] }> => {
    if (Platform.OS !== 'android' || !Camera2SettingsModule) {
        return {};
    }
    return await Camera2SettingsModule.getAvailableTonemapModes();
};

/**
 * Get available HDR modes (Scene Mode) for each camera
 */
export const getAvailableHdrModes = async (): Promise<{ [cameraId: string]: boolean }> => {
    if (Platform.OS !== 'android' || !Camera2SettingsModule) {
        return {};
    }
    return await Camera2SettingsModule.getAvailableHdrModes();
};

/**
 * Get available Color Correction modes for each camera
 */
export const getAvailableColorCorrectionModes = async (): Promise<{ [cameraId: string]: ColorCorrectionMode[] }> => {
    if (Platform.OS !== 'android' || !Camera2SettingsModule) {
        return {};
    }
    return await Camera2SettingsModule.getAvailableColorCorrectionModes();
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
 * Set tonemap mode (DRO - Dynamic Range Optimization) for camera captures
 */
export const setTonemapMode = async (mode: TonemapMode): Promise<boolean> => {
    if (Platform.OS !== 'android' || !Camera2SettingsModule) {
        console.log(TAG, 'setTonemapMode: Not available (non-Android or module missing)');
        return false;
    }
    console.log(TAG, `Setting tonemap mode (DRO) to: ${mode}`);
    const result = await Camera2SettingsModule.setTonemapMode(mode);
    console.log(TAG, `Tonemap mode set result: ${result}`);
    return result;
};

/**
 * Set HDR mode (Scene Mode) for camera captures
 */
export const setHdrMode = async (enable: boolean): Promise<boolean> => {
    if (Platform.OS !== 'android' || !Camera2SettingsModule) {
        console.log(TAG, 'setHdrMode: Not available (non-Android or module missing)');
        return false;
    }
    console.log(TAG, `Setting HDR mode to: ${enable}`);
    const result = await Camera2SettingsModule.setHdrMode(enable);
    console.log(TAG, `HDR mode set result: ${result}`);
    return result;
};

/**
 * Set Color Correction mode (Contrast Enhancement) for camera captures
 */
export const setColorCorrectionMode = async (mode: ColorCorrectionMode): Promise<boolean> => {
    if (Platform.OS !== 'android' || !Camera2SettingsModule) {
        console.log(TAG, 'setColorCorrectionMode: Not available (non-Android or module missing)');
        return false;
    }
    console.log(TAG, `Setting Color Correction mode to: ${mode}`);
    const result = await Camera2SettingsModule.setColorCorrectionMode(mode);
    console.log(TAG, `Color Correction mode set result: ${result}`);
    return result;
};

/**
 * Get current Camera2 settings
 */
export const getCurrentSettings = async (): Promise<Camera2Settings> => {
    if (Platform.OS !== 'android' || !Camera2SettingsModule) {
        return {
            edgeMode: 'default',
            noiseReductionMode: 'default',
            tonemapMode: 'default',
            hdrMode: false,
            colorCorrectionMode: 'default'
        };
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
    console.log(TAG, `Requested: Edge=${settings.edgeMode}, NR=${settings.noiseReductionMode}, DRO=${settings.tonemapMode}, HDR=${settings.hdrMode}, CC=${settings.colorCorrectionMode}`);

    await setEdgeMode(settings.edgeMode);
    await setNoiseReductionMode(settings.noiseReductionMode);
    await setTonemapMode(settings.tonemapMode);
    await setHdrMode(settings.hdrMode);
    await setColorCorrectionMode(settings.colorCorrectionMode);

    // Verify settings were applied
    const currentSettings = await getCurrentSettings();
    console.log(TAG, `Applied: Edge=${currentSettings.edgeMode}, NR=${currentSettings.noiseReductionMode}, DRO=${currentSettings.tonemapMode}, HDR=${currentSettings.hdrMode}, CC=${currentSettings.colorCorrectionMode}`);
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
        const nrModes = await getAvailableNoiseReductionModes();
        const tonemapModes = await getAvailableTonemapModes();
        const hdrModes = await getAvailableHdrModes();
        const ccModes = await getAvailableColorCorrectionModes();

        // Build debug info string
        const lines: string[] = [
            '=== Camera2 Settings Debug ===',
            '',
            '【現在の設定 (Current Settings)】',
            `  エッジ補正: ${formatMode(currentSettings.edgeMode)}`,
            `  ノイズ除去: ${formatMode(currentSettings.noiseReductionMode)}`,
            `  DRO: ${formatMode(currentSettings.tonemapMode)}`,
            `  HDR: ${currentSettings.hdrMode ? 'ON' : 'OFF'}`,
            `  コントラスト強調: ${formatMode(currentSettings.colorCorrectionMode)}`,
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

        // Tonemap modes per camera
        Object.entries(tonemapModes).forEach(([cameraId, modes]) => {
            lines.push(`  Camera ${cameraId} - DRO: ${modes.map(formatMode).join(', ')}`);
        });

        // HDR modes per camera
        Object.entries(hdrModes).forEach(([cameraId, hasHdr]) => {
            lines.push(`  Camera ${cameraId} - HDR: ${hasHdr ? 'Available' : 'Not Available'}`);
        });

        // Color Correction modes per camera
        Object.entries(ccModes).forEach(([cameraId, modes]) => {
            lines.push(`  Camera ${cameraId} - CC: ${modes.map(formatMode).join(', ')}`);
        });

        const debugInfo = lines.join('\n');
        console.log(TAG, debugInfo);
        console.log(TAG, '========== DEBUG END ==========');

        // Show to user
        if (showAlert) {
            if (Platform.OS === 'android') {
                // Use Alert for detailed info
                const isActive = currentSettings.edgeMode !== 'default' ||
                    currentSettings.noiseReductionMode !== 'default' ||
                    currentSettings.tonemapMode !== 'default' ||
                    currentSettings.hdrMode ||
                    currentSettings.colorCorrectionMode !== 'default';

                Alert.alert(
                    'Camera2 Settings Debug',
                    `Current Settings:\n` +
                    `• Edge Mode: ${formatMode(currentSettings.edgeMode)}\n` +
                    `• Noise Reduction: ${formatMode(currentSettings.noiseReductionMode)}\n` +
                    `• DRO: ${formatMode(currentSettings.tonemapMode)}\n` +
                    `• HDR: ${currentSettings.hdrMode ? 'ON' : 'OFF'}\n` +
                    `• Contrast: ${formatMode(currentSettings.colorCorrectionMode)}\n\n` +
                    `Settings are ${isActive ? 'ACTIVE ✓' : 'using defaults'}`,
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
        case 'contrast_curve': return 'コントラストカーブ';
        case 'gamma_value': return 'ガンマ値';
        case 'preset_curve': return 'プリセット';
        case 'transform_matrix': return '変換行列';
        default: return mode;
    }
};
