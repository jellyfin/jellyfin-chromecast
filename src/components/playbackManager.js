import {
    getNextPlaybackItemInfo,
    getIntros,
    setAppStatus,
    broadcastConnectionErrorMessage,
    tagItems,
    getReportingParams,
    createStreamInfo
} from "../helpers";

import {
    onStopPlayerBeforePlaybackDone,
    getMaxBitrate,
    getDeviceProfile,
    getOptimalMediaSource,
    validatePlaybackInfoResult,
    showPlaybackInfoErrorMessage,
    supportsDirectPlay,
    createMediaInformation
} from "./maincontroller";

import { factory as jellyfinActions } from "./jellyfinactions";

export class playbackManager {
    constructor(castContext, playerManager) {
        // Parameters
        this.castContext = castContext;
        this.playerManager = playerManager;

        // Properties
        this.activePlaylist = [];
        this.activePlaylistIndex = 0;
    }

    isPlaying() {
        return this.playerManager.getPlayerState() === cast.framework.messages.PlayerState.PLAYING;
    }

    playFromOptions(options) {
        var firstItem = options.items[0];

        if (options.startPositionTicks || firstItem.MediaType !== 'Video') {
            this.playFromOptionsInternal(options);
            return;
        }

        getIntros(firstItem.serverAddress, firstItem.accessToken, firstItem.userId, firstItem).then(intros => {

            tagItems(intros.Items, {
                userId: firstItem.userId,
                accessToken: firstItem.accessToken,
                serverAddress: firstItem.serverAddress
            });

            options.items = intros.Items.concat(options.items);
            this.playFromOptionsInternal(options);
        });
    }

    playFromOptionsInternal(options) {

        var stopPlayer = this.activePlaylist && this.activePlaylist.length > 0;

        this.activePlaylist = options.items;
        this.activePlaylist.currentPlaylistIndex = -1;
        window.playlist = this.activePlaylist;

        this.playNextItem(options, stopPlayer);
    }

    // Plays the next item in the list
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

    playItem(item, options, stopPlayer) {

        var callback = function () {
            onStopPlayerBeforePlaybackDone(item, options);
        };

        if (stopPlayer) {

            this.stop("none").then(callback);
        } else {
            callback();
        }
    }

    playItemInternal(item, options) {

        $scope.isChangingStream = false;
        setAppStatus('loading');

        getMaxBitrate(item.MediaType).then(maxBitrate => {

            var deviceProfile = getDeviceProfile(maxBitrate);

            jellyfinActions.getPlaybackInfo(item, maxBitrate, deviceProfile, options.startPositionTicks, options.mediaSourceId, options.audioStreamIndex, options.subtitleStreamIndex).then(result => {

                if (validatePlaybackInfoResult(result)) {

                    var mediaSource = getOptimalMediaSource(result.MediaSources);

                    if (mediaSource) {

                        if (mediaSource.RequiresOpening) {

                            jellyfinActions.getLiveStream(item, result.PlaySessionId, maxBitrate, deviceProfile, options.startPositionTicks, mediaSource, null, null).then(openLiveStreamResult => {

                                openLiveStreamResult.MediaSource.enableDirectPlay = supportsDirectPlay(openLiveStreamResult.MediaSource);
                                this.playMediaSource(result.PlaySessionId, item, openLiveStreamResult.MediaSource, options);
                            });

                        } else {
                            this.playMediaSource(result.PlaySessionId, item, mediaSource, options);
                        }
                    } else {
                        showPlaybackInfoErrorMessage('NoCompatibleStream');
                    }
                }

            }, broadcastConnectionErrorMessage);
        });
    }

    playMediaSource(playSessionId, item, mediaSource, options) {

        setAppStatus('loading');

        var streamInfo = createStreamInfo(item, mediaSource, options.startPositionTicks);

        var url = streamInfo.url;

        var mediaInfo = createMediaInformation(playSessionId, item, streamInfo);
        var loadRequestData = new cast.framework.messages.LoadRequestData();
        loadRequestData.media = mediaInfo;
        loadRequestData.autoplay = true;

        jellyfinActions.load($scope, mediaInfo.customData, item);
        this.playerManager.load(loadRequestData);

        $scope.PlaybackMediaSource = mediaSource;

        console.log('setting src to ' + url);
        $scope.mediaSource = mediaSource;

        let backdropUrl;
        if (item.BackdropImageTags && item.BackdropImageTags.length) {
            backdropUrl = $scope.serverAddress + '/emby/Items/' + item.Id + '/Images/Backdrop/0?tag=' + item.BackdropImageTags[0];
        } else if (item.ParentBackdropItemId && item.ParentBackdropImageTags && item.ParentBackdropImageTags.length) {
            backdropUrl = $scope.serverAddress + '/emby/Items/' + item.ParentBackdropItemId + '/Images/Backdrop/0?tag=' + item.ParentBackdropImageTags[0];
        }

        if (backdropUrl) {
            window.mediaElement.style.setProperty('--background-image', 'url("' + backdropUrl + '")');
        } else {
            //Replace with a placeholder?
            window.mediaElement.style.removeProperty('--background-image');
        }

        jellyfinActions.reportPlaybackStart($scope, getReportingParams($scope));

        // We use false as we do not want to broadcast the new status yet
        // we will broadcast manually when the media has been loaded, this
        // is to be sure the duration has been updated in the media element
        this.playerManager.setMediaInformation(mediaInfo, false);
    }

    stop(nextMode) {

        $scope.playNextItem = nextMode ? true : false;
        jellyfinActions.stop($scope);

        var reportingParams = getReportingParams($scope);

        var promise;

        jellyfinActions.stopPingInterval();

        if (reportingParams.ItemId) {
            promise = jellyfinActions.reportPlaybackStopped($scope, reportingParams);
        }

        this.playerManager.stop();

        this.activePlaylist = [];
        this.activePlaylistIndex = -1;
        jellyfinActions.displayUserInfo($scope, $scope.serverAddress, $scope.accessToken, $scope.userId);

        promise = promise || Promise.resolve();

        return promise;
    }
}
