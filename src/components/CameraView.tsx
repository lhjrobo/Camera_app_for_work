import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Text,
    useWindowDimensions,
    TouchableWithoutFeedback,
    Animated,
    ScrollView,
    Modal,
    Image,
    SafeAreaView,
    StatusBar,
    TextInput,
    Alert,
    NativeModules,
} from 'react-native';
import { Camera, useCameraDevice, useCameraDevices, useCodeScanner } from 'react-native-vision-camera';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Reanimated, { useSharedValue, useAnimatedProps, runOnJS } from 'react-native-reanimated';
import KeyEvent from 'react-native-keyevent';
import { VolumeManager } from 'react-native-volume-manager';
import { formatFilename, saveFile, listPhotos, archiveExistingFile, parseFilename, getFolderBaseName, fileExists, BASE_DIR, formatTimestampFilename, scanMediaFile, findHighestSequence, getUniqueFilename } from '../utils/StorageUtils';
import MediaGallery from './MediaGallery';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ReanimatedCamera = Reanimated.createAnimatedComponent(Camera);

interface Props {
    currentFolder: { name: string; path: string };
    onOpenFolders: () => void;
    onRenameFolder: (newName: string) => Promise<void>;
}

const { ShutterModule } = NativeModules;

const CameraView: React.FC<Props> = ({ currentFolder, onOpenFolders, onRenameFolder }) => {
    const isRoot = currentFolder.path === BASE_DIR;
    const insets = useSafeAreaInsets();
    const camera = useRef<Camera>(null);
    const [cameraPosition, setCameraPosition] = useState<'back' | 'front'>('back');
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
    const [showDeviceList, setShowDeviceList] = useState(false);

    const devices = useCameraDevices();
    const defaultDevice = useCameraDevice(cameraPosition);
    const device = selectedDeviceId
        ? devices.find(d => d.id === selectedDeviceId)
        : defaultDevice;

    const [isRecording, setIsRecording] = useState(false);
    const [mode, setMode] = useState<'photo' | 'video'>('photo');
    const [labelingMode, setLabelingMode] = useState<'single' | 'numbered-group' | 'text-group'>('single');
    const [textLabel, setTextLabel] = useState('');
    const [isEnteringLabel, setIsEnteringLabel] = useState(false);
    const [sequence, setSequence] = useState(1);
    const [subSequence, setSubSequence] = useState(1);
    const [hasPermission, setHasPermission] = useState(false);
    const [isFlashing, setIsFlashing] = useState(false);
    const [flash, setFlash] = useState<'off' | 'on' | 'auto'>('off');
    const [zoom, setZoom] = useState(1);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
    const [lastPhoto, setLastPhoto] = useState<string | null>(null);
    const [showGallery, setShowGallery] = useState(false);
    const [retakeTarget, setRetakeTarget] = useState<{ sequence?: number; subSequence?: number; textLabel?: string } | null>(null);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [usedLabels, setUsedLabels] = useState<string[]>([]);
    const [isEditingIndex, setIsEditingIndex] = useState(false);
    const [editSequence, setEditSequence] = useState('');
    const [editSubSequence, setEditSubSequence] = useState('');
    const [indexWarning, setIndexWarning] = useState<string | null>(null);
    const focusAnim = useRef(new Animated.Value(0)).current;
    const takePhotoRef = useRef<() => void>(() => { });
    const toggleRecordingRef = useRef<() => void>(() => { });

    const zoomShared = useSharedValue(1);
    const startZoom = useSharedValue(1);

    const pinchGesture = Gesture.Pinch()
        .onStart(() => {
            startZoom.value = zoomShared.value;
        })
        .onUpdate((event) => {
            const newZoom = startZoom.value * event.scale;
            zoomShared.value = Math.max(1, Math.min(newZoom, 10)); // Max zoom 10
            runOnJS(setZoom)(zoomShared.value);
        });


    const animatedProps = useAnimatedProps(() => ({
        zoom: zoomShared.value,
    }));

    const { width, height } = useWindowDimensions();
    const isLandscape = width > height;

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isRecording) {
            setRecordingDuration(0);
            interval = setInterval(() => {
                setRecordingDuration(d => d + 1);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isRecording]);

    const formatDuration = (seconds: number) => {
        const mm = Math.floor(seconds / 60).toString().padStart(2, '0');
        const ss = (seconds % 60).toString().padStart(2, '0');
        return `${mm}:${ss}`;
    };

    useEffect(() => {
        (async () => {
            const cameraPermission = await Camera.requestCameraPermission();
            const microphonePermission = await Camera.requestMicrophonePermission();
            setHasPermission(cameraPermission === 'granted' && microphonePermission === 'granted');

            // Load last photo and used labels from current folder
            const photos = await listPhotos(currentFolder.path);
            if (photos.length > 0) {
                setLastPhoto(photos[0].path);

                // Extract unique text labels
                const labels = new Set<string>();
                photos.forEach(p => {
                    const parsed = parseFilename(p.name);
                    if (parsed.textLabel) labels.add(parsed.textLabel);
                });
                setUsedLabels(Array.from(labels));
            } else {
                setUsedLabels([]);
            }
        })();
    }, [currentFolder.path]);


    const codeScanner = useCodeScanner({
        codeTypes: ['qr', 'ean-13'],
        onCodeScanned: (codes) => {
            if (codes.length > 0 && codes[0].value) {
                // Handle QR discovery
                console.log(`Scanned ${codes.length} codes! Value: ${codes[0].value}`);
            }
        }
    });

    // Auto-detect sequence when folder changes
    useEffect(() => {
        const syncSequence = async () => {
            if (isRoot) return;
            const highest = await findHighestSequence(currentFolder.path);
            if (highest > 0) {
                setSequence(highest + 1);
                setSubSequence(1);
            } else {
                setSequence(1);
                setSubSequence(1);
            }
        };
        syncSequence();
    }, [currentFolder.path, isRoot]);

    const takePhoto = useCallback(async () => {
        if (camera.current) {
            try {
                setIsFlashing(true);
                setTimeout(() => setIsFlashing(false), 100);

                const photo = await camera.current.takePhoto({
                    flash: flash === 'auto' ? 'auto' : flash === 'on' ? 'on' : 'off',
                });

                const targetSeq = retakeTarget?.sequence ?? sequence;
                const targetSub = retakeTarget
                    ? retakeTarget.subSequence
                    : (labelingMode !== 'single' ? subSequence : undefined);
                const targetText = retakeTarget
                    ? retakeTarget.textLabel
                    : (labelingMode === 'text-group' ? textLabel : undefined);

                let filename: string;
                if (isRoot) {
                    filename = formatTimestampFilename('.jpg');
                } else {
                    filename = await getUniqueFilename(currentFolder.path, targetSeq, targetSub, targetText);
                }

                // If retaking, archive the old one first
                if (retakeTarget) {
                    await archiveExistingFile(currentFolder.path, filename);
                }

                const savedPath = await saveFile(photo.path, currentFolder.path, filename);
                await scanMediaFile(savedPath);
                setLastPhoto(savedPath);

                if (retakeTarget) {
                    setRetakeTarget(null);
                } else if (labelingMode !== 'single') {
                    setSubSequence(s => s + 1);
                    if (labelingMode === 'text-group' && !usedLabels.includes(textLabel)) {
                        setUsedLabels(prev => [...prev, textLabel]);
                    }
                } else {
                    setSequence(s => s + 1);
                }
            } catch (e) {
                console.error(e);
            }
        }
    }, [camera, flash, retakeTarget, sequence, labelingMode, subSequence, textLabel, currentFolder, usedLabels]);

    // Keep refs updated with latest callbacks
    useEffect(() => {
        takePhotoRef.current = takePhoto;
    }, [takePhoto]);

    const nextSequence = () => {
        if (labelingMode === 'text-group') {
            setNewFolderName(textLabel); // Reuse newFolderName for the label input or add a specific state
            setIsEnteringLabel(true);
        } else {
            setSequence(s => s + 1);
            setSubSequence(1);
        }
    };

    const renderIcon = (type: 'grouped' | 'flash' | 'switch' | 'lenses', active?: boolean) => {
        const color = (type === 'flash' && active) ? '#FFD700' : '#fff';
        const fontSize = 10;

        switch (type) {
            case 'grouped':
                let labelText = '通常';
                if (labelingMode === 'numbered-group') labelText = 'グループ';
                if (labelingMode === 'text-group') labelText = 'テキスト';
                return (
                    <View style={styles.iconContainer}>
                        <Text style={[styles.hybridIconText, { color, zIndex: 2 }]}>
                            {labelText}
                        </Text>
                    </View>
                );
            case 'flash':
                return (
                    <View style={styles.iconContainer}>
                        <View style={styles.boltArea}>
                            <View style={styles.boltContainer}>
                                <View style={styles.boltInner}>
                                    <View style={[styles.boltPart, { borderBottomColor: color, borderRightColor: 'transparent', borderRightWidth: 4, borderBottomWidth: 8, left: 2, top: 0, transform: [{ rotate: '15deg' }] }]} />
                                    <View style={[styles.boltPart, { borderTopColor: color, borderLeftColor: 'transparent', borderLeftWidth: 4, borderTopWidth: 8, left: -1, top: 5, transform: [{ rotate: '15deg' }] }]} />
                                </View>
                            </View>
                        </View>
                        <View style={styles.textArea}>
                            <Text style={[styles.hybridSubText, { color }]}>
                                {flash.toUpperCase()}
                            </Text>
                        </View>
                    </View>
                );
            case 'switch':
                return (
                    <View style={styles.iconContainer}>
                        <View style={[styles.iconCircle, { borderColor: color, borderTopColor: 'transparent', borderBottomColor: 'transparent' }]}>
                            {/* Left arrow pointing UP */}
                            <View style={[styles.switchArrow, { borderTopColor: color, top: 0, left: 0, transform: [{ rotate: '210deg' }] }]} />
                            {/* Right arrow pointing DOWN */}
                            <View style={[styles.switchArrow, { borderTopColor: color, bottom: 0, right: 0, transform: [{ rotate: '30deg' }] }]} />
                            <Text style={[styles.hybridIconText, { color, fontSize: 10 }]}>
                                {cameraPosition === 'back' ? 'R' : 'F'}
                            </Text>
                        </View>
                    </View>
                );
            case 'lenses':
                return (
                    <View style={styles.iconContainer}>
                        <View style={styles.cameraIconContainer}>
                            <View style={[styles.cameraBody, { borderColor: color }]}>
                                <View style={[styles.cameraLens, { borderColor: color }]} />
                                <View style={[styles.cameraShutter, { backgroundColor: color }]} />
                            </View>
                        </View>
                    </View>
                );
        }
    };

    const renderSettingsGrid = () => (
        <View style={[styles.settingsGrid, !isLandscape && styles.settingsGridVertical]}>
            {lastPhoto && !retakeTarget && (
                <TouchableOpacity
                    onPress={retakeLast}
                    style={[styles.glassButton, styles.gridButton, styles.retakeGridButton, !isLandscape && styles.gridButtonVertical]}
                >
                    <Text style={styles.retakeGridIcon}>↺</Text>
                    <Text style={styles.retakeGridText}>再撮影</Text>
                </TouchableOpacity>
            )}
            {labelingMode !== 'single' && (
                <TouchableOpacity
                    onPress={nextSequence}
                    style={[styles.glassButton, styles.gridButton, styles.nextGroupButton, !isLandscape && styles.gridButtonVertical]}
                >
                    <Text style={styles.nextGroupIcon}>→</Text>
                    <Text style={styles.nextGroupText}>
                        {labelingMode === 'text-group' ? '次ラベル' : sequence + 1}
                    </Text>
                </TouchableOpacity>
            )}

            <TouchableOpacity
                onPress={() => {
                    if (labelingMode === 'single') setLabelingMode('numbered-group');
                    else if (labelingMode === 'numbered-group') {
                        setLabelingMode('text-group');
                        setIsEnteringLabel(true); // Prompt immediately when switching to text group
                    }
                    else setLabelingMode('single');
                }}
                style={[styles.glassButton, styles.gridButton, !isLandscape && styles.gridButtonVertical]}
            >
                {renderIcon('grouped', labelingMode !== 'single')}
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => setFlash(f => (f === 'off' ? 'on' : f === 'on' ? 'auto' : 'off'))}
                style={[styles.glassButton, styles.gridButton, !isLandscape && styles.gridButtonVertical]}
            >
                {renderIcon('flash', flash !== 'off')}
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => setCameraPosition(p => p === 'back' ? 'front' : 'back')}
                style={[styles.glassButton, styles.gridButton, !isLandscape && styles.gridButtonVertical]}
            >
                {renderIcon('switch')}
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => setShowDeviceList(true)}
                style={[styles.glassButton, styles.gridButton, !isLandscape && styles.gridButtonVertical]}
            >
                {renderIcon('lenses')}
            </TouchableOpacity>
        </View>
    );

    const retakeLast = useCallback(() => {
        if (lastPhoto) {
            const pathParts = lastPhoto.split('/');
            const filename = pathParts[pathParts.length - 1];
            const target = parseFilename(filename);
            setRetakeTarget(target);
        }
    }, [lastPhoto]);

    const toggleRecording = useCallback(async () => {
        if (isRecording) {
            await camera.current?.stopRecording();
            setIsRecording(false);
        } else {
            // Capture current values BEFORE starting recording
            // so the callback uses correct sequence numbers
            const captureSeq = sequence;
            const captureSub = labelingMode !== 'single' ? subSequence : undefined;
            const captureText = labelingMode === 'text-group' ? textLabel : undefined;
            const captureFolder = currentFolder.path;

            let filename: string;
            if (isRoot) {
                filename = formatTimestampFilename('.mp4');
            } else {
                filename = await getUniqueFilename(captureFolder, captureSeq, captureSub, captureText);
                // Ensure correct extension for video
                if (!filename.endsWith('.mp4')) {
                    filename = filename.replace('.jpg', '.mp4');
                    // Check collision again for mp4 if we changed extension
                    let counter = 1;
                    const base = filename.replace('.mp4', '');
                    while (await fileExists(captureFolder, filename)) {
                        counter++;
                        filename = `${base}_${counter}.mp4`;
                    }
                }
            }

            setIsRecording(true);
            camera.current?.startRecording({
                onRecordingFinished: async (video) => {
                    try {
                        console.log('Recording finished, saving to:', captureFolder, filename);
                        const savedPath = await saveFile(video.path, captureFolder, filename);
                        await scanMediaFile(savedPath);
                        setLastPhoto(savedPath);
                        console.log('Video saved successfully:', savedPath);

                        // Increment sequence after saving
                        if (labelingMode !== 'single') {
                            setSubSequence(s => s + 1);
                        } else {
                            setSequence(s => s + 1);
                        }
                    } catch (error) {
                        console.error('Failed to save video:', error);
                    }
                },
                onRecordingError: (error) => {
                    console.error('Recording error:', error);
                    setIsRecording(false);
                },
            });
        }
    }, [isRecording, camera, labelingMode, subSequence, textLabel, sequence, currentFolder]);

    // Keep toggleRecordingRef updated with latest callback
    useEffect(() => {
        toggleRecordingRef.current = toggleRecording;
    }, [toggleRecording]);

    useEffect(() => {
        // Volume button keycodes: 24 = Volume Up, 25 = Volume Down
        const VOLUME_UP = 24;
        const VOLUME_DOWN = 25;

        KeyEvent.onKeyDownListener((keyEvent: { keyCode: number }) => {
            console.log('JS: KeyDown hook - Code:', keyEvent.keyCode, 'Gallery:', showGallery);
            if (showGallery) return;

            if (keyEvent.keyCode === VOLUME_UP || keyEvent.keyCode === VOLUME_DOWN) {
                console.log('JS: Shutter match! Mode:', mode);
                if (mode === 'photo') {
                    takePhotoRef.current();
                } else {
                    toggleRecordingRef.current();
                }
            }
        });

        return () => {
            KeyEvent.removeKeyDownListener();
        };
    }, [mode, showGallery]); // Re-subscribe when mode or gallery visibility changes

    // Hide system volume UI only when camera is active (not showing gallery)
    useEffect(() => {
        if (!showGallery) {
            VolumeManager.showNativeVolumeUI({ enabled: false });
            ShutterModule?.setVolumeInterceptionEnabled(true);
        } else {
            VolumeManager.showNativeVolumeUI({ enabled: true });
            ShutterModule?.setVolumeInterceptionEnabled(false);
        }

        return () => {
            VolumeManager.showNativeVolumeUI({ enabled: true });
            ShutterModule?.setVolumeInterceptionEnabled(false);
        };
    }, [showGallery]);

    const handleRenameSave = async () => {
        if (newFolderName.trim() && newFolderName !== currentFolder.name) {
            await onRenameFolder(newFolderName.trim());
        }
        setIsRenaming(false);
    };

    const handleLabelSave = () => {
        const trimmedLabel = newFolderName.trim();
        if (trimmedLabel) {
            if (usedLabels.includes(trimmedLabel)) {
                Alert.alert('Duplicate Label', `The label "${trimmedLabel}" has already been used in this folder. Please use a different name.`);
                return;
            }
            setTextLabel(trimmedLabel);
            setSubSequence(1);
            if (!usedLabels.includes(trimmedLabel)) {
                setUsedLabels(prev => [...prev, trimmedLabel]);
            }
        }
        setIsEnteringLabel(false);
    };

    // Open the index editor modal with current values
    const openIndexEditor = () => {
        if (labelingMode === 'text-group') {
            setEditSequence(textLabel);
        } else {
            setEditSequence(sequence.toString());
        }
        setEditSubSequence(labelingMode !== 'single' ? subSequence.toString() : '');
        setIndexWarning(null);
        setIsEditingIndex(true);
    };



    // Save the manually edited index
    const handleIndexSave = async () => {
        let newSeq = sequence;
        let newTextLabel = textLabel;

        if (labelingMode === 'text-group') {
            newTextLabel = editSequence.trim();
            if (!newTextLabel) {
                Alert.alert('Invalid Label', 'Please enter a valid text label.');
                return;
            }
        } else {
            newSeq = parseInt(editSequence, 10);
            if (isNaN(newSeq) || newSeq < 1) {
                Alert.alert('Invalid Index', 'Please enter a valid sequence number (1 or greater).');
                return;
            }
        }

        let newSubSeq: number | undefined;
        if (labelingMode !== 'single' && editSubSequence.trim()) {
            newSubSeq = parseInt(editSubSequence, 10);
            if (isNaN(newSubSeq) || newSubSeq < 1) {
                Alert.alert('Invalid Sub-Index', 'Please enter a valid sub-sequence number (1 or greater).');
                return;
            }
        }

        // Check if the file with the given index already exists
        const filename = formatFilename(newSeq, newSubSeq, labelingMode === 'text-group' ? newTextLabel : undefined);
        const exists = await fileExists(currentFolder.path, filename);

        // If it exists and we haven't shown a warning yet, show it and stop
        if (exists && !indexWarning) {
            setIndexWarning(`File "${filename.replace('.jpg', '')}" already exists. Press "Set" again to confirm overwrite.`);
            return;
        }

        // Set the new sequence/textLabel/subSequence
        if (labelingMode === 'text-group') {
            setTextLabel(newTextLabel);
            if (!usedLabels.includes(newTextLabel)) {
                setUsedLabels(prev => [...prev, newTextLabel]);
            }
        } else {
            setSequence(newSeq);
        }

        if (labelingMode !== 'single') {
            setSubSequence(newSubSeq ?? 1);
        }

        setIsEditingIndex(false);
        setIndexWarning(null);
    };

    const handleFocus = async (event: any) => {
        if (camera.current) {
            const { pageX, pageY } = event.nativeEvent;
            setFocusPoint({ x: pageX, y: pageY });

            focusAnim.setValue(0);
            Animated.spring(focusAnim, {
                toValue: 1,
                useNativeDriver: true,
                speed: 20,
                bounciness: 10,
            }).start(() => {
                setTimeout(() => setFocusPoint(null), 500);
            });

            try {
                await camera.current.focus({ x: pageX, y: pageY });
            } catch (e: any) {
                if (e.code === 'capture/focus-canceled') {
                    // Ignore focus cancellations
                    return;
                }
                console.error('Focus failed:', e);
            }
        }
    };

    if (!device || !hasPermission) {
        return (
            <View style={styles.container}>
                <Text style={styles.text}>No Camera Device or Permission</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#000" hidden={!showGallery} />
            <GestureDetector gesture={pinchGesture}>
                <Reanimated.View style={StyleSheet.absoluteFill}>
                    <TouchableWithoutFeedback onPress={handleFocus}>
                        <ReanimatedCamera
                            ref={camera}
                            style={StyleSheet.absoluteFill}
                            device={device}
                            isActive={true}
                            photo={true}
                            video={true}
                            audio={true}
                            // codeScanner={codeScanner}
                            animatedProps={animatedProps}
                            videoStabilizationMode="off"
                            outputOrientation="device"
                            resizeMode="contain"
                        />
                    </TouchableWithoutFeedback>
                </Reanimated.View>
            </GestureDetector>

            {!showGallery && isFlashing && <View style={styles.flashOverlay} />}

            {!showGallery && focusPoint && (
                <Animated.View
                    style={[
                        styles.focusIndicator,
                        {
                            left: focusPoint.x - 25,
                            top: focusPoint.y - 25,
                            transform: [{ scale: focusAnim }],
                        },
                    ]}
                />
            )}

            {!showGallery && (
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                    <SafeAreaView style={[
                        styles.header,
                        isLandscape && styles.headerLandscape,
                        { paddingTop: Math.max(10, insets.top) }
                    ]}>
                        <View style={styles.headerLeft}>
                            <TouchableOpacity onPress={onOpenFolders} style={styles.folderButton}>
                                <Text style={styles.folderText}>📁 {isRoot ? 'WorkPhotos' : currentFolder.name}</Text>
                            </TouchableOpacity>
                            {!isRoot && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setNewFolderName(getFolderBaseName(currentFolder.name));
                                        setIsRenaming(true);
                                    }}
                                    style={styles.editFolderButton}
                                >
                                    <Text style={styles.editFolderIcon}>✎</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={styles.headerRight}>
                            {isLandscape && renderSettingsGrid()}
                        </View>
                    </SafeAreaView>


                    <View style={[styles.zoomControls, isLandscape && styles.zoomControlsLandscape]}>
                        <TouchableOpacity onPress={() => {
                            const newZoom = Math.max(1, zoom - 0.5);
                            setZoom(newZoom);
                            zoomShared.value = newZoom;
                        }} style={styles.zoomButton}>
                            <Text style={[styles.zoomText, { fontSize: 24, marginTop: -2 }]}>-</Text>
                        </TouchableOpacity>
                        <Text style={styles.zoomValueText}>{zoom.toFixed(1)}x</Text>
                        <TouchableOpacity onPress={() => {
                            const newZoom = Math.min(10, zoom + 0.5);
                            setZoom(newZoom);
                            zoomShared.value = newZoom;
                        }} style={styles.zoomButton}>
                            <Text style={styles.zoomText}>+</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={[
                        styles.controls,
                        isLandscape && styles.controlsLandscape,
                        !isLandscape && { paddingBottom: Math.max(40, insets.bottom + 10) },
                        isLandscape && { paddingRight: Math.max(20, insets.right + 10) }
                    ]}>
                        <View style={styles.infoRow}>
                            {retakeTarget && (
                                <TouchableOpacity
                                    style={styles.retakeLabel}
                                    onPress={() => setRetakeTarget(null)}
                                >
                                    <Text style={styles.retakeLabelText}>
                                        Retaking {formatFilename(retakeTarget.sequence ?? 0, retakeTarget.subSequence, retakeTarget.textLabel).replace('.jpg', '')} ✕
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {!isRoot && (
                                <TouchableOpacity
                                    style={styles.filenameIndicator}
                                    onPress={retakeTarget ? undefined : openIndexEditor}
                                    disabled={!!retakeTarget}
                                >
                                    <Text style={styles.filenameIndicatorText}>
                                        Next: {formatFilename(
                                            retakeTarget?.sequence ?? sequence,
                                            retakeTarget ? retakeTarget.subSequence : (labelingMode !== 'single' ? subSequence : undefined),
                                            retakeTarget ? retakeTarget.textLabel : (labelingMode === 'text-group' ? textLabel : undefined)
                                        ).replace('.jpg', '')} ✎
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        <View style={[styles.modeToggleContainer, isLandscape && styles.modeToggleContainerLandscape]}>
                            <View style={[
                                styles.modeIndicator,
                                mode === 'video' && styles.modeIndicatorVideo,
                                isLandscape && styles.modeIndicatorLandscape,
                                isLandscape && mode === 'video' && styles.modeIndicatorVideoLandscape
                            ]} />
                            <TouchableOpacity
                                onPress={() => setMode('photo')}
                                style={[styles.modeToggleButton, isLandscape && styles.modeToggleButtonLandscape]}
                            >
                                <Text style={[styles.modeToggleText, mode === 'photo' && styles.activeModeToggleText]}>PHOTO</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setMode('video')}
                                style={[styles.modeToggleButton, isLandscape && styles.modeToggleButtonLandscape]}
                            >
                                <Text style={[styles.modeToggleText, mode === 'video' && styles.activeModeToggleText]}>VIDEO</Text>
                            </TouchableOpacity>
                        </View>

                        {isRecording && (
                            <View style={styles.recordingTimerContainer}>
                                <View style={styles.recordingTimerDot} />
                                <Text style={styles.recordingTimerText}>{formatDuration(recordingDuration)}</Text>
                            </View>
                        )}

                        <View style={styles.actionRow}>
                            <View style={styles.leftActionContainer}>
                                <TouchableOpacity
                                    style={styles.thumbnailButton}
                                    onPress={() => setShowGallery(true)}
                                >
                                    {lastPhoto ? (
                                        <Image source={{ uri: `file://${lastPhoto}` }} style={styles.thumbnailImage} />
                                    ) : (
                                        <View style={styles.thumbnailPlaceholder} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={[styles.captureButton, mode === 'video' && styles.videoButton]}
                                onPress={mode === 'photo' ? takePhoto : toggleRecording}
                            >
                                {isRecording && <View style={styles.recordingIndicator} />}
                            </TouchableOpacity>

                            <View style={[styles.rightActionContainer, !isLandscape && styles.rightActionContainerPortrait]}>
                                {!isLandscape && renderSettingsGrid()}
                            </View>
                        </View>
                    </View>
                </View>
            )}

            {isEnteringLabel && (
                <Modal
                    visible={isEnteringLabel}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setIsEnteringLabel(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Set Text Label</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.textInput}
                                    value={newFolderName}
                                    onChangeText={setNewFolderName}
                                    autoFocus
                                    placeholder="e.g. Beam, Wall, Floor"
                                    placeholderTextColor="#666"
                                />
                            </View>
                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.cancelButton]}
                                    onPress={() => setIsEnteringLabel(false)}
                                >
                                    <Text style={styles.modalButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.saveButton]}
                                    onPress={handleLabelSave}
                                >
                                    <Text style={styles.modalButtonText}>Set</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {isRenaming && (
                <Modal
                    visible={isRenaming}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setIsRenaming(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Rename Folder</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.textInput}
                                    value={newFolderName}
                                    onChangeText={setNewFolderName}
                                    autoFocus
                                    placeholder="Enter folder name"
                                    placeholderTextColor="#666"
                                />
                            </View>
                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.cancelButton]}
                                    onPress={() => setIsRenaming(false)}
                                >
                                    <Text style={styles.modalButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.saveButton]}
                                    onPress={handleRenameSave}
                                >
                                    <Text style={styles.modalButtonText}>Save</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {isEditingIndex && (
                <Modal
                    visible={isEditingIndex}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setIsEditingIndex(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Set Next Index</Text>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>
                                    {labelingMode === 'text-group' ? 'Sequence Text' : 'Sequence Number'}
                                </Text>
                                <TextInput
                                    style={styles.textInput}
                                    value={editSequence}
                                    onChangeText={(text) => {
                                        if (labelingMode === 'text-group') {
                                            setEditSequence(text);
                                        } else {
                                            setEditSequence(text.replace(/[^0-9]/g, ''));
                                        }
                                        setIndexWarning(null); // Clear warning on change
                                    }}
                                    keyboardType={labelingMode === 'text-group' ? 'default' : 'number-pad'}
                                    autoFocus
                                    placeholder={labelingMode === 'text-group' ? "Enter text label" : "e.g. 1, 2, 3..."}
                                    placeholderTextColor="#666"
                                />
                            </View>

                            {labelingMode !== 'single' && (
                                <View style={styles.inputContainer}>
                                    <Text style={styles.inputLabel}>Sub-sequence (optional)</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={editSubSequence}
                                        onChangeText={(text) => {
                                            setEditSubSequence(text.replace(/[^0-9]/g, ''));
                                            setIndexWarning(null); // Clear warning on change
                                        }}
                                        keyboardType="number-pad"
                                        placeholder="e.g. 1, 2, 3..."
                                        placeholderTextColor="#666"
                                    />
                                </View>
                            )}

                            {indexWarning && (
                                <View style={styles.warningContainer}>
                                    <Text style={styles.warningText}>⚠️ {indexWarning}</Text>
                                </View>
                            )}

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.cancelButton]}
                                    onPress={() => {
                                        setIsEditingIndex(false);
                                        setIndexWarning(null);
                                    }}
                                >
                                    <Text style={styles.modalButtonText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.saveButton]}
                                    onPress={handleIndexSave}
                                >
                                    <Text style={styles.modalButtonText}>Set</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            )}

            {!showGallery && (
                <Modal
                    visible={showDeviceList}
                    transparent={true}
                    animationType="slide"
                    onRequestClose={() => setShowDeviceList(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Available Camera Devices</Text>
                            <ScrollView style={styles.deviceList}>
                                {devices.map((d) => (
                                    <TouchableOpacity
                                        key={d.id}
                                        style={[
                                            styles.deviceItem,
                                            device?.id === d.id && styles.deviceItemActive
                                        ]}
                                        onPress={() => {
                                            setSelectedDeviceId(d.id);
                                            setShowDeviceList(false);
                                        }}
                                    >
                                        <Text style={styles.deviceName}>{d.name} ({d.position})</Text>
                                        <Text style={styles.deviceDetails}>
                                            {d.physicalDevices.join(' + ')}
                                        </Text>
                                        <Text style={styles.deviceDetails}>
                                            Zoom: {d.minZoom}x - {d.maxZoom}x
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowDeviceList(false)}
                            >
                                <Text style={styles.closeButtonText}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}

            {showGallery && (
                <View style={StyleSheet.absoluteFill}>
                    <MediaGallery
                        folderPath={currentFolder.path}
                        onClose={() => {
                            setShowGallery(false);
                            // Refresh last photo in case some were deleted
                            listPhotos(currentFolder.path).then(photos => {
                                if (photos.length > 0) setLastPhoto(photos[0].path);
                                else setLastPhoto(null);
                            });
                        }}
                        onRetake={(target) => setRetakeTarget(target)}
                    />
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    headerLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerRight: {
        alignItems: 'flex-end',
    },
    settingsGrid: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    settingsGridVertical: {
        flexDirection: 'column',
        width: 56,
        alignItems: 'center',
    },
    gridButton: {
        width: 54,
        height: 54,
        marginLeft: 10,
        paddingHorizontal: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gridButtonVertical: {
        marginLeft: 0,
        marginBottom: 12,
    },
    folderButton: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 20,
    },
    folderText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    editFolderButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 8,
    },
    editFolderIcon: {
        color: '#fff',
        fontSize: 16,
    },
    glassButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        marginLeft: 8,
    },
    activeButton: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 12,
    },
    nextGroupButton: {
        borderColor: '#FFD700',
        backgroundColor: 'rgba(255, 215, 0, 0.2)',
    },
    nextGroupIcon: {
        color: '#FFD700',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: -2,
    },
    nextGroupText: {
        color: '#FFD700',
        fontSize: 10,
        fontWeight: 'bold',
    },
    retakeGridButton: {
        borderColor: '#FFD700',
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
    },
    retakeGridIcon: {
        color: '#FFD700',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: -2,
    },
    retakeGridText: {
        color: '#FFD700',
        fontSize: 10,
        fontWeight: 'bold',
    },
    controls: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingBottom: 40,
    },
    infoRow: {
        alignItems: 'center',
        marginBottom: 15,
        width: '100%',
    },
    filenameIndicator: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 15,
        paddingVertical: 4,
        borderRadius: 15,
    },
    filenameIndicatorText: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: 'bold',
    },
    retakeLabel: {
        backgroundColor: '#FFD700',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 15,
        marginBottom: 8,
    },
    retakeLabelText: {
        color: '#000',
        fontSize: 12,
        fontWeight: 'bold',
    },
    modeToggleContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 22,
        padding: 4,
        marginBottom: 20,
        position: 'relative',
        width: 160,
        height: 44,
        alignItems: 'center',
    },
    modeToggleContainerLandscape: {
        flexDirection: 'column',
        width: 80,
        height: 100,
        marginBottom: 0,
        marginRight: 20,
    },
    modeIndicator: {
        position: 'absolute',
        width: 76,
        height: 36,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 18,
        top: 4,
        left: 4,
    },
    modeIndicatorVideo: {
        left: 80,
    },
    modeIndicatorLandscape: {
        width: 72,
        height: 46,
        left: 4,
        top: 4,
    },
    modeIndicatorVideoLandscape: {
        top: 50,
        left: 4,
    },
    modeToggleButton: {
        width: 76,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    modeToggleButtonLandscape: {
        width: 72,
        height: 46,
    },
    modeToggleText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        opacity: 0.6,
    },
    activeModeToggleText: {
        color: '#FFD700',
        opacity: 1,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: 100,
    },
    leftActionContainer: {
        position: 'absolute',
        left: 30,
        width: 60,
        alignItems: 'center',
    },
    thumbnailButton: {
        width: 54,
        height: 54,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.3)',
        overflow: 'hidden',
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#fff',
        borderWidth: 6,
        borderColor: 'rgba(255,255,255,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rightActionContainer: {
        position: 'absolute',
        right: 20,
        width: 100,
        alignItems: 'center',
    },
    rightActionContainerPortrait: {
        width: 70,
        right: 10,
        alignItems: 'center',
        bottom: 0,
    },
    retakeLastButton: {
        backgroundColor: 'rgba(255, 215, 0, 0.15)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.4)',
    },
    retakeLastButtonPortrait: {
        marginTop: 5,
        width: 54,
        height: 54,
        borderRadius: 27,
        justifyContent: 'center',
        alignItems: 'center',
    },
    retakeLastButtonText: {
        color: '#FFD700',
        fontSize: 8,
        fontWeight: 'bold',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    hybridIconText: {
        fontSize: 11,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#fff',
    },
    hybridIconBorder: {
        position: 'absolute',
        width: 24,
        height: 18,
        borderWidth: 1.5,
        borderRadius: 3,
    },
    hybridSubText: {
        fontSize: 8,
        fontWeight: '900',
        marginTop: 0,
    },
    boltArea: {
        height: 24,
        justifyContent: 'center',
    },
    textArea: {
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconContainer: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconCircle: {
        width: 24,
        height: 24,
        borderWidth: 1.5,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    boltContainer: {
        width: 16,
        height: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    boltInner: {
        width: 8,
        height: 13,
    },
    boltPart: {
        position: 'absolute',
        width: 0,
        height: 0,
        borderStyle: 'solid',
    },
    switchArrow: {
        position: 'absolute',
        width: 0,
        height: 0,
        borderLeftWidth: 2.5,
        borderRightWidth: 2.5,
        borderTopWidth: 4,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
    },
    headerLandscape: {
        paddingTop: 10,
    },
    controlsLandscape: {
        bottom: 0,
        right: 0,
        left: 'auto',
        width: 150,
        height: '100%',
        justifyContent: 'center',
        paddingBottom: 0,
        paddingRight: 20,
    },
    videoButton: {
        backgroundColor: '#FF3B30',
    },
    recordingIndicator: {
        width: 24,
        height: 24,
        backgroundColor: '#fff',
        borderRadius: 4,
    },
    text: {
        color: '#fff',
        fontSize: 18,
    },
    flashOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#fff',
        zIndex: 99,
    },
    focusIndicator: {
        position: 'absolute',
        width: 50,
        height: 50,
        borderWidth: 2,
        borderColor: '#FFD700',
        borderRadius: 5,
        zIndex: 100,
    },
    zoomControls: {
        position: 'absolute',
        bottom: 280,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
        paddingHorizontal: 10,
        zIndex: 5,
    },
    zoomControlsLandscape: {
        bottom: 'auto',
        top: '50%',
        right: 170,
        flexDirection: 'column-reverse',
        transform: [{ translateY: -50 }],
    },
    zoomButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    zoomValueText: {
        color: '#FFD700',
        fontSize: 14,
        fontWeight: 'bold',
        marginHorizontal: 10,
    },
    thumbnailImage: {
        flex: 1,
    },
    thumbnailPlaceholder: {
        flex: 1,
        backgroundColor: '#333',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '80%',
        backgroundColor: '#222',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 20,
    },
    inputContainer: {
        width: '100%',
        marginBottom: 20,
    },
    textInput: {
        backgroundColor: '#333',
        color: '#fff',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    modalButton: {
        flex: 1,
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: '#444',
    },
    saveButton: {
        backgroundColor: '#007AFF',
    },
    modalButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    deviceList: {
        marginBottom: 15,
    },
    deviceItem: {
        padding: 15,
        borderRadius: 12,
        backgroundColor: '#2a2a2a',
        marginBottom: 10,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    deviceItemActive: {
        borderColor: '#007AFF',
        backgroundColor: '#3a3a3a',
    },
    deviceName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    deviceDetails: {
        color: '#aaa',
        fontSize: 12,
        marginTop: 4,
    },
    sectionHeader: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 15,
        marginBottom: 10,
        letterSpacing: 1,
    },
    deviceItemHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    badgeLogical: {
        backgroundColor: '#5856D6',
    },
    badgePhysical: {
        backgroundColor: '#34C759',
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        textTransform: 'uppercase',
    },
    closeButton: {
        backgroundColor: '#007AFF',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    inputLabel: {
        color: '#aaa',
        fontSize: 14,
        marginBottom: 8,
    },
    checkButton: {
        backgroundColor: '#444',
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 10,
    },
    checkButtonText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '600',
    },
    warningContainer: {
        backgroundColor: 'rgba(255, 193, 7, 0.2)',
        padding: 12,
        borderRadius: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#FFC107',
    },
    warningText: {
        color: '#FFC107',
        fontSize: 13,
    },
    cameraIconContainer: {
        width: 32,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraBody: {
        width: 24,
        height: 16,
        borderWidth: 1.5,
        borderRadius: 2,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cameraLens: {
        width: 8,
        height: 8,
        borderWidth: 1.5,
        borderRadius: 4,
    },
    cameraShutter: {
        width: 4,
        height: 2,
        position: 'absolute',
        top: -3,
        left: 4,
        borderRadius: 1,
    },
    gearsContainer: {
        position: 'absolute',
        right: 0,
        top: 2,
        bottom: 2,
        width: 6,
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    gear: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    recordingTimerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 10,
        alignSelf: 'center',
    },
    recordingTimerDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FF3B30',
        marginRight: 8,
    },
    recordingTimerText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        fontVariant: ['tabular-nums'],
    },
});

export default CameraView;
