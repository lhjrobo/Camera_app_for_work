import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { initStorage, createNewSessionFolder, renameFolder, BASE_DIR } from './src/utils/StorageUtils';
import CameraView from './src/components/CameraView';
import FolderSelector from './src/components/FolderSelector';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const App = () => {
  const [currentFolder, setCurrentFolder] = useState<{ name: string; path: string } | null>(null);
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [shutterPositions, setShutterPositions] = useState<{
    portrait: { x: number; y: number };
    landscape: { x: number; y: number };
  }>({
    portrait: { x: 0, y: 0 },
    landscape: { x: 0, y: 0 }
  });

  useEffect(() => {
    const setup = async () => {
      await initStorage();
      // Initially, store directly in WorkPhotos root
      setCurrentFolder({ name: 'WorkPhotos', path: BASE_DIR });
    };
    setup();
  }, []);

  const handleFolderSelect = (folder: { name: string; path: string }) => {
    setCurrentFolder(folder);
    setShowFolderSelector(false);
  };

  const handleFolderRename = async (newName: string) => {
    if (!currentFolder) return;
    try {
      const updatedFolder = await renameFolder(currentFolder.name, newName);
      setCurrentFolder(updatedFolder);
    } catch (e) {
      console.error('Failed to rename folder:', e);
      Alert.alert('Error', 'Failed to rename folder');
    }
  };

  if (!currentFolder) {
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
              onBack={() => setShowFolderSelector(false)}
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
