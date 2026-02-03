import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  PermissionsAndroid,
  Platform,
  BackHandler,
} from 'react-native';
import { initStorage, createNewSessionFolder, renameFolder, BASE_DIR, requestStoragePermission, saveLastFolder, getLastFolder } from './src/utils/StorageUtils';
import RNFS from 'react-native-fs';
import CameraView from './src/components/CameraView';
import FolderSelector from './src/components/FolderSelector';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppSettings, loadSettings, getLastUsedState } from './src/utils/SettingsStorage';
import Orientation from 'react-native-orientation-locker';

const App = () => {
  const [currentFolder, setCurrentFolder] = useState<{ name: string; path: string } | null>(null);
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shutterPositions, setShutterPositions] = useState<{
    portrait: { x: number; y: number };
    landscape: { x: number; y: number };
  }>({
    portrait: { x: 0, y: 0 },
    landscape: { x: 0, y: 0 }
  });

  // Initial values for CameraView
  const [initialLabelingMode, setInitialLabelingMode] = useState<'single' | 'numbered-group' | 'text-group'>('single');
  const [initialCaptureMode, setInitialCaptureMode] = useState<'photo' | 'video'>('photo');
  const [initialFlashMode, setInitialFlashMode] = useState<'off' | 'on' | 'auto' | 'always'>('off');
  const [initialCameraPosition, setInitialCameraPosition] = useState<'front' | 'back'>('back');

  useEffect(() => {
    const setup = async () => {
      await requestStoragePermission();
      await initStorage();

      // Load settings
      const settings = await loadSettings();
      setAppSettings(settings);

      // Apply orientation lock setting
      if (settings.ignoreOrientationLock) {
        // Ignore system lock: always allow rotation based on device orientation
        Orientation.unlockAllOrientations();
      }
      // When ignoreOrientationLock is false, we don't call any orientation API
      // This allows the system rotation lock to take effect naturally

      // Determine initial folder based on settings
      let folder: { name: string; path: string } | null = null;

      switch (settings.folderMode) {
        case 'fixed':
          if (settings.fixedFolder) {
            // Verify the folder still exists
            const exists = await RNFS.exists(settings.fixedFolder.path);
            if (exists) {
              folder = settings.fixedFolder;
            }
          }
          break;
        case 'lastUsed':
          folder = await getLastFolder();
          break;
        case 'default':
        default:
          // Use root folder
          break;
      }

      // Fall back to root folder if no valid folder found
      if (!folder) {
        folder = { name: 'WorkPhotos', path: BASE_DIR };
      }

      setCurrentFolder(folder);

      // Load shutter positions based on settings
      if (settings.shutterPositionMode === 'fixed' && settings.fixedShutterPositions) {
        setShutterPositions(settings.fixedShutterPositions);
      } else if (settings.shutterPositionMode === 'lastUsed') {
        const lastPositions = await getLastUsedState<typeof shutterPositions>('shutterPositions');
        if (lastPositions) {
          setShutterPositions(lastPositions);
        }
      }
      // default: use centered (0, 0)

      // Load labeling mode based on settings
      if (settings.labelingModeMode === 'fixed' && settings.fixedLabelingMode) {
        setInitialLabelingMode(settings.fixedLabelingMode);
      } else if (settings.labelingModeMode === 'lastUsed') {
        const lastLabelingMode = await getLastUsedState<'single' | 'numbered-group' | 'text-group'>('labelingMode');
        if (lastLabelingMode) {
          setInitialLabelingMode(lastLabelingMode);
        }
      }
      // default: 'single'

      // Load capture mode based on settings
      if (settings.captureMode === 'fixed' && settings.fixedCaptureMode) {
        setInitialCaptureMode(settings.fixedCaptureMode);
      } else if (settings.captureMode === 'lastUsed') {
        const lastCaptureMode = await getLastUsedState<'photo' | 'video'>('captureMode');
        if (lastCaptureMode) {
          setInitialCaptureMode(lastCaptureMode);
        }
      }
      // default: 'photo'

      // Load flash mode based on settings
      if (settings.flashModeMode === 'fixed' && settings.fixedFlashMode) {
        setInitialFlashMode(settings.fixedFlashMode);
      } else if (settings.flashModeMode === 'lastUsed') {
        const lastFlashMode = await getLastUsedState<'off' | 'on' | 'auto' | 'always'>('flashMode');
        if (lastFlashMode) {
          setInitialFlashMode(lastFlashMode);
        }
      }
      // default: 'off' (manifest says 'auto' but current code defaults to 'off')

      // Load camera position based on settings
      if (settings.cameraModeMode === 'fixed' && settings.fixedCameraPosition) {
        setInitialCameraPosition(settings.fixedCameraPosition);
      } else if (settings.cameraModeMode === 'lastUsed') {
        const lastCameraPosition = await getLastUsedState<'front' | 'back'>('cameraPosition');
        if (lastCameraPosition) {
          setInitialCameraPosition(lastCameraPosition);
        }
      }
      // default: 'back'

      setIsLoading(false);
    };
    setup();
  }, []);

  const handleFolderSelect = (folder: { name: string; path: string }) => {
    setCurrentFolder(folder);
    saveLastFolder(folder);
    setShowFolderSelector(false);
  };

  const handleFolderRename = async (newName: string) => {
    if (!currentFolder) return;
    try {
      const updatedFolder = await renameFolder(currentFolder.name, newName);
      setCurrentFolder(updatedFolder);
      saveLastFolder(updatedFolder);
    } catch (e) {
      console.error('Failed to rename folder:', e);
      Alert.alert('Error', 'Failed to rename folder');
    }
  };

  const handleBack = async () => {
    if (currentFolder) {
      const exists = await RNFS.exists(currentFolder.path);
      if (!exists) {
        // Folder was deleted, reset to root
        const rootFolder = { name: 'WorkPhotos', path: BASE_DIR };
        setCurrentFolder(rootFolder);
        saveLastFolder(rootFolder);
      }
    }
    setShowFolderSelector(false);
  };

  // Handle hardware back button for folder selector
  useEffect(() => {
    const onBackPress = () => {
      if (showFolderSelector) {
        handleBack();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [showFolderSelector, currentFolder]);

  const handleSettingsChange = (settings: AppSettings) => {
    setAppSettings(settings);
    // Apply orientation lock setting immediately
    if (settings.ignoreOrientationLock) {
      // Ignore system lock: always allow rotation
      Orientation.unlockAllOrientations();
    } else {
      // Respect system lock: reset to default orientation behavior
      // Lock briefly to reset state, then let system take over
      Orientation.lockToPortrait();
    }
  };

  if (isLoading || !currentFolder) {
    return (
      <View style={styles.loading}>
        <Text style={styles.text}>Initializing Storage...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.container}>
          <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
          {showFolderSelector ? (
            <FolderSelector
              onSelect={handleFolderSelect}
              onBack={handleBack}
              currentFolderName={currentFolder.name}
            />
          ) : (
            <CameraView
              currentFolder={currentFolder}
              onOpenFolders={() => setShowFolderSelector(true)}
              onRenameFolder={handleFolderRename}
              shutterPositions={shutterPositions}
              onShutterPositionChange={(pos, mode) => {
                setShutterPositions(prev => ({
                  ...prev,
                  [mode]: pos
                }));
              }}
              onSettingsChange={handleSettingsChange}
              initialLabelingMode={initialLabelingMode}
              initialCaptureMode={initialCaptureMode}
              initialFlashMode={initialFlashMode}
              initialCameraPosition={initialCameraPosition}
            />
          )}
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  text: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default App;
