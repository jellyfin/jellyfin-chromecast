import type {
    BaseItemDto,
    MediaSourceInfo,
    PlayMethod
} from '@jellyfin/sdk/lib/generated-client';
import { RepeatMode } from '@jellyfin/sdk/lib/generated-client';
import { MediaInformationCustomData } from 'chromecast-caf-receiver/cast.framework.messages';
import { AppStatus } from '../types/appStatus';
import {
    broadcastConnectionErrorMessage,
    createStreamInfo,
    ticksToSeconds
} from '../helpers';
import { DocumentManager } from './documentManager';
import { getDeviceProfile } from './deviceprofileBuilder';
import {
    getPlaybackInfo,
    getLiveStream,
    load,
    stopPingInterval
} from './jellyfinActions';
import {
    onStopPlayerBeforePlaybackDone,
    getMaxBitrate,
    getOptimalMediaSource,
    showPlaybackInfoErrorMessage,
    checkDirectPlay,
    createMediaInformation
} from './maincontroller';
import { ItemIndex, PlayRequest } from '~/types/global';

export interface PlaybackState {
    startPositionTicks: number;
    mediaType: string | null | undefined;
    itemId: string;

    audioStreamIndex: number | null;
    subtitleStreamIndex: number | null;
    mediaSource: MediaSourceInfo | null;
    mediaSourceId: string;
    PlaybackMediaSource: MediaSourceInfo | null;

    playMethod: PlayMethod | undefined;
    canSeek: boolean;
    isChangingStream: boolean;
    playNextItemBool: boolean;

    item: BaseItemDto | null;
    liveStreamId: string;
    playSessionId: string;

