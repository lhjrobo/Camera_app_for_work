import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Switch,
    SafeAreaView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { AppSettings, loadSettings, saveSettings } from '../utils/SettingsStorage';

interface SettingsModalProps {
    visible: boolean;
    onClose: () => void;
    currentValues: {
        folder: { name: string; path: string };
        shutterPositions: {
            portrait: { x: number; y: number };
            landscape: { x: number; y: number };
        };
        labelingMode: 'single' | 'numbered-group' | 'text-group';
        captureMode: 'photo' | 'video';
        flashMode: 'off' | 'on' | 'auto' | 'always';
        cameraPosition: 'front' | 'back';
    };
    onSettingsChange: (settings: AppSettings) => void;
}

type SettingMode = 'default' | 'fixed' | 'lastUsed';

interface SettingRowProps {
    label: string;
    mode: SettingMode;
    onModeChange: (mode: SettingMode) => void;
    currentValueLabel: string;
    defaultValueLabel: string;
}

const SettingRow: React.FC<SettingRowProps> = ({
    label,
    mode,
    onModeChange,
    currentValueLabel,
    defaultValueLabel,
}) => {
    return (
        <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>{label}</Text>
            <View style={styles.modeSelector}>
                <TouchableOpacity
                    style={[styles.modeButton, mode === 'default' && styles.modeButtonActive]}
                    onPress={() => onModeChange('default')}
                >
                    <Text style={[styles.modeButtonText, mode === 'default' && styles.modeButtonTextActive]}>
                        デフォルト
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.modeButton, mode === 'fixed' && styles.modeButtonActive]}
                    onPress={() => onModeChange('fixed')}
                >
                    <Text style={[styles.modeButtonText, mode === 'fixed' && styles.modeButtonTextActive]}>
                        固定
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.modeButton, mode === 'lastUsed' && styles.modeButtonActive]}
                    onPress={() => onModeChange('lastUsed')}
                >
                    <Text style={[styles.modeButtonText, mode === 'lastUsed' && styles.modeButtonTextActive]}>
                        前回
                    </Text>
                </TouchableOpacity>
            </View>
            <View style={styles.valueInfo}>
                <Text style={styles.valueLabel}>
                    {mode === 'default' && `デフォルト: ${defaultValueLabel}`}
                    {mode === 'fixed' && `固定値: ${currentValueLabel}`}
                    {mode === 'lastUsed' && '前回使用した値を使用'}
                </Text>
            </View>
        </View>
    );
};

