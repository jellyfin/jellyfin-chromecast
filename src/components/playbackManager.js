import {
    getNextPlaybackItemInfo,
    getIntros,
    setAppStatus,
    broadcastConnectionErrorMessage,
    getReportingParams,
    createStreamInfo
} from '../helpers';

import {
    onStopPlayerBeforePlaybackDone,
    getMaxBitrate,
    getDeviceProfile,
    getOptimalMediaSource,
    showPlaybackInfoErrorMessage,
    supportsDirectPlay,
    createMediaInformation
} from './maincontroller';

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

import { JellyfinApi } from './jellyfinApi';

export class playbackManager {
    constructor(playerManager) {
        // Parameters
        this.playerManager = playerManager;

        // Properties
        this.activePlaylist = [];
        this.activePlaylistIndex = 0;
    }

    isPlaying() {
        return (
            this.playerManager.getPlayerState() ===
            cast.framework.messages.PlayerState.PLAYING
        );
    }

    async playFromOptions(options) {
        const firstItem = options.items[0];

        if (options.startPositionTicks || firstItem.MediaType !== 'Video') {
            this.playFromOptionsInternal(options);
            return;
        }

        let intros = await getIntros(firstItem);
        options.items = intros.Items.concat(options.items);
        this.playFromOptionsInternal(options);
    }

    playFromOptionsInternal(options) {
        const stopPlayer =
            this.activePlaylist && this.activePlaylist.length > 0;

        this.activePlaylist = options.items;
        this.activePlaylist.currentPlaylistIndex = -1;
        window.playlist = this.activePlaylist;

        this.playNextItem(options, stopPlayer);
    }

    playNextItem(options, stopPlayer) {
        var nextItemInfo = getNextPlaybackItemInfo();

        if (nextItemInfo) {
            this.activePlaylistIndex = nextItemInfo.index;

            var item = nextItemInfo.item;

            this.playItem(item, options || {}, stopPlayer);
            return true;
        }

        return false;
    }

    playPreviousItem(options) {
        if (this.activePlaylist && this.activePlaylistIndex > 0) {
            this.activePlaylistIndex--;

            var item = this.activePlaylist[this.activePlaylistIndex];

            this.playItem(item, options || {}, true);
            return true;
        }
        return false;
    }

    async playItem(item, options, stopPlayer) {
        if (stopPlayer) {
            await this.stop('none');
        }

        onStopPlayerBeforePlaybackDone(item, options);
    }

    async playItemInternal(item, options) {
        $scope.isChangingStream = false;
        setAppStatus('loading');

        const maxBitrate = await getMaxBitrate();
        const deviceProfile = getDeviceProfile(maxBitrate);
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
            openLiveStreamResult.MediaSource.enableDirectPlay = supportsDirectPlay(
                openLiveStreamResult.MediaSource
            );
            itemToPlay = openLiveStreamResult.MediaSource;
        }

        this.playMediaSource(
            playbackInfo.PlaySessionId,
            item,
            itemToPlay,
            options
        );
    }

    playMediaSource(playSessionId, item, mediaSource, options) {
        setAppStatus('loading');

        var streamInfo = createStreamInfo(
            item,
            mediaSource,
            options.startPositionTicks
        );

        var url = streamInfo.url;

        var mediaInfo = createMediaInformation(playSessionId, item, streamInfo);
        var loadRequestData = new cast.framework.messages.LoadRequestData();
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
            window.mediaElement.style.setProperty(
                '--background-image',
                'url("' + backdropUrl + '")'
            );
        } else {
            //Replace with a placeholder?
            window.mediaElement.style.removeProperty('--background-image');
        }

        reportPlaybackStart($scope, getReportingParams($scope));

        // We use false as we do not want to broadcast the new status yet
        // we will broadcast manually when the media has been loaded, this
        // is to be sure the duration has been updated in the media element
        this.playerManager.setMediaInformation(mediaInfo, false);
    }

    stop(nextMode) {
        $scope.playNextItem = nextMode ? true : false;
        stop($scope);

        var reportingParams = getReportingParams($scope);

        var promise;

        stopPingInterval();

        if (reportingParams.ItemId) {
            promise = reportPlaybackStopped($scope, reportingParams);
        }

        this.playerManager.stop();

        this.activePlaylist = [];
        this.activePlaylistIndex = -1;
        startBackdropInterval();

        promise = promise || Promise.resolve();

        return promise;
    }
}
