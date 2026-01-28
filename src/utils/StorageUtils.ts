import RNFS from 'react-native-fs';
import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';

// On Android, DCIM is usually under ExternalStorageDirectoryPath
export const BASE_DIR = `${RNFS.ExternalStorageDirectoryPath}/DCIM/WorkPhotos`;

/**
 * Ensures the base directory exists.
 */
export const initStorage = async () => {
    const exists = await RNFS.exists(BASE_DIR);
    if (!exists) {
        await RNFS.mkdir(BASE_DIR);
    }
};

const STATE_FILE = `${RNFS.DocumentDirectoryPath}/app_state.json`;

export const saveLastFolder = async (folder: { name: string; path: string }) => {
    try {
        await RNFS.writeFile(STATE_FILE, JSON.stringify(folder), 'utf8');
    } catch (e) {
        console.warn('Failed to save state', e);
    }
};

export const getLastFolder = async (): Promise<{ name: string; path: string } | null> => {
    try {
        if (await RNFS.exists(STATE_FILE)) {
            const content = await RNFS.readFile(STATE_FILE, 'utf8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.warn('Failed to load state', e);
    }
    return null;
};

/**
 * Requests storage permissions. Handles Android 11+ Manage External Storage logic if possible, 
 * otherwise requests standard Read/Write permissions.
 */
export const requestStoragePermission = async () => {
    if (Platform.OS !== 'android') return true;

    try {
        let granted = false;

        if (Platform.Version >= 33) {
            const result = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
                PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
            ]);
            granted =
                result['android.permission.READ_MEDIA_IMAGES'] === PermissionsAndroid.RESULTS.GRANTED &&
                result['android.permission.READ_MEDIA_VIDEO'] === PermissionsAndroid.RESULTS.GRANTED;
        } else {
            const result = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            ]);
            granted =
                result['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED &&
                result['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED;
        }

        // Even if standard/media permissions are granted, we require full file access (Manage External Storage)
        // for features like deleting/renaming any file in the shared folder.
        // We test this by attempting to write and delete a test file.
        const hasFullAccess = await verifyFullAccess();

        if (granted && hasFullAccess) {
            return true;
        }

        // If we don't have full access, prompt user
        if (!hasFullAccess) {
            Alert.alert(
                "Full Access Required",
                "To manage photos and folders effectively, this app requires 'All Files Access'.\n\nTap 'Go to Settings', find 'WorkCameraApp_v2', and toggle 'Allow access to manage all files' ON.",
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Go to Settings",
                        onPress: () => {
                            // Direct intent to "All Files Access" list
                            Linking.sendIntent("android.settings.MANAGE_ALL_FILES_ACCESS_PERMISSION")
                                .catch(() => Linking.openSettings());
                        }
                    }
                ]
            );
            return false;
        }

        return true;
    } catch (err) {
        console.warn(err);
        return false;
    }
};

const verifyFullAccess = async () => {
    try {
        await initStorage();
        const testFile = `${BASE_DIR}/.perm_test`;
        await RNFS.writeFile(testFile, 'test', 'utf8');
        await RNFS.unlink(testFile);
        return true;
    } catch (e) {
        // console.log('Full access check failed:', e);
        return false;
    }
};

/**
 * Generates a consistent timestamp string: YYYYMMDD_HHMMSS
 */
