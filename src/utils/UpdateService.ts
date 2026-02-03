import { NativeModules, Platform, Alert } from 'react-native';
import RNFS from 'react-native-fs';
import { version as currentVersion } from '../../package.json';

const { AppInstaller } = NativeModules;

const REPO_OWNER = 'lhjrobo';
const REPO_NAME = 'Camera_app_for_work';

interface Release {
    tag_name: string;
    assets: {
        browser_download_url: string;
        name: string;
        content_type: string;
    }[];
    body: string;
}

export const checkForUpdate = async () => {
    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`);
        if (!response.ok) {
            throw new Error('Failed to fetch release info');
        }
        const data: Release = await response.json();

        const latestVersion = data.tag_name.replace(/^v_?/, '');

        if (compareVersions(latestVersion, currentVersion) > 0) {
            return {
                hasUpdate: true,
                version: latestVersion,
                releaseNotes: data.body,
                apkUrl: data.assets.find(a => a.name.endsWith('.apk'))?.browser_download_url
            };
        }
        return { hasUpdate: false };
    } catch (error) {
        console.error('Update check failed:', error);
        return { hasUpdate: false, error };
    }
};

export const downloadAndInstallUpdate = async (url: string, onProgress: (progress: number) => void) => {
    const destPath = `${RNFS.CachesDirectoryPath}/update.apk`;

    // Remove old file if exists
    const exists = await RNFS.exists(destPath);
    if (exists) {
        await RNFS.unlink(destPath);
    }

    const { promise } = RNFS.downloadFile({
        fromUrl: url,
        toFile: destPath,
        progress: (res) => {
            const progress = (res.bytesWritten / res.contentLength) * 100;
            onProgress(progress);
        }
    });

    try {
        await promise;
        // Delay slightly to ensure file close?
        setTimeout(() => {
            AppInstaller.installApk(destPath);
        }, 500);
    } catch (error) {
        console.error('Download failed:', error);
        Alert.alert('Update Failed', 'Failed to download the update.');
    }
};

// Simple version comparison: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
const compareVersions = (v1: string, v2: string) => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const n1 = parts1[i] || 0;
        const n2 = parts2[i] || 0;
        if (n1 > n2) return 1;
        if (n1 < n2) return -1;
    }
    return 0;
};
