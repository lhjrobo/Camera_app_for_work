import RNFS from 'react-native-fs';

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
export const listFolders = async () => {
    const files = await RNFS.readDir(BASE_DIR);
    return files.filter(f => f.isDirectory()).sort((a, b) => b.mtime!.getTime() - a.mtime!.getTime());
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
        const files = await RNFS.readDir(folderPath);
        return files
            .filter(f => {
                if (!f.isFile()) return false;
                const name = f.name.toLowerCase();
                return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') ||
                    name.endsWith('.mp4') || name.endsWith('.mov');
            })
            .sort((a, b) => (b.mtime?.getTime() || 0) - (a.mtime?.getTime() || 0));
    } catch (e) {
        console.error('Error listing media:', e);
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