export const getTimestamp = () => {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${YYYY}${MM}${DD}_${HH}${mm}${ss}`;
};

/**
 * Extracts the base name from a timestamped folder name.
 * Handles the pattern: name_YYYYMMDD_HHMMSS
 */
export const getFolderBaseName = (folderName: string) => {
    const match = folderName.match(/^(.*)_\d{8}_\d{6}$/);
    if (match) {
        return match[1];
    }
    return folderName;
};

/**
 * Creates a new folder with a name + timestamp pattern.
 */
export const createNewSessionFolder = async (prefix: string = 'Session') => {
    const sanitizedPrefix = prefix.replace(/[\\/:*?"<>|]/g, '_');
    const folderName = `${sanitizedPrefix}_${getTimestamp()}`;
    const folderPath = `${BASE_DIR}/${folderName}`;
    await RNFS.mkdir(folderPath);
    return { name: folderName, path: folderPath };
};

/**
 * Lists all folders in the base directory.
 */
/**
 * Lists all folders in the base directory with empty status.
 */
export const listFolders = async () => {
    try {
        const items = await RNFS.readDir(BASE_DIR);
        const folders = items.filter(f => f.isDirectory()).sort((a, b) => b.mtime!.getTime() - a.mtime!.getTime());

        // Enrich with empty status
        const enriched = await Promise.all(folders.map(async (f) => {
            let isEmpty = true;
            try {
                const contents = await RNFS.readDir(f.path);
                // Check for at least one media file
                const hasMedia = contents.some(c => {
                    if (!c.isFile()) return false;
                    const name = c.name.toLowerCase();
                    return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') ||
                        name.endsWith('.mp4') || name.endsWith('.mov');
                });
                isEmpty = !hasMedia;
            } catch (e) {
                // If we can't read it, assume empty or error
                console.warn(`Failed to check folder ${f.name}`, e);
            }
            return {
                name: f.name,
                path: f.path,
                isEmpty
            };
        }));

        return enriched;
    } catch (e) {
        console.warn('Failed to list folders', e);
        return [];
    }
};

/**
 * Renames a folder and appends a new timestamp.
 */
export const renameFolder = async (oldName: string, newName: string) => {
    const oldPath = `${BASE_DIR}/${oldName}`;
    const sanitizedNewName = newName.replace(/[\\/:*?"<>|]/g, '_');
    const timestampedName = `${sanitizedNewName}_${getTimestamp()}`;
    const newPath = `${BASE_DIR}/${timestampedName}`;
    await RNFS.moveFile(oldPath, newPath);
    return { name: timestampedName, path: newPath };
};

/**
 * Deletes a folder.
 */
export const deleteFolder = async (name: string) => {
    const path = `${BASE_DIR}/${name}`;
    await RNFS.unlink(path);
};

/**
 * Moves a captured file to the target session folder.
 * Last line of defense: if the filename already exists, it appends a suffix to prevent overwrite.
 */
export const saveFile = async (tempPath: string, folderPath: string, filename: string) => {
    let finalFilename = filename;
    let destPath = `${folderPath}/${finalFilename}`;
    let counter = 1;

    const ext = filename.endsWith('.mp4') ? '.mp4' : '.jpg';
    const base = filename.slice(0, -ext.length);

    // Keep checking until we find a name that doesn't exist
    while (await RNFS.exists(destPath)) {
        counter++;
        finalFilename = `${base}_v${counter}${ext}`;
        destPath = `${folderPath}/${finalFilename}`;
    }

    await RNFS.moveFile(tempPath, destPath);
    return destPath;
};

/**
 * Lists all media (photos and videos) in a given folder.
 */
export const listPhotos = async (folderPath: string) => {
    try {
        console.log(`[StorageUtils] Listing photos in: ${folderPath}`);
        const files = await RNFS.readDir(folderPath);
        console.log(`[StorageUtils] Found ${files.length} items in readDir.`);

        const filtered = files
            .filter(f => {
                if (!f.isFile()) {
                    // console.log(`[StorageUtils] Ignoring directory: ${f.name}`);
                    return false;
                }
                const name = f.name.toLowerCase();
                const isMedia = name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') ||
                    name.endsWith('.mp4') || name.endsWith('.mov');

                if (!isMedia) {
                    console.log(`[StorageUtils] Ignoring non-media file: ${f.name}`);
                }
                return isMedia;
            })
            .sort((a, b) => (b.mtime?.getTime() || 0) - (a.mtime?.getTime() || 0));

        console.log(`[StorageUtils] Returning ${filtered.length} media files.`);
        return filtered;
    } catch (e) {
        console.error('[StorageUtils] Error listing media:', e);
        return [];
    }
};

/**
 * Moves an existing file to an archive subfolder.
 */
export const archiveExistingFile = async (folderPath: string, filename: string) => {
    const filePath = `${folderPath}/${filename}`;
    const archivePath = `${folderPath}/archive`;

    try {
        if (await RNFS.exists(filePath)) {
            if (!(await RNFS.exists(archivePath))) {
                await RNFS.mkdir(archivePath);
            }

            const timestamp = new Date().getTime();
            const archiveFileName = filename.replace('.jpg', `_${timestamp}.jpg`);
            const destPath = `${archivePath}/${archiveFileName}`;

            await RNFS.moveFile(filePath, destPath);
            return true;
        }
    } catch (e) {
        console.error('Error archiving file:', e);
    }
    return false;
};

/**
 * Deletes a single file.
 */
export const deleteFile = async (path: string) => {
    try {
        await RNFS.unlink(path);
        return true;
    } catch (e) {
        console.error('Error deleting file:', e);
        return false;
    }
};

/**
 * Triggers Android's media scanner for a file.
 */
export const scanMediaFile = async (path: string) => {
    try {
        if (RNFS.scanFile) {
            await RNFS.scanFile(path);
            return true;
        }
    } catch (e) {
        console.error('Error scanning media file:', e);
    }
    return false;
};

/**
 * Checks if a file exists in a folder.
 */
export const fileExists = async (folderPath: string, filename: string) => {
    try {
        const filePath = `${folderPath}/${filename}`;
        return await RNFS.exists(filePath);
    } catch (e) {
        console.error('Error checking file existence:', e);
        return false;
    }
};

/**
 * Formats the filename based on sequence and grouping logic.
 */
export const formatFilename = (sequence: number, subSequence?: number, textLabel?: string) => {
    // If textLabel is present, use it as the main prefix
    if (textLabel) {
        // Sanitize only truly illegal characters for filenames (\ / : * ? " < > |)
        const sanitized = textLabel.replace(/[\\/:*?"<>|]/g, '_');
        if (subSequence !== undefined) {
            return `${sanitized}-${subSequence}.jpg`;
        }
        return `${sanitized}.jpg`;
    }

    const seqStr = sequence.toString().padStart(3, '0');
    if (subSequence !== undefined) {
        return `${seqStr}-${subSequence}.jpg`;
    }
    return `${seqStr}.jpg`;
};

/**
 * Generates a unique timestamp-based filename for root storage.
 * Format: IMG_YYYYMMDD_HHMMSS_SHORTID.jpg or VID_...mp4
 */
export const formatTimestampFilename = (extension: '.jpg' | '.mp4') => {
    const timestamp = getTimestamp();
    const shortId = Math.random().toString(36).substring(2, 6).toUpperCase();
    const prefix = extension === '.jpg' ? 'IMG' : 'VID';
    return `${prefix}_${timestamp}_${shortId}${extension}`;
};

/**
 * Parses a filename back into sequence numbers/labels.
 * Example: "001.jpg" -> { sequence: 1 }
 * Example: "001-2.jpg" -> { sequence: 1, subSequence: 2 }
 * Example: "Beam-5.jpg" -> { textLabel: "Beam", subSequence: 5 }
 */
export const parseFilename = (filename: string) => {
    const name = filename.replace('.jpg', '').replace('.mp4', '');

    if (name.includes('-')) {
        const parts = name.split('-');
        const sub = Number(parts.pop());
        const prefix = parts.join('-');

        // Check if prefix is numeric
        if (/^\d+$/.test(prefix)) {
            return { sequence: Number(prefix), subSequence: sub };
        } else {
            return { textLabel: prefix, subSequence: sub };
        }
    }

    if (/^\d+$/.test(name)) {
        return { sequence: Number(name) };
    }

    return { textLabel: name };
};
/**
 * Scans a folder for existing media files and returns the highest sequence number found.
 * Returns 0 if the folder is empty or contains no valid filenames.
 */
export const findHighestSequence = async (folderPath: string): Promise<number> => {
    try {
        const files = await listPhotos(folderPath);
        let maxSeq = 0;

        files.forEach(file => {
            const parsed = parseFilename(file.name);
            if (parsed.sequence !== undefined && parsed.sequence > maxSeq) {
                maxSeq = parsed.sequence;
            }
        });

        return maxSeq;
    } catch (e) {
        console.error('Error finding highest sequence:', e);
        return 0;
    }
};

/**
 * Generates a unique filename for the given parameters, appending a suffix if it already exists.
 */
export const getUniqueFilename = async (folderPath: string, sequence: number, subSequence?: number, textLabel?: string): Promise<string> => {
    let filename = formatFilename(sequence, subSequence, textLabel);
    let counter = 1;

    // Remove extension for collision base
    const ext = filename.endsWith('.mp4') ? '.mp4' : '.jpg';
    const base = filename.replace(ext, '');

    while (await RNFS.exists(`${folderPath}/${filename}`)) {
        counter++;
        filename = `${base}_${counter}${ext}`;
    }

    return filename;
};
