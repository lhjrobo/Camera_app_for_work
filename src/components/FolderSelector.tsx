import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listFolders, renameFolder, deleteFolder, createNewSessionFolder, BASE_DIR } from '../utils/StorageUtils';

interface Folder {
    name: string;
    path: string;
}

interface Props {
    onSelect: (folder: Folder) => void;
    onBack: () => void;
    currentFolderName: string;
}

const FolderSelector: React.FC<Props> = ({ onSelect, onBack, currentFolderName }) => {
    const insets = useSafeAreaInsets();
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadFolders();
    }, []);

    const loadFolders = async () => {
        const list = await listFolders();
        const folderList = list.map(f => ({ name: f.name, path: f.path }));

        // Add root folder at the top
        setFolders([
            { name: 'WorkPhotos (Root)', path: BASE_DIR },
            ...folderList
        ]);
    };

    const handleCreate = async () => {
        const newFolder = await createNewSessionFolder();
        onSelect(newFolder);
    };

    const handleRename = (folder: Folder) => {
        // In a real app, use a custom modal for cross-platform prompt
        Alert.alert('Rename Folder', 'Enter new name (Simulated prompt)', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Rename',
                onPress: () => {
                    // Simulation of rename
                    console.log('Rename to new name');
                },
            },
        ]);
    };

    const handleDelete = (folder: Folder) => {
        Alert.alert('Delete Folder', `Are you sure you want to delete ${folder.name}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await deleteFolder(folder.name);
                    loadFolders();
                },
            },
        ]);
    };

    // Enter selection mode on long press
    const handleLongPress = (folder: Folder) => {
        if (folder.path === BASE_DIR) return; // Protect root folder
        if (!selectionMode) {
            setSelectionMode(true);
            setSelectedFolders(new Set([folder.path]));
        }
    };

    // Toggle folder selection in selection mode, or select folder normally
    const handlePress = (folder: Folder) => {
        if (selectionMode) {
            if (folder.path === BASE_DIR) return; // Cannot select root in selection mode
            setSelectedFolders(prev => {
                const newSet = new Set(prev);
                if (newSet.has(folder.path)) {
                    newSet.delete(folder.path);
                } else {
                    newSet.add(folder.path);
                }
                return newSet;
            });
        } else {
            onSelect(folder);
        }
    };

    // Exit selection mode
    const cancelSelection = () => {
        setSelectionMode(false);
        setSelectedFolders(new Set());
    };

    // Delete all selected folders
    const handleBulkDelete = () => {
        const count = selectedFolders.size;
        if (count === 0) return;

        Alert.alert(
            'Delete Folders',
            `Are you sure you want to delete ${count} folder${count > 1 ? 's' : ''}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        // Delete each selected folder
                        for (const path of selectedFolders) {
                            if (path === BASE_DIR) continue; // Safety check
                            const folder = folders.find(f => f.path === path);
                            if (folder) {
                                await deleteFolder(folder.name);
                            }
                        }
                        setSelectionMode(false);
                        setSelectedFolders(new Set());
                        loadFolders();
                    },
                },
            ]
        );
    };

    // Select all folders
    const selectAll = () => {
        setSelectedFolders(new Set(folders.map(f => f.path)));
    };

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: Math.max(16, insets.top) }]}>
                {selectionMode ? (
                    <>
                        <TouchableOpacity onPress={cancelSelection}>
                            <Text style={styles.headerButton}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{selectedFolders.size} Selected</Text>
                        <View style={styles.headerActions}>
                            <TouchableOpacity onPress={selectAll} style={styles.headerActionButton}>
                                <Text style={styles.headerButton}>All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleBulkDelete}>
                                <Text style={[styles.headerButton, styles.deleteButton]}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <>
                        <TouchableOpacity onPress={onBack}>
                            <Text style={styles.headerButton}>Back</Text>
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>Folders</Text>
                        <TouchableOpacity onPress={handleCreate}>
                            <Text style={styles.headerButton}>New</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
            <FlatList
                data={folders}
                keyExtractor={(item) => item.path}
                contentContainerStyle={{ paddingBottom: Math.max(20, insets.bottom) }}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[
                            styles.item,
                            item.name === currentFolderName && styles.activeItem,
                            selectionMode && selectedFolders.has(item.path) && styles.selectedItem
                        ]}
                        onPress={() => handlePress(item)}
                        onLongPress={() => handleLongPress(item)}
                    >
                        <View style={styles.itemContent}>
                            {selectionMode && (
                                <View style={[
                                    styles.checkbox,
                                    selectedFolders.has(item.path) && styles.checkboxSelected
                                ]}>
                                    {selectedFolders.has(item.path) && (
                                        <Text style={styles.checkmark}>✓</Text>
                                    )}
                                </View>
                            )}
                            <Text style={[styles.itemName, selectionMode && styles.itemNameWithCheckbox]}>
                                {item.name}
                            </Text>
                            {!selectionMode && item.path !== BASE_DIR && (
                                <TouchableOpacity onPress={() => handleDelete(item)}>
                                    <Text style={styles.deleteText}>Delete</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </TouchableOpacity>
                )}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    headerButton: {
        color: '#007AFF',
        fontSize: 16,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerActionButton: {
        marginRight: 16,
    },
    deleteButton: {
        color: '#FF3B30',
    },
    item: {
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    activeItem: {
        backgroundColor: '#1A1A1A',
        borderLeftWidth: 4,
        borderLeftColor: '#007AFF',
    },
    selectedItem: {
        backgroundColor: 'rgba(0, 122, 255, 0.2)',
    },
    itemContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemName: {
        color: '#fff',
        fontSize: 16,
        flex: 1,
    },
    itemNameWithCheckbox: {
        marginLeft: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#555',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxSelected: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    checkmark: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    deleteText: {
        color: '#FF3B30',
        fontSize: 14,
    },
});

export default FolderSelector;