    runtimeTicks: number;
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export abstract class PlaybackManager {
    private static playerManager: framework.PlayerManager;
    private static activePlaylist: BaseItemDto[];
    private static activePlaylistIndex: number;

    static playbackState: PlaybackState = {
        audioStreamIndex: null,
        canSeek: false,
        isChangingStream: false,
        item: null,
        itemId: '',
        liveStreamId: '',
        mediaSource: null,
        mediaSourceId: '',
        mediaType: '',
        PlaybackMediaSource: null,
        playMethod: undefined,
        playNextItemBool: true,
        playSessionId: '',
        runtimeTicks: 0,
        startPositionTicks: 0,
        subtitleStreamIndex: null
    };

    static setPlayerManager(playerManager: framework.PlayerManager): void {
        // Parameters
        this.playerManager = playerManager;
        this.resetPlaylist();
    }

    /* This is used to check if we can switch to
     * some other info overlay.
     *
     * Returns true when playing or paused.
     * (before: true only when playing)
     */
    static isPlaying(): boolean {
        return (
            this.playerManager.getPlayerState() ===
                cast.framework.messages.PlayerState.PLAYING ||
            this.playerManager.getPlayerState() ===
                cast.framework.messages.PlayerState.PAUSED
        );
    }

    static isBuffering(): boolean {
        return (
            this.playerManager.getPlayerState() ===
            cast.framework.messages.PlayerState.BUFFERING
        );
    }

    static isIdle(): boolean {
        return (
            this.playerManager.getPlayerState() ===
            cast.framework.messages.PlayerState.IDLE
        );
    }

    static async playFromOptions(options: PlayRequest): Promise<void> {
        const firstItem = options.items[0];

        if (options.startPositionTicks || firstItem.MediaType !== 'Video') {
            return this.playFromOptionsInternal(options);
        }

        return this.playFromOptionsInternal(options);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private static playFromOptionsInternal(options: any): Promise<void> {
        const stopPlayer =
            this.activePlaylist && this.activePlaylist.length > 0;

        this.activePlaylist = options.items;
        this.activePlaylistIndex = options.startIndex || 0;

        console.log('Loaded new playlist:', this.activePlaylist);

        // When starting playback initially, don't use
        // the next item facility.
        return this.playItem(options, stopPlayer);
    }

    // add item to playlist
    static enqueue(item: BaseItemDto): void {
        this.activePlaylist.push(item);
    }

    static resetPlaylist(): void {
        this.activePlaylistIndex = -1;
        this.activePlaylist = [];
    }

    // If there are items in the queue after the current one
    static hasNextItem(): boolean {
        return this.activePlaylistIndex < this.activePlaylist.length - 1;
    }

    // If there are items in the queue before the current one
    static hasPrevItem(): boolean {
        return this.activePlaylistIndex > 0;
    }

    static playNextItem(stopPlayer = false): boolean {
        const nextItemInfo = this.getNextPlaybackItemInfo();

        if (nextItemInfo) {
            this.activePlaylistIndex = nextItemInfo.index;
            this.playItem({}, stopPlayer);

            return true;
        }

        return false;
    }

    static playPreviousItem(): boolean {
        if (this.activePlaylist && this.activePlaylistIndex > 0) {
            this.activePlaylistIndex--;
            this.playItem({}, true);

            return true;
        }

        return false;
    }

    // play item from playlist
    private static async playItem(
        options: any, // eslint-disable-line @typescript-eslint/no-explicit-any
        stopPlayer = false
    ): Promise<void> {
        if (stopPlayer) {
            this.stop();
        }

        const item = this.activePlaylist[this.activePlaylistIndex];

        console.log(`Playing index ${this.activePlaylistIndex}`, item);

        return await onStopPlayerBeforePlaybackDone(item, options);
    }

    // Would set private, but some refactorings need to happen first.
    static async playItemInternal(
        item: BaseItemDto,
        options: MediaInformationCustomData
    ): Promise<void> {
        DocumentManager.setAppStatus(AppStatus.Loading);

        const maxBitrate = await getMaxBitrate();
        const deviceProfile = getDeviceProfile({
            bitrateSetting: maxBitrate,
            enableHls: true
        });
        const playbackInfo = await getPlaybackInfo(
            item,
            maxBitrate,
            deviceProfile,
            options.startPositionTicks,
            options.mediaSourceId,
            options.audioStreamIndex,
            options.subtitleStreamIndex,
            options.liveStreamId
        ).catch(broadcastConnectionErrorMessage);

        if (playbackInfo.ErrorCode) {
            return showPlaybackInfoErrorMessage(playbackInfo.ErrorCode);
        }

        const mediaSource = await getOptimalMediaSource(
            playbackInfo.MediaSources
        );

        if (!mediaSource) {
            return showPlaybackInfoErrorMessage('NoCompatibleStream');
        }

        let itemToPlay = mediaSource;

        if (mediaSource.RequiresOpening) {
            const openLiveStreamResult = await getLiveStream(
                item,
                playbackInfo.PlaySessionId,
                maxBitrate,
                deviceProfile,
                options.startPositionTicks,
                mediaSource,
                null,
                null
            );

            if (openLiveStreamResult.MediaSource) {
                checkDirectPlay(openLiveStreamResult.MediaSource);
                itemToPlay = openLiveStreamResult.MediaSource;
            }
        }

        this.playMediaSource(
            playbackInfo.PlaySessionId,
            item,
            itemToPlay,
            options
        );
    }

    private static playMediaSource(
        playSessionId: string,
        item: BaseItemDto,
        mediaSource: MediaSourceInfo,
        options: any // eslint-disable-line @typescript-eslint/no-explicit-any
    ): void {
        DocumentManager.setAppStatus(AppStatus.Loading);

        const streamInfo = createStreamInfo(
            item,
            mediaSource,
            options.startPositionTicks
        );

        const mediaInfo = createMediaInformation(
            playSessionId,
            item,
            streamInfo
        );
        const loadRequestData = new cast.framework.messages.LoadRequestData();

        loadRequestData.media = mediaInfo;
        loadRequestData.autoplay = true;

        const startPositionTicks =
            mediaInfo.customData?.startPositionTicks ?? -1;

        // If we should seek at the start, translate it
        // to seconds and give it to loadRequestData :)
        if (startPositionTicks > 0) {
            loadRequestData.currentTime = ticksToSeconds(startPositionTicks);
        }

        const isChangingStream = this.playbackState.isChangingStream;

        load(mediaInfo.customData, item);
        this.playbackState.isChangingStream = isChangingStream;
        this.playerManager.load(loadRequestData);

        this.playbackState.PlaybackMediaSource = mediaSource;

        console.log(`setting src to ${streamInfo.url}`);
        this.playbackState.mediaSource = mediaSource;

        DocumentManager.setPlayerBackdrop(item);

        this.playbackState.audioStreamIndex = streamInfo.audioStreamIndex;
        this.playbackState.subtitleStreamIndex = streamInfo.subtitleStreamIndex;

        // We use false as we do not want to broadcast the new status yet
        // we will broadcast manually when the media has been loaded, this
        // is to be sure the duration has been updated in the media element
        this.playerManager.setMediaInformation(mediaInfo, false);
    }

    /**
     * stop playback, as requested by the client
     */
    static stop(): void {
        this.playerManager.stop();
        // onStop will be called when playback comes to a halt.
    }

    /**
     * Called when media stops playing.
     * TODO avoid doing this between tracks in a playlist
     */
    static onStop(): void {
        if (this.getNextPlaybackItemInfo()) {
            this.playbackState.playNextItemBool = true;
        } else {
            this.playbackState.playNextItemBool = false;

            DocumentManager.setAppStatus(AppStatus.Waiting);

            stopPingInterval();

            DocumentManager.startBackdropInterval();
        }
    }

    /**
     * Get information about the next item to play from window.playlist
     * @returns item and index, or null to end playback
     */
    static getNextPlaybackItemInfo(): ItemIndex | null {
        if (this.activePlaylist.length < 1) {
            return null;
        }

        let newIndex: number;

        if (this.activePlaylistIndex < 0) {
            // negative = play the first item
            newIndex = 0;
        } else {
            switch (window.repeatMode) {
                case RepeatMode.RepeatOne:
                    newIndex = this.activePlaylistIndex;
                    break;
                case RepeatMode.RepeatAll:
                    newIndex = this.activePlaylistIndex + 1;

                    if (newIndex >= this.activePlaylist.length) {
                        newIndex = 0;
                    }

                    break;
                default:
                    newIndex = this.activePlaylistIndex + 1;
                    break;
            }
        }

        if (newIndex < this.activePlaylist.length) {
            return {
                index: newIndex,
                item: this.activePlaylist[newIndex]
            };
        }

        return null;
    }

    /**
     * Attempt to clean the receiver state.
     */
    static resetPlaybackScope(): void {
        DocumentManager.setAppStatus(AppStatus.Waiting);

        this.playbackState.startPositionTicks = 0;
        DocumentManager.setWaitingBackdrop(null, null);
        this.playbackState.mediaType = '';
        this.playbackState.itemId = '';

        this.playbackState.audioStreamIndex = null;
        this.playbackState.subtitleStreamIndex = null;
        this.playbackState.mediaSource = null;
        this.playbackState.mediaSourceId = '';
        this.playbackState.PlaybackMediaSource = null;

        this.playbackState.playMethod = undefined;
        this.playbackState.canSeek = false;
        this.playbackState.isChangingStream = false;
        this.playbackState.playNextItemBool = true;

        this.playbackState.item = null;
        this.playbackState.liveStreamId = '';
        this.playbackState.playSessionId = '';

        // Detail content
        DocumentManager.setLogo(null);
        DocumentManager.setDetailImage(null);
    }
}
