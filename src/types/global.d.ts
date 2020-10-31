declare global {
    export let PRODUCTION: boolean;
    export interface Window {
        deviceInfo: DeviceInfo;
        mediaElement: HTMLElement | null;
        playlist: Array<any>;
        currentPlaylistIndex: number;
        repeatMode: "RepeatOne" | "RepeatAll" | "RepeatNone";
    }
}

export interface DeviceInfo {
    deviceId: string | number,
    deviceName: string,
    versionNumber: string
}
