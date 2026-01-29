import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@app_settings';
const LAST_USED_PREFIX = '@last_used_';

export interface AppSettings {
    // 1. Orientation lock override
    ignoreOrientationLock: boolean;

    // 2. Initial state options (default | fixed | lastUsed)
    folderMode: 'default' | 'fixed' | 'lastUsed';
    fixedFolder?: { name: string; path: string };

    shutterPositionMode: 'default' | 'fixed' | 'lastUsed';
    fixedShutterPositions?: {
        portrait: { x: number; y: number };
        landscape: { x: number; y: number };
    };

    labelingModeMode: 'default' | 'fixed' | 'lastUsed';
    fixedLabelingMode?: 'single' | 'numbered-group' | 'text-group';

    captureMode: 'default' | 'fixed' | 'lastUsed';
    fixedCaptureMode?: 'photo' | 'video';

    flashModeMode: 'default' | 'fixed' | 'lastUsed';
    fixedFlashMode?: 'off' | 'on' | 'auto' | 'always';

    cameraModeMode: 'default' | 'fixed' | 'lastUsed';
    fixedCameraPosition?: 'front' | 'back';
}

export const getDefaultSettings = (): AppSettings => ({
    ignoreOrientationLock: false,
    folderMode: 'lastUsed',
    shutterPositionMode: 'default',
    labelingModeMode: 'default',
    captureMode: 'default',
    flashModeMode: 'default',
    cameraModeMode: 'default',
});

export const loadSettings = async (): Promise<AppSettings> => {
    try {
        const json = await AsyncStorage.getItem(SETTINGS_KEY);
        if (json) {
            return { ...getDefaultSettings(), ...JSON.parse(json) };
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
    return getDefaultSettings();
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
    try {
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
};

export const saveLastUsedState = async (key: string, value: any): Promise<void> => {
    try {
        await AsyncStorage.setItem(LAST_USED_PREFIX + key, JSON.stringify(value));
    } catch (e) {
        console.error('Failed to save last used state:', e);
    }
};

export const getLastUsedState = async <T>(key: string): Promise<T | null> => {
    try {
        const json = await AsyncStorage.getItem(LAST_USED_PREFIX + key);
        if (json) {
            return JSON.parse(json) as T;
        }
    } catch (e) {
        console.error('Failed to get last used state:', e);
    }
    return null;
};

// Helper to get initial value based on settings mode
export const getInitialValue = async <T>(
    settings: AppSettings,
    settingKey: keyof AppSettings,
    fixedKey: keyof AppSettings,
    lastUsedKey: string,
    defaultValue: T
): Promise<T> => {
    const mode = settings[settingKey] as 'default' | 'fixed' | 'lastUsed';

    switch (mode) {
        case 'fixed':
            const fixedValue = settings[fixedKey] as T | undefined;
            return fixedValue ?? defaultValue;
        case 'lastUsed':
            const lastUsed = await getLastUsedState<T>(lastUsedKey);
            return lastUsed ?? defaultValue;
        case 'default':
        default:
            return defaultValue;
    }
};
