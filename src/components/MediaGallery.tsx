import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    Text,
    Modal,
    Dimensions,
    Alert,
    SafeAreaView,
} from 'react-native';
import Video from 'react-native-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listPhotos, deleteFile, parseFilename } from '../utils/StorageUtils';
import type { ReadDirItem } from 'react-native-fs';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const ITEM_SIZE = width / COLUMN_COUNT;

interface Props {
    folderPath: string;
    onClose: () => void;
    onRetake: (target: { sequence?: number; subSequence?: number; textLabel?: string }) => void;
}

const MediaGallery: React.FC<Props> = ({ folderPath, onClose, onRetake }) => {
    const insets = useSafeAreaInsets();
    const [photos, setPhotos] = useState<ReadDirItem[]>([]);
    const [selectedPhoto, setSelectedPhoto] = useState<ReadDirItem | null>(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const videoRef = useRef<any>(null);

    const isVideo = (item: ReadDirItem | null) => {
        return item?.name.toLowerCase().endsWith('.mp4');
    };

    const loadPhotos = async () => {
        const list = await listPhotos(folderPath);
        setPhotos(list);
    };

    useEffect(() => {
        loadPhotos();
    }, [folderPath]);

    const handleRetake = () => {
        if (selectedPhoto) {
            const result = parseFilename(selectedPhoto.name);
            onRetake(result);
            setSelectedPhoto(null);
            onClose();
        }
    };

    const handleDelete = async (photo: ReadDirItem) => {
        Alert.alert(
            isVideo(photo) ? 'Delete Video' : 'Delete Photo',
            `Are you sure you want to delete this ${isVideo(photo) ? 'video' : 'photo'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const success = await deleteFile(photo.path);
                        if (success) {
                            if (selectedPhoto?.path === photo.path) {
                                setSelectedPhoto(null);
                            }
                            loadPhotos();
                        }
                    },
                },
            ]
        );
    };

    // Enter selection mode on long press
    const handleLongPress = (item: ReadDirItem) => {
        if (!selectionMode) {
            setSelectionMode(true);
            setSelectedItems(new Set([item.path]));
        }
    };

    // Toggle item selection in selection mode, or open viewer normally
    const handlePress = (item: ReadDirItem) => {
        if (selectionMode) {
            setSelectedItems(prev => {
                const newSet = new Set(prev);
                if (newSet.has(item.path)) {
                    newSet.delete(item.path);
                } else {
                    newSet.add(item.path);
                }
                return newSet;
            });
        } else {
            setSelectedPhoto(item);
        }
    };

    // Exit selection mode
    const cancelSelection = () => {
        setSelectionMode(false);
        setSelectedItems(new Set());
    };

    // Delete all selected items
    const handleBulkDelete = () => {
        const count = selectedItems.size;
        if (count === 0) return;

        Alert.alert(
            'Delete Items',
            `Are you sure you want to delete ${count} item${count > 1 ? 's' : ''}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        for (const path of selectedItems) {
                            await deleteFile(path);
                        }
                        setSelectionMode(false);
                        setSelectedItems(new Set());
                        loadPhotos();
                    },
                },
            ]
        );
    };

    // Select all items
    const selectAll = () => {
        setSelectedItems(new Set(photos.map(p => p.path)));
    };

    const renderItem = ({ item }: { item: ReadDirItem }) => (
        <TouchableOpacity
            style={[
                styles.itemContainer,
                selectionMode && selectedItems.has(item.path) && styles.selectedItemContainer
            ]}
            onPress={() => handlePress(item)}
            onLongPress={() => handleLongPress(item)}
        >
            {isVideo(item) ? (
                <View style={styles.videoThumbnail}>
                    <Text style={styles.playIcon}>▶</Text>
                </View>
            ) : (
                <Image source={{ uri: `file://${item.path}` }} style={styles.thumbnail} />
            )}
            <View style={styles.filenameOverlay}>
                <Text style={styles.filenameText} numberOfLines={1}>{item.name}</Text>
            </View>
            {isVideo(item) && (
                <View style={styles.videoIndicator}>
                    <Text style={styles.videoIndicatorText}>VIDEO</Text>
                </View>
            )}
            {selectionMode && (
                <View style={[
                    styles.checkbox,
                    selectedItems.has(item.path) && styles.checkboxSelected
                ]}>
                    {selectedItems.has(item.path) && (
                        <Text style={styles.checkmark}>✓</Text>
                    )}
                </View>
            )}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={[styles.header, { paddingTop: Math.max(10, insets.top) }]}>
                <View style={styles.headerContent}>
                    {selectionMode ? (
                        <>
                            <TouchableOpacity onPress={cancelSelection} style={styles.backButton}>
                                <Text style={styles.backButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <View style={styles.titleContainer} pointerEvents="none">
                                <Text style={styles.title}>{selectedItems.size} Selected</Text>
                            </View>
                            <View style={styles.headerActions}>
                                <TouchableOpacity onPress={selectAll} style={styles.headerActionButton}>
                                    <Text style={styles.headerButtonText}>All</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleBulkDelete}>
                                    <Text style={[styles.headerButtonText, styles.deleteButtonText]}>Delete</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity onPress={onClose} style={styles.backButton}>
                                <Text style={styles.backButtonText}>← Back</Text>
                            </TouchableOpacity>
                            <View style={styles.titleContainer} pointerEvents="none">
                                <Text style={styles.title}>Gallery</Text>
                            </View>
                            <View style={styles.headerRight} />
                        </>
                    )}
                </View>
            </View>

            <FlatList
                data={photos}
                renderItem={renderItem}
                keyExtractor={(item) => item.path}
                numColumns={COLUMN_COUNT}
                contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(20, insets.bottom) }]}
            />

            {photos.length === 0 && (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No media in this folder yet.</Text>
                </View>
            )}

            <Modal
                visible={!!selectedPhoto}
                transparent={false}
                animationType="fade"
                onRequestClose={() => setSelectedPhoto(null)}
            >
                <View style={styles.viewerContainer}>
                    <View style={[styles.viewerHeader, { paddingTop: Math.max(10, insets.top) }]}>
                        <TouchableOpacity
                            onPress={() => setSelectedPhoto(null)}
                            style={styles.viewerButton}
                        >
                            <Text style={styles.viewerButtonText}>Close</Text>
                        </TouchableOpacity>

                        <View style={styles.viewerTitleContainer}>
                            <Text style={styles.viewerTitle} numberOfLines={1}>
                                {selectedPhoto?.name}
                            </Text>
                        </View>

                        {!isVideo(selectedPhoto) && (
                            <TouchableOpacity
                                onPress={handleRetake}
                                style={[styles.viewerButton, styles.retakeButton]}
                            >
                                <Text style={styles.viewerButtonText}>Retake</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            onPress={() => selectedPhoto && handleDelete(selectedPhoto)}
                            style={[styles.viewerButton, styles.deleteButton]}
                        >
                            <Text style={styles.viewerButtonText}>Delete</Text>
                        </TouchableOpacity>
                    </View>

                    {selectedPhoto && (
                        isVideo(selectedPhoto) ? (
                            <Video
                                ref={videoRef}
                                source={{ uri: `file://${selectedPhoto.path}` }}
                                style={styles.fullVideo}
                                controls={true}
                                resizeMode="contain"
                                repeat={false}
                            />
                        ) : (
                            <Image
                                source={{ uri: `file://${selectedPhoto.path}` }}
                                style={styles.fullImage}
                                resizeMode="contain"
                            />
                        )
                    )}
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        borderBottomWidth: 1,
        borderBottomColor: '#333',
        paddingHorizontal: 15,
        backgroundColor: '#000',
    },
    headerContent: {
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    titleContainer: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerRight: {
        width: 60,
    },
    backButton: {
        paddingVertical: 10,
        minWidth: 60,
    },
    backButtonText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '600',
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    listContent: {
        paddingBottom: 20,
    },
    itemContainer: {
        width: ITEM_SIZE,
        height: ITEM_SIZE,
        padding: 1,
    },
    thumbnail: {
        flex: 1,
        backgroundColor: '#222',
    },
    filenameOverlay: {
        position: 'absolute',
        bottom: 1,
        left: 1,
        right: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        padding: 2,
    },
    filenameText: {
        color: '#fff',
        fontSize: 10,
        textAlign: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
    },
    viewerContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    viewerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 15,
        paddingVertical: 10,
        zIndex: 10,
    },
    viewerTitleContainer: {
        flex: 1,
        marginHorizontal: 10,
        alignItems: 'center',
    },
    viewerTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    viewerButton: {
        padding: 10,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 8,
    },
    viewerButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    retakeButton: {
        backgroundColor: 'rgba(255, 215, 0, 0.4)',
        marginRight: 10,
    },
    deleteButton: {
        backgroundColor: 'rgba(255, 59, 48, 0.8)',
    },
    fullImage: {
        flex: 1,
        width: '100%',
    },
    fullVideo: {
        flex: 1,
        width: '100%',
    },
    videoThumbnail: {
        flex: 1,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playIcon: {
        color: '#fff',
        fontSize: 32,
    },
    videoIndicator: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(255, 59, 48, 0.9)',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 3,
    },
    videoIndicatorText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: 'bold',
    },
    selectedItemContainer: {
        borderWidth: 2,
        borderColor: '#007AFF',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerActionButton: {
        marginRight: 16,
    },
    headerButtonText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '600',
    },
    deleteButtonText: {
        color: '#FF3B30',
    },
    checkbox: {
        position: 'absolute',
        top: 6,
        left: 6,
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.8)',
        backgroundColor: 'rgba(0,0,0,0.3)',
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
});

export default MediaGallery;
