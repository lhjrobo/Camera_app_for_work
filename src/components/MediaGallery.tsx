import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
    View,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Text,
    Modal,
    Dimensions,
    Alert,
    SafeAreaView,
    useWindowDimensions,
    BackHandler,
    StatusBar,
} from 'react-native';
import Video from 'react-native-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listPhotos, deleteFile, parseFilename, getFolderBaseName } from '../utils/StorageUtils';
import type { ReadDirItem } from 'react-native-fs';
import { Gesture, GestureDetector, GestureHandlerRootView, Directions } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import FolderSelector from './FolderSelector';

const COLUMN_COUNT_PORTRAIT = 3;
const COLUMN_COUNT_LANDSCAPE = 6;

interface Props {
    folderPath: string;
    onClose: () => void;
    onRetake: (target: { sequence?: number; subSequence?: number; textLabel?: string }) => void;
}

const ZoomableImage = ({ uri, onZoomChange, onToggleUI }: { uri: string; onZoomChange: (isZoomed: boolean) => void; onToggleUI: () => void }) => {
    const scale = useSharedValue(1);
    const savedScale = useSharedValue(1);
    const translateX = useSharedValue(0);
    const savedTranslateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const savedTranslateY = useSharedValue(0);
    const isZoomedShared = useSharedValue(false);

    const { width } = useWindowDimensions();
    const [isZoomed, setIsZoomed] = useState(false);

    const handleZoomChange = (zoomed: boolean) => {
        setIsZoomed(zoomed);
        onZoomChange(zoomed);
    };

    const pinch = Gesture.Pinch()
        .onUpdate((e) => {
            scale.value = savedScale.value * e.scale;
            if (scale.value > 1.1 && !isZoomedShared.value) {
                isZoomedShared.value = true;
                runOnJS(handleZoomChange)(true);
            }
        })
        .onEnd(() => {
            if (scale.value < 1) {
                scale.value = withTiming(1);
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                isZoomedShared.value = false;
                runOnJS(handleZoomChange)(false);
            } else if (scale.value <= 1.05) {
                // Almost 1, reset to be safe
                scale.value = withTiming(1);
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                isZoomedShared.value = false;
                runOnJS(handleZoomChange)(false);
            }
            savedScale.value = scale.value;
        });

    const pan = Gesture.Pan()
        .averageTouches(true)
        .onUpdate((e) => {
            if (scale.value > 1) {
                translateX.value = savedTranslateX.value + e.translationX;
                translateY.value = savedTranslateY.value + e.translationY;
            }
        })
        .onEnd((e) => {
            savedTranslateX.value = translateX.value;
            savedTranslateY.value = translateY.value;
        });



    const doubleTap = Gesture.Tap()
        .numberOfTaps(2)
        .onEnd(() => {
            if (scale.value > 1.5) {
                scale.value = withTiming(1);
                translateX.value = withTiming(0);
                translateY.value = withTiming(0);
                savedScale.value = 1;
                savedTranslateX.value = 0;
                savedTranslateY.value = 0;
                isZoomedShared.value = false;
                runOnJS(handleZoomChange)(false);
            } else {
                scale.value = withTiming(2);
                savedScale.value = 2;
                isZoomedShared.value = true;
                runOnJS(handleZoomChange)(true);
            }
        });

    const singleTap = Gesture.Tap()
        .numberOfTaps(1)
        .onEnd(() => {
            runOnJS(onToggleUI)();
        });

    const taps = Gesture.Exclusive(doubleTap, singleTap);

    const composed = isZoomed
        ? Gesture.Race(taps, Gesture.Simultaneous(pinch, pan))
        : Gesture.Race(taps, pinch);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { scale: scale.value }
        ]
    }));

    return (
        <GestureDetector gesture={composed}>
            <Animated.Image
                source={{ uri }}
                style={[
                    { width: width, height: '100%' },
                    animatedStyle,
                ]}
                resizeMode="contain"
            />
        </GestureDetector>
    );
};



