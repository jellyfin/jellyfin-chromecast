declare global {
    export const PRODUCTION: boolean;
    export const RECEIVERVERSION: string;
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
