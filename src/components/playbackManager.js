import {
    getNextPlaybackItemInfo,
    getIntros,
    setAppStatus,
    broadcastConnectionErrorMessage,
    tagItems,
    getReportingParams
} from "../helpers";

import {
    onStopPlayerBeforePlaybackDone,
    getMaxBitrate,
    getDeviceProfile,
    getOptimalMediaSource,
    validatePlaybackInfoResult,
    showPlaybackInfoErrorMessage,
    supportsDirectPlay
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

        getIntros(firstItem.serverAddress, firstItem.accessToken, firstItem.userId, firstItem).then(function (intros) {

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

        getMaxBitrate(item.MediaType).then(function (maxBitrate) {

            var deviceProfile = getDeviceProfile(maxBitrate);

            jellyfinActions.getPlaybackInfo(item, maxBitrate, deviceProfile, options.startPositionTicks, options.mediaSourceId, options.audioStreamIndex, options.subtitleStreamIndex).then(function (result) {

                if (validatePlaybackInfoResult(result)) {

                    var mediaSource = getOptimalMediaSource(result.MediaSources);

                    if (mediaSource) {

                        if (mediaSource.RequiresOpening) {

                            jellyfinActions.getLiveStream(item, result.PlaySessionId, maxBitrate, deviceProfile, options.startPositionTicks, mediaSource, null, null).then(function (openLiveStreamResult) {

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
