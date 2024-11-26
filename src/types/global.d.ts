import {
    CastReceiverContext,
    PlayerManager
} from 'chromecast-caf-receiver/cast.framework';
import { SystemVolumeData } from 'chromecast-caf-receiver/cast.framework.system';
import type {
    BaseItemDto,
    MediaSourceInfo,
    RepeatMode
} from '@jellyfin/sdk/lib/generated-client';
import type {
    TextTrackEdgeType,
    Track
} from 'chromecast-caf-receiver/cast.framework.messages';

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
    startIndex?: number;
    items: BaseItemDto[];
    startPositionTicks?: number;
    mediaSourceId?: string;
    audioStreamIndex?: number;
    subtitleStreamIndex?: number;
    liveStreamId?: string;
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

interface StreamInfo {
    tracks?: Track[];
    audioStreamIndex: number | null;
    canClientSeek: boolean;
    canSeek: boolean;
    contentType: string;
    isStatic: boolean;
    mediaSource?: MediaSourceInfo;
    playerStartPositionTicks?: number;
    startPositionTicks: number | null;
    streamContainer?: string | null;
    subtitleStreamIndex: number | null;
    subtitleStreamUrl?: string;
    url: string;
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
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface MediaInformationCustomData
        extends JellyfinMediaInformationCustomData {}
}

interface JellyfinMediaInformationCustomData {
    audioStreamIndex: number | null;
    canClientSeek: boolean;
    canSeek: boolean;
    itemId: string | undefined;
    liveStreamId: string | null;
    mediaSourceId: string | null;
    playMethod: 'DirectStream' | 'Transcode';
    playSessionId: string;
    runtimeTicks: number | null;
    startPositionTicks: number;
    subtitleStreamIndex: number | null;
}
