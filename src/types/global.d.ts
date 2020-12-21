import { RepeatMode } from '../api/generated/models/repeat-mode';

export interface DeviceInfo {
    deviceId: string | number;
    deviceName: string;
    versionNumber: string;
}

export interface GlobalScope {
    [key: string]: any;
}

export interface Dictionary<T> {
    [Key: string]: T;
}

declare global {
    export const PRODUCTION: boolean;
    export const RECEIVERVERSION: string;
    export const $scope: GlobalScope;
    export interface Window {
        deviceInfo: DeviceInfo;
        mediaElement: HTMLElement | null;
        mediaManager: cast.framework.PlayerManager;
        castReceiverContext: cast.framework.CastReceiverContext;
        playlist: Array<any>;
        currentPlaylistIndex: number;
        repeatMode: RepeatMode;
        reportEventType: 'repeatmodechange';
        subtitleAppearance: any;
        MaxBitrate: number | undefined;
        senderId: string | undefined;
    }
}
