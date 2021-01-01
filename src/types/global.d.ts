import { RepeatMode } from '../api/generated/models/repeat-mode';
import { BaseItemDto } from '../api/generated/models/base-item-dto';

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

// Jellyfin Server
// Why doesn't the API have a type for this?
/* Combined item query.
 * Valid for item endpoints */
export interface ItemQuery {
    UserId?: string;
    Limit?: number;
    Fields?: string;
    Filters?: string;
    Recursive?: boolean;
    ExcludeLocationTypes?: string;
    Ids?: string;
    SortBy?: string;
    IsVirtualUnaired?: boolean;
    IsMissing?: boolean;
    ParentId?: string;
    MediaTypes?: string;
    Genres?: string;
    ArtistIds?: string;
}

// Messagebus message
export interface BusMessage {
    type: string;
    message?: string;
    data?: string;
}

//
// For the old queue stuff
//
export interface ItemIndex {
    item: BaseItemDto;
    index: number;
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
        repeatMode: RepeatMode;
        reportEventType: 'repeatmodechange';
        subtitleAppearance: any;
        MaxBitrate: number | undefined;
        senderId: string | undefined;
        volume: cast.framework.system.SystemVolumeData;
    }
}
