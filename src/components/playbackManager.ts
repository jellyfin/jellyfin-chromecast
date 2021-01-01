import {
    getIntros,
    setAppStatus,
    broadcastConnectionErrorMessage,
    getReportingParams,
    createStreamInfo
} from '../helpers';

import { JellyfinApi } from './jellyfinApi';
import {
    getPlaybackInfo,
    getLiveStream,
    load,
    reportPlaybackStart,
    stop,
    stopPingInterval,
    reportPlaybackStopped,
    startBackdropInterval
} from './jellyfinActions';
import { getDeviceProfile } from './deviceprofileBuilder';

import {
    onStopPlayerBeforePlaybackDone,
    getMaxBitrate,
    getOptimalMediaSource,
    showPlaybackInfoErrorMessage,
    checkDirectPlay,
    createMediaInformation
} from './maincontroller';

import { BaseItemDto } from '~/api/generated/models/base-item-dto';
import { MediaSourceInfo } from '~/api/generated/models/media-source-info';

import { ItemIndex } from '~/types/global';

export abstract class PlaybackManager {
    private static playerManager: cast.framework.PlayerManager;
    private static activePlaylist: Array<BaseItemDto>;
    private static activePlaylistIndex: number;

    static setPlayerManager(playerManager: cast.framework.PlayerManager): void {
        // Parameters
        this.playerManager = playerManager;

        this.resetPlaylist();
    }

    /* This is used to check if we can switch to
     * some other info overlay.
     *
     * Returns true when playing or paused.
     * (before: true only when playing)
     * */
    static isPlaying(): boolean {
        return (
            this.playerManager.getPlayerState() ===
                cast.framework.messages.PlayerState.PLAYING ||
            this.playerManager.getPlayerState() ===
                cast.framework.messages.PlayerState.PAUSED
        );
    }

    static async playFromOptions(options: any): Promise<boolean> {
        const firstItem = options.items[0];

        if (options.startPositionTicks || firstItem.MediaType !== 'Video') {
            return this.playFromOptionsInternal(options);
        }

        const intros = await getIntros(firstItem);
        options.items = intros.Items?.concat(options.items);
        return this.playFromOptionsInternal(options);
    }

    private static playFromOptionsInternal(options: any): boolean {
        const stopPlayer =
            this.activePlaylist && this.activePlaylist.length > 0;

        this.activePlaylist = options.items;
        // We need to set -1 so the next index will be 0
        this.activePlaylistIndex = -1;

        console.log('Loaded new playlist:', this.activePlaylist);

        return this.playNextItem(options, stopPlayer);
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

    static playNextItem(options: any = {}, stopPlayer = false): boolean {
        const nextItemInfo = this.getNextPlaybackItemInfo();

        if (nextItemInfo) {
            this.activePlaylistIndex = nextItemInfo.index;

            this.playItem(options, stopPlayer);
            return true;
        }

        return false;
    }

    static playPreviousItem(options: any = {}): boolean {
        if (this.activePlaylist && this.activePlaylistIndex > 0) {
            this.activePlaylistIndex--;

            this.playItem(options, true);
            return true;
        }
        return false;
    }

    // play item from playlist
    private static async playItem(
        options: any,
        stopPlayer = false
    ): Promise<void> {
        if (stopPlayer) {
            await this.stop(true);
        }

        const item = this.activePlaylist[this.activePlaylistIndex];

        console.log(`Playing index ${this.activePlaylistIndex}`, item);

        return await onStopPlayerBeforePlaybackDone(item, options);
    }

    // Would set private, but some refactorings need to happen first.
    static async playItemInternal(
        item: BaseItemDto,
        options: any
    ): Promise<void> {
        $scope.isChangingStream = false;
        setAppStatus('loading');

        const maxBitrate = await getMaxBitrate();
        const deviceProfile = getDeviceProfile({
            enableHls: true,
            bitrateSetting: maxBitrate
        });
        const playbackInfo = await getPlaybackInfo(
            item,
            maxBitrate,
            deviceProfile,
            options.startPositionTicks,
            options.mediaSourceId,
            options.audioStreamIndex,
            options.subtitleStreamIndex
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
        options: any
    ): void {
        setAppStatus('loading');

        const streamInfo = createStreamInfo(
            item,
            mediaSource,
            options.startPositionTicks
        );

        const url = streamInfo.url;

        const mediaInfo = createMediaInformation(
            playSessionId,
            item,
            streamInfo
        );
        const loadRequestData = new cast.framework.messages.LoadRequestData();
        loadRequestData.media = mediaInfo;
        loadRequestData.autoplay = true;

        load($scope, mediaInfo.customData, item);
        this.playerManager.load(loadRequestData);

        $scope.PlaybackMediaSource = mediaSource;

        console.log('setting src to ' + url);
        $scope.mediaSource = mediaSource;

        let backdropUrl;
        if (item.BackdropImageTags && item.BackdropImageTags.length) {
            backdropUrl = JellyfinApi.createUrl(
                'Items/' +
                    item.Id +
                    '/Images/Backdrop/0?tag=' +
                    item.BackdropImageTags[0]
            );
        } else if (
            item.ParentBackdropItemId &&
            item.ParentBackdropImageTags &&
            item.ParentBackdropImageTags.length
        ) {
            backdropUrl = JellyfinApi.createUrl(
                'Items/' +
                    item.ParentBackdropItemId +
                    '/Images/Backdrop/0?tag=' +
                    item.ParentBackdropImageTags[0]
            );
        }

        if (backdropUrl) {
            window.mediaElement?.style.setProperty(
                '--background-image',
                'url("' + backdropUrl + '")'
            );
        } else {
            //Replace with a placeholder?
            window.mediaElement?.style.removeProperty('--background-image');
        }

        reportPlaybackStart($scope, getReportingParams($scope));

        // We use false as we do not want to broadcast the new status yet
        // we will broadcast manually when the media has been loaded, this
        // is to be sure the duration has been updated in the media element
        this.playerManager.setMediaInformation(mediaInfo, false);
    }

    static stop(continuing = false): Promise<any> {
        $scope.playNextItem = continuing;
        stop();

        const reportingParams = getReportingParams($scope);

        let promise;

        stopPingInterval();

        if (reportingParams.ItemId) {
            promise = reportPlaybackStopped($scope, reportingParams);
        }

        this.playerManager.stop();

        startBackdropInterval();

        promise = promise || Promise.resolve();

        return promise;
    }

    /**
     * Get information about the next item to play from window.playlist
     *
     * @returns ItemIndex including item and index, or null to end playback
     */
    static getNextPlaybackItemInfo(): ItemIndex | null {
        if (this.activePlaylist.length < 1) {
            return null;
        }

        let newIndex: number;

        if (this.activePlaylistIndex < 0) {
            // negative = play the first item
            newIndex = 0;
        } else
            switch (window.repeatMode) {
                case 'RepeatOne':
                    newIndex = this.activePlaylistIndex;
                    break;
                case 'RepeatAll':
                    newIndex = this.activePlaylistIndex + 1;
                    if (newIndex >= this.activePlaylist.length) {
                        newIndex = 0;
                    }
                    break;
                default:
                    newIndex = this.activePlaylistIndex + 1;
                    break;
            }

        if (newIndex < this.activePlaylist.length) {
            return {
                item: this.activePlaylist[newIndex],
                index: newIndex
            };
        }
        return null;
    }
}