const GalleryVideo = ({ uri, isFocused, onToggleUI }: { uri: string; isFocused: boolean; onToggleUI: () => void }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const { width } = useWindowDimensions();

    useEffect(() => {
        if (!isFocused) {
            setIsPlaying(false);
        }
    }, [isFocused]);

    return (
        <TouchableWithoutFeedback onPress={onToggleUI}>
            <View style={{ width, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                <Video
                    source={{ uri }}
                    style={{ width, height: '100%' }}
                    controls={isPlaying}
                    resizeMode="contain"
                    paused={!isPlaying}
                    onEnd={() => setIsPlaying(false)}
                    repeat={false}
                />
                {!isPlaying && (
                    <TouchableOpacity
                        style={styles.playOverlayButton}
                        onPress={() => setIsPlaying(true)}
                    >
                        <View style={styles.playOverlayCircle}>
                            <Text style={styles.playOverlayIcon}>▶</Text>
                        </View>
                    </TouchableOpacity>
                )}
            </View>
        </TouchableWithoutFeedback>
    );
};

const MediaGallery: React.FC<Props> = ({ folderPath, onClose, onRetake }) => {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const isLandscape = windowWidth > windowHeight;
    const numColumns = isLandscape ? COLUMN_COUNT_LANDSCAPE : COLUMN_COUNT_PORTRAIT;
    const itemSize = windowWidth / numColumns;
    const insets = useSafeAreaInsets();
    const [photos, setPhotos] = useState<ReadDirItem[]>([]);
    // numColumns state removed (derived above)
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [selectedPhoto, setSelectedPhoto] = useState<ReadDirItem | null>(null);
    const [showFolderSelector, setShowFolderSelector] = useState(false);
    const [currentBrowsingPath, setCurrentBrowsingPath] = useState(folderPath); // Track which folder we are viewing

    // Smooth Swipe State
    const [scrollEnabled, setScrollEnabled] = useState(true);
    const flatListRef = useRef<FlatList>(null);
    const videoRef = useRef<any>(null);
    const [isUIVisible, setIsUIVisible] = useState(false);

    // Track state in ref for BackHandler
    const stateRef = useRef({
        showFolderSelector,
        selectedPhoto,
        selectionMode,
        onClose
    });

    useEffect(() => {
        stateRef.current = {
            showFolderSelector,
            selectedPhoto,
            selectionMode,
            onClose
        };
    }, [showFolderSelector, selectedPhoto, selectionMode, onClose]);

    useEffect(() => {
        const onBackPress = () => {
            const state = stateRef.current;
            if (state.showFolderSelector) {
                setShowFolderSelector(false);
                return true;
            }
            if (state.selectedPhoto) {
                setSelectedPhoto(null);
                return true;
            }
            if (state.selectionMode) {
                setSelectionMode(false);
                setSelectedItems(new Set());
                return true;
            }
            state.onClose();
            return true;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, []); // Run once on mount

    const isVideo = (item: ReadDirItem | null) => {
        return item?.name.toLowerCase().endsWith('.mp4');
    };

    const loadPhotos = async () => {
        const list = await listPhotos(currentBrowsingPath);
        setPhotos(list);
    };

    useEffect(() => {
        loadPhotos();
    }, [currentBrowsingPath]); // Reload when browsing path changes

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

    const handleNext = () => {
        if (!selectedPhoto) return;
        const index = photos.findIndex(p => p.path === selectedPhoto.path);
        if (index >= 0 && index < photos.length - 1) {
            setSelectedPhoto(photos[index + 1]);
        }
    };

    const handlePrevious = () => {
        if (!selectedPhoto) return;
        const index = photos.findIndex(p => p.path === selectedPhoto.path);
        if (index > 0) {
            setSelectedPhoto(photos[index - 1]);
        }
    };

    const renderItem = ({ item }: { item: ReadDirItem }) => (
        <TouchableOpacity
            style={[
                styles.itemContainer,
                { width: itemSize, height: itemSize },
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
                                <Text style={styles.backButtonText}>← Capture</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.titleContainer}
                                onPress={() => setShowFolderSelector(true)}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.title}>
                                        {currentBrowsingPath === folderPath
                                            ? 'Gallery'
                                            : getFolderBaseName(currentBrowsingPath)}
                                    </Text>
                                    <Text style={[styles.title, { marginLeft: 6, fontSize: 12 }]}>▼</Text>
                                </View>
                            </TouchableOpacity>
                            <View style={styles.headerRight} />
                        </>
                    )}
                </View>
            </View>



            <FlatList
                data={photos}
                renderItem={renderItem}
                keyExtractor={(item) => item.path}
                numColumns={numColumns}
                key={numColumns} // Force re-render when column count changes
                contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(20, insets.bottom) }]}
            />

            {photos.length === 0 && (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No media in this folder yet.</Text>
                </View>
            )}

            {showFolderSelector && (
                <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]}>
                    <FolderSelector
                        currentFolderName={getFolderBaseName(currentBrowsingPath)}
                        onSelect={(folder) => {
                            setCurrentBrowsingPath(folder.path);
                            setShowFolderSelector(false);
                            // Note: we do NOT update the parent's currentFolder (onFolderChange)
                            // This ensures new captures still go to the original folder.
                        }}
                        onBack={() => setShowFolderSelector(false)}
                    />
                </View>
            )}

            <Modal
                visible={!!selectedPhoto}
                transparent={false}
                statusBarTranslucent={true}
                animationType="fade"
                onRequestClose={() => {
                    setSelectedPhoto(null);
                    setIsUIVisible(false); // Reset visibility
                }}
            >
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <View style={styles.viewerContainer}>
                        <StatusBar hidden={!isUIVisible} translucent backgroundColor="transparent" barStyle="light-content" />
                        {selectedPhoto && (
                            <FlatList
                                key={windowWidth} // Force remount on rotation to fix centering
                                ref={flatListRef}
                                data={photos}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                scrollEnabled={scrollEnabled}
                                initialScrollIndex={photos.findIndex(p => p.path === selectedPhoto.path)}
                                getItemLayout={(data, index) => ({
                                    length: windowWidth,
                                    offset: windowWidth * index,
                                    index,
                                })}
                                keyExtractor={(item) => item.path}
                                renderItem={({ item }) => (
                                    <View style={{ width: windowWidth, height: '100%', justifyContent: 'center', alignItems: 'center' }}>
                                        {isVideo(item) ? (
                                            <GalleryVideo
                                                uri={`file://${item.path}`}
                                                isFocused={selectedPhoto.path === item.path}
                                                onToggleUI={() => setIsUIVisible(v => !v)}
                                            />
                                        ) : (
                                            <ZoomableImage
                                                uri={`file://${item.path}`}
                                                onZoomChange={(isZoomed) => setScrollEnabled(!isZoomed)}
                                                onToggleUI={() => setIsUIVisible(v => !v)}
                                            />
                                        )}
                                    </View>
                                )}
                                onMomentumScrollEnd={(event) => {
                                    const offsetX = event.nativeEvent.contentOffset.x;
                                    const index = Math.round(offsetX / windowWidth);
                                    if (photos[index]) {
                                        setSelectedPhoto(photos[index]);
                                    }
                                }}
                                // Ensure layout is calculated before initial scroll
                                onScrollToIndexFailed={(info) => {
                                    const wait = new Promise<void>(resolve => setTimeout(resolve, 500));
                                    wait.then(() => {
                                        flatListRef.current?.scrollToIndex({ index: info.index, animated: false });
                                    });
                                }}
                            />
                        )}

                        {isUIVisible && (
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
                        )}
                    </View>

                </GestureHandlerRootView>
            </Modal>
        </View >
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
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
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
    playOverlayButton: {
        position: 'absolute',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
    playOverlayCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playOverlayIcon: {
        color: '#fff',
        fontSize: 40,
        marginLeft: 5, // Optically center the triangle
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
