import {
    CastReceiverContext,
    PlayerManager
} from 'chromecast-caf-receiver/cast.framework';
import { SystemVolumeData } from 'chromecast-caf-receiver/cast.framework.system';
import type {
    BaseItemDto,
    RepeatMode
} from '@jellyfin/sdk/lib/generated-client';
import { TextTrackEdgeType } from 'chromecast-caf-receiver/cast.framework.messages';

export type Dictionary<T> = Record<string, T>;

// Jellyfin Server
// Why doesn't the API have a type for this?
/* Combined item query.
 * Valid for item endpoints */
// TODO: API has an endpoint for this. Replace on https://github.com/jellyfin/jellyfin-chromecast/pull/109
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

type SupportedCommands = Record<string, (data: DataMessage) => void>;
// /From commandHandler

interface SubtitleAppearance {
    dropShadow: TextTrackEdgeType;
    font: string;
    textColor: string;
    textBackground: string;
    textSize: 'smaller' | 'small' | 'large' | 'larger' | 'extralarge';
}

declare global {
    export interface Window {
        mediaElement: HTMLElement | null;
        playerManager: PlayerManager;
        castReceiverContext: CastReceiverContext;
        repeatMode: RepeatMode;
        reportEventType: 'repeatmodechange';
        subtitleAppearance: SubtitleAppearance;
        MaxBitrate: number | undefined;
        senderId: string | undefined;
        volume: SystemVolumeData;
    }
}

declare module 'chromecast-caf-receiver/cast.framework.messages' {
    interface MediaInformationCustomData {
        audioStreamIndex: string;
        canClientSeek: boolean;
        canSeek: boolean;
        itemId: string | undefined;
        liveStreamId: number;
        mediaSourceId: number;
        playMethod: 'DirectStream' | 'Transcode';
        playSessionId: string;
        runtimeTicks: number;
        startPositionTicks: number;
        subtitleStreamIndex: number;
    }
}
