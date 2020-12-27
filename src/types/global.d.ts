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

// From commandHandler
export interface PlayRequest {
    items: BaseItemDto[];
    startPositionTicks: number | undefined;
    mediaSourceId: string | undefined;
    audioStreamIndex: number | undefined;
    subtitleStreamIndex: number | undefined;
    liveStreamId: string | undefined;
}

export interface DisplayRequest {
    ItemId: string;
}

export interface SetIndexRequest {
    index: number;
}

export interface SetRepeatModeRequest {
    RepeatMode: RepeatMode;
}
export interface SeekRequest {
    position: number; // seconds
}

export interface DataMessage {
    options:
        | PlayRequest
        | DisplayRequest
        | SetIndexRequest
        | SetRepeatModeRequest
        | SeekRequest;
    command: string;
}

interface SupportedCommands {
    [command: string]: (data: DataMessage) => void;
}
// /From commandHandler

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
        volume: cast.framework.system.SystemVolumeData;
    }
}