const SettingsModal: React.FC<SettingsModalProps> = ({
    visible,
    onClose,
    currentValues,
    onSettingsChange,
}) => {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (visible) {
            loadSettings().then(s => {
                setSettings(s);
                setLoading(false);
            });
        }
    }, [visible]);

    const handleSave = async () => {
        if (settings) {
            await saveSettings(settings);
            onSettingsChange(settings);
        }
        onClose();
    };

    const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
        if (settings) {
            const newSettings = { ...settings, [key]: value };

            // When setting to 'fixed', also save the current value as the fixed value
            if (value === 'fixed') {
                switch (key) {
                    case 'folderMode':
                        newSettings.fixedFolder = currentValues.folder;
                        break;
                    case 'shutterPositionMode':
                        newSettings.fixedShutterPositions = currentValues.shutterPositions;
                        break;
                    case 'labelingModeMode':
                        newSettings.fixedLabelingMode = currentValues.labelingMode;
                        break;
                    case 'captureMode':
                        newSettings.fixedCaptureMode = currentValues.captureMode;
                        break;
                    case 'flashModeMode':
                        newSettings.fixedFlashMode = currentValues.flashMode;
                        break;
                    case 'cameraModeMode':
                        newSettings.fixedCameraPosition = currentValues.cameraPosition;
                        break;
                }
            }

            setSettings(newSettings);
        }
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>設定</Text>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <Text style={styles.loadingText}>読み込み中...</Text>
                        </View>
                    ) : settings && (
                        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                            {/* Orientation Lock Override */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>画面回転</Text>
                                <View style={styles.toggleRow}>
                                    <View style={styles.toggleLabelContainer}>
                                        <Text style={styles.toggleLabel}>端末の向きに従う</Text>
                                        <Text style={styles.toggleDescription}>
                                            システムの画面ロックを無視して回転
                                        </Text>
                                    </View>
                                    <Switch
                                        value={settings.ignoreOrientationLock}
                                        onValueChange={(value) =>
                                            setSettings({ ...settings, ignoreOrientationLock: value })
                                        }
                                        trackColor={{ false: '#444', true: '#007AFF' }}
                                        thumbColor="#fff"
                                    />
                                </View>
                            </View>

                            {/* Initial State Settings */}
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>起動時の初期設定</Text>

                                <SettingRow
                                    label="フォルダ"
                                    mode={settings.folderMode}
                                    onModeChange={(mode) => updateSetting('folderMode', mode)}
                                    currentValueLabel={currentValues.folder.name}
                                    defaultValueLabel="ルートフォルダ"
                                />

                                <SettingRow
                                    label="シャッター位置"
                                    mode={settings.shutterPositionMode}
                                    onModeChange={(mode) => updateSetting('shutterPositionMode', mode)}
                                    currentValueLabel="現在の位置"
                                    defaultValueLabel="中央"
                                />

                                <SettingRow
                                    label="ラベリングモード"
                                    mode={settings.labelingModeMode}
                                    onModeChange={(mode) => updateSetting('labelingModeMode', mode)}
                                    currentValueLabel={
                                        currentValues.labelingMode === 'single' ? '通常' :
                                            currentValues.labelingMode === 'numbered-group' ? 'グループ' : 'テキスト'
                                    }
                                    defaultValueLabel="通常"
                                />

                                <SettingRow
                                    label="撮影モード"
                                    mode={settings.captureMode}
                                    onModeChange={(mode) => updateSetting('captureMode', mode)}
                                    currentValueLabel={currentValues.captureMode === 'photo' ? '写真' : '動画'}
                                    defaultValueLabel="写真"
                                />

                                <SettingRow
                                    label="フラッシュ"
                                    mode={settings.flashModeMode}
                                    onModeChange={(mode) => updateSetting('flashModeMode', mode)}
                                    currentValueLabel={currentValues.flashMode.toUpperCase()}
                                    defaultValueLabel="OFF"
                                />

                                <SettingRow
                                    label="カメラ"
                                    mode={settings.cameraModeMode}
                                    onModeChange={(mode) => updateSetting('cameraModeMode', mode)}
                                    currentValueLabel={currentValues.cameraPosition === 'back' ? '背面' : '前面'}
                                    defaultValueLabel="背面"
                                />
                            </View>
                        </ScrollView>
                    )}

                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                            <Text style={styles.cancelButtonText}>キャンセル</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                            <Text style={styles.saveButtonText}>保存</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
    },
    content: {
        flex: 1,
        marginTop: 20,
        marginHorizontal: 10,
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#888',
        fontSize: 16,
    },
    scrollView: {
        flex: 1,
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 12,
        letterSpacing: 1,
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#2a2a2a',
        padding: 16,
        borderRadius: 12,
    },
    toggleLabelContainer: {
        flex: 1,
        marginRight: 16,
    },
    toggleLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    toggleDescription: {
        color: '#888',
        fontSize: 12,
        marginTop: 4,
    },
    settingRow: {
        backgroundColor: '#2a2a2a',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
    },
    settingLabel: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    modeSelector: {
        flexDirection: 'row',
        backgroundColor: '#1a1a1a',
        borderRadius: 8,
        padding: 4,
    },
    modeButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 6,
    },
    modeButtonActive: {
        backgroundColor: '#007AFF',
    },
    modeButtonText: {
        color: '#888',
        fontSize: 13,
        fontWeight: '600',
    },
    modeButtonTextActive: {
        color: '#fff',
    },
    valueInfo: {
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#3a3a3a',
    },
    valueLabel: {
        color: '#888',
        fontSize: 13,
    },
    footer: {
        flexDirection: 'row',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#333',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        backgroundColor: '#333',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    saveButton: {
        flex: 1,
        backgroundColor: '#007AFF',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default SettingsModal;
