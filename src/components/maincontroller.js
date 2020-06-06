/* eslint-disable */

import { factory as jellyfinActions } from "./jellyfinactions";
import { ajax } from "./fetchhelper";
import { getDeviceProfile as deviceProfileBuilder } from "./deviceprofilebuilder";
import {
    getUrl,
    getCurrentPositionTicks,
    getReportingParams,
    getNextPlaybackItemInfo,
    resetPlaybackScope,
    getMetadata,
    createStreamInfo,
    getStreamByIndex,
    getSecurityHeaders,
    getShuffleItems,
    getInstantMixItems,
    getIntros,
    translateRequestedItems,
    setAppStatus,
    extend,
    broadcastToMessageBus,
    broadcastConnectionErrorMessage,
    cleanName,
    tagItems
} from "../helpers";

import { commandHandler } from "./commandHandler";

window.castReceiverContext = cast.framework.CastReceiverContext.getInstance();
window.mediaManager = window.castReceiverContext.getPlayerManager();
window.mediaManager.addEventListener(cast.framework.events.category.CORE,
    event => {
        console.log("Core event: " + event.type);
        console.log(event);
    });

const playbackConfig = new cast.framework.PlaybackConfig();
// Set the player to start playback as soon as there are five seconds of
// media content buffered. Default is 10.
playbackConfig.autoResumeDuration = 5;

var init = function () {

    resetPlaybackScope($scope);
};

init();

var mgr = window.mediaManager;

var broadcastToServer = new Date();

export function onMediaElementTimeUpdate(e) {
    if ($scope.isChangingStream) {
        return;
    }

    var now = new Date();

    var elapsed = now - broadcastToServer;

    if (elapsed > 5000) {
        // TODO use status as input
        jellyfinActions.reportPlaybackProgress($scope, getReportingParams($scope));
        broadcastToServer = now;
    } else if (elapsed > 1500) {
        // TODO use status as input
        jellyfinActions.reportPlaybackProgress($scope, getReportingParams($scope), false);
    }
}

export function onMediaElementPause() {

    if ($scope.isChangingStream) {
        return;
    }

    reportEvent('playstatechange', true);
}

export function onMediaElementPlaying() {

    if ($scope.isChangingStream) {
        return;
    }
    reportEvent('playstatechange', true);
}

export function onMediaElementVolumeChange() {

    var volume = window.mediaElement.volume;
    window.VolumeInfo.Level = volume * 100;
    window.VolumeInfo.IsMuted = volume == 0;

    reportEvent('volumechange', true);
}

export function enableTimeUpdateListener() {
    window.mediaManager.addEventListener(cast.framework.events.EventType.TIME_UPDATE, onMediaElementTimeUpdate);
    window.mediaManager.addEventListener(cast.framework.events.EventType.REQUEST_VOLUME_CHANGE, onMediaElementVolumeChange);
    window.mediaManager.addEventListener(cast.framework.events.EventType.PAUSE, onMediaElementPause);
    window.mediaManager.addEventListener(cast.framework.events.EventType.PLAYING, onMediaElementPlaying);
}

export function disableTimeUpdateListener() {
    window.mediaManager.removeEventListener(cast.framework.events.EventType.TIME_UPDATE, onMediaElementTimeUpdate);
    window.mediaManager.removeEventListener(cast.framework.events.EventType.REQUEST_VOLUME_CHANGE, onMediaElementVolumeChange);
    window.mediaManager.removeEventListener(cast.framework.events.EventType.PAUSE, onMediaElementPause);
    window.mediaManager.removeEventListener(cast.framework.events.EventType.PLAYING, onMediaElementPlaying);
}

enableTimeUpdateListener();

export function isPlaying() {
    return window.mediaManager.getPlayerState() === cast.framework.messages.PlayerState.PLAYING;
}

window.addEventListener('beforeunload', function () {
    // Try to cleanup after ourselves before the page closes
    disableTimeUpdateListener();
    jellyfinActions.reportPlaybackStopped($scope, getReportingParams($scope));
});

mgr.defaultOnPlay = function (event) {

    jellyfinActions.play($scope, event);
    jellyfinActions.reportPlaybackProgress($scope, getReportingParams($scope));
};
mgr.addEventListener('PLAY', mgr.defaultOnPlay);

mgr.defaultOnPause = function (event) {
    jellyfinActions.reportPlaybackProgress($scope, getReportingParams($scope));
};
mgr.addEventListener('PAUSE', mgr.defaultOnPause);

mgr.defaultOnStop = function (event) {
    stop();
};
mgr.addEventListener('ABORT', mgr.defaultOnStop);

mgr.addEventListener('ENDED', function () {

    // Ignore
    if ($scope.isChangingStream) {
        return;
    }

    jellyfinActions.reportPlaybackStopped($scope, getReportingParams($scope));
    init();

    if (!playNextItem()) {
        window.playlist = [];
        window.currentPlaylistIndex = -1;
        jellyfinActions.displayUserInfo($scope, $scope.serverAddress, $scope.accessToken, $scope.userId);
    }
});

export function stop(nextMode) {

    $scope.playNextItem = nextMode ? true : false;
    jellyfinActions.stop($scope);

    var reportingParams = getReportingParams($scope);

    var promise;

    jellyfinActions.stopPingInterval();

    if (reportingParams.ItemId) {
        promise = jellyfinActions.reportPlaybackStopped($scope, reportingParams);
    }

    window.mediaManager.stop();

    window.playlist = [];
    window.currentPlaylistIndex = -1;
    jellyfinActions.displayUserInfo($scope, $scope.serverAddress, $scope.accessToken, $scope.userId);

    promise = promise || Promise.resolve();

    return promise;
}

window.castReceiverContext.addEventListener(cast.framework.system.EventType.SYSTEM_VOLUME_CHANGED, function (event) {
    console.log("### Cast Receiver Manager - System Volume Changed : " + JSON.stringify(event.data));

    if ($scope.userId != null) {
        reportEvent('volumechange', true);
    }
});

// Set the active subtitle track once the player has loaded
window.mediaManager.addEventListener(
    cast.framework.events.EventType.PLAYER_LOAD_COMPLETE, () => {
        setTextTrack(window.mediaManager.getMediaInformation().customData.subtitleStreamIndex);
    }
);

console.log('Application is ready, starting system');

export function processMessage(data) {

    if (!data.command || !data.serverAddress || !data.userId || !data.accessToken) {

        console.log('Invalid message sent from sender. Sending error response');

        broadcastToMessageBus({
            type: 'error',
            message: "Missing one or more required params - command,options,userId,accessToken,serverAddress"
        });
        return;
    }

    $scope.userId = data.userId;
    $scope.accessToken = data.accessToken;
    $scope.serverAddress = data.serverAddress;
    if (data.subtitleAppearance) {
        window.subtitleAppearance = data.subtitleAppearance;
    }

    // Report device capabilities
    if (!window.hasReportedCapabilities) {
        getMaxBitrate("Video").then((maxBitrate) => {
            let capabilitiesUrl = $scope.serverAddress + "/Sessions/Capabilities/Full";
            let deviceProfile = getDeviceProfile(maxBitrate);

            let capabilities = {
                PlayableMediaTypes: ["Audio", "Video"],
                SupportsPersistentIdentifier: false,
                SupportsMediaControl: true,
                DeviceProfile: deviceProfile
            };
            window.hasReportedCapabilities = true;
            return ajax({
                url: capabilitiesUrl,
                headers: getSecurityHeaders($scope.accessToken, $scope.userId),
                type: 'POST',
                data: JSON.stringify(capabilities),
                contentType: 'application/json'
            });
        });
    }

    data.options = data.options || {};
    var cleanReceiverName = cleanName(data.receiverName || '');
    window.deviceInfo.deviceName = cleanReceiverName || window.deviceInfo.deviceName;
    // deviceId just needs to be unique-ish
    window.deviceInfo.deviceId = cleanReceiverName ? btoa(cleanReceiverName) : window.deviceInfo.deviceId;

    if (data.maxBitrate) {
        window.MaxBitrate = data.maxBitrate;
    }

    // Items will have properties - Id, Name, Type, MediaType, IsFolder

    window.reportEventType;

    let cmdHandler = window.commandHandler;

    if (!cmdHandler) {
        window.commandHandler = new commandHandler(window.castReceiverContext, window.mediaManager);
        cmdHandler = window.commandHandler;
    }

    cmdHandler.processMessage(data, data.command);

    if (window.reportEventType) {
        var report = function () {
            jellyfinActions.reportPlaybackProgress($scope, getReportingParams($scope));
        };
        jellyfinActions.reportPlaybackProgress($scope, getReportingParams($scope), true, window.reportEventType);
        setTimeout(report, 100);
        setTimeout(report, 500);
    }
}

export function reportEvent(name, reportToServer) {
    jellyfinActions.reportPlaybackProgress($scope, getReportingParams($scope), reportToServer, name);
}

export function setSubtitleStreamIndex($scope, index, serverAddress) {
    console.log('setSubtitleStreamIndex. index: ' + index);

    var currentSubtitleStream = $scope.mediaSource.MediaStreams.filter(function (m) {
        return m.Index == $scope.subtitleStreamIndex && m.Type == 'Subtitle';
    })[0];
    var currentDeliveryMethod = currentSubtitleStream ? currentSubtitleStream.DeliveryMethod : null;

    if (index == -1 || index == null) {
        // Need to change the stream to turn off the subs
        if (currentDeliveryMethod == 'Encode') {
            console.log('setSubtitleStreamIndex video url change required');
            var positionTicks = getCurrentPositionTicks($scope);
            changeStream(positionTicks, {
                SubtitleStreamIndex: -1
            });
        } else {
            $scope.subtitleStreamIndex = -1;
            setTextTrack(null);
        }
        return;
    }

    var mediaStreams = $scope.PlaybackMediaSource.MediaStreams;

    var subtitleStream = getStreamByIndex(mediaStreams, 'Subtitle', index);

    if (!subtitleStream) {
        console.log('setSubtitleStreamIndex error condition - subtitle stream not found.');
        return;
    }

    console.log('setSubtitleStreamIndex DeliveryMethod:' + subtitleStream.DeliveryMethod);

    if (subtitleStream.DeliveryMethod == 'External' || currentDeliveryMethod == 'Encode') {

        var textStreamUrl = subtitleStream.IsExternalUrl ? subtitleStream.DeliveryUrl : getUrl(serverAddress, subtitleStream.DeliveryUrl);

        console.log('Subtitle url: ' + textStreamUrl);
        setTextTrack(index);
        $scope.subtitleStreamIndex = subtitleStream.Index;
        return;
    } else {
        console.log('setSubtitleStreamIndex video url change required');
        var positionTicks = getCurrentPositionTicks($scope);
        changeStream(positionTicks, {
            SubtitleStreamIndex: index
        });
    }
}

export function setAudioStreamIndex($scope, index) {
    var positionTicks = getCurrentPositionTicks($scope);
    changeStream(positionTicks, {
        AudioStreamIndex: index
    });
}

export function seek(ticks) {
    changeStream(ticks);
}

export function changeStream(ticks, params) {
    if (ticks) {
        ticks = parseInt(ticks);
    }

    if (window.mediaManager.getMediaInformation().customData.canClientSeek && params == null) {

        window.mediaManager.seek(ticks / 10000000);
        jellyfinActions.reportPlaybackProgress($scope, getReportingParams($scope));
        return;
    }

    params = params || {};

    var playSessionId = $scope.playSessionId;
    var liveStreamId = $scope.liveStreamId;

    var item = $scope.item;
    var mediaType = item.MediaType;

    // TODO untangle this shitty callback mess
    getMaxBitrate(mediaType).then(function (maxBitrate) {
        var deviceProfile = getDeviceProfile(maxBitrate);

        var audioStreamIndex = params.AudioStreamIndex == null ? $scope.audioStreamIndex : params.AudioStreamIndex;
        var subtitleStreamIndex = params.SubtitleStreamIndex == null ? $scope.subtitleStreamIndex : params.SubtitleStreamIndex;

        jellyfinActions.getPlaybackInfo(item, maxBitrate, deviceProfile, ticks, $scope.mediaSourceId, audioStreamIndex, subtitleStreamIndex, liveStreamId).then(function (result) {
            if (validatePlaybackInfoResult(result)) {
                var mediaSource = result.MediaSources[0];

                var streamInfo = createStreamInfo(item, mediaSource, ticks);

                if (!streamInfo.url) {
                    showPlaybackInfoErrorMessage('NoCompatibleStream');
                    return;
                }

                var mediaInformation = createMediaInformation(playSessionId, item, streamInfo);
                var loadRequest = new cast.framework.messages.LoadRequestData();
                loadRequest.media = mediaInformation;
                loadRequest.autoplay = true;

                new Promise((resolve, reject) => {
                    // TODO something to do with HLS?
                    var requiresStoppingTranscoding = false;
                    if (requiresStoppingTranscoding) {
                        window.mediaManager.pause();
                        jellyfinActions.stopActiveEncodings(playSessionId).then(function () {
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                }).then(() => {
                    window.mediaManager.load(loadRequest);
                    window.mediaManager.play();
                    $scope.subtitleStreamIndex = subtitleStreamIndex;
                    $scope.audioStreamIndex = audioStreamIndex;
                });
            }
        });
    });
}

// Create a message handler for the custome namespace channel
// TODO save namespace somewhere global?
window.castReceiverContext.addCustomMessageListener('urn:x-cast:com.connectsdk', function (evt) {
    console.log('Playlist message: ' + JSON.stringify(evt));

    var data = evt.data;

    data.options = data.options || {};
    data.options.senderId = evt.senderId;
    // TODO set it somewhere better perhaps
    window.senderId = evt.senderId;

    processMessage(data);
});

export function translateItems(data, options, items, method) {
    var callback = function (result) {
        options.items = result.Items;
        tagItems(options.items, data);

        if (method == 'PlayNext' || method == 'PlayLast') {
            queue(options.items, method);
        } else {
            playFromOptions(data.options);
        }
    };

    var smartTranslate = method != 'PlayNext' && method != 'PlayLast';
    translateRequestedItems(data.serverAddress, data.accessToken, data.userId, items, smartTranslate).then(callback);
}

export function instantMix(data, options, item) {
    getInstantMixItems(data.serverAddress, data.accessToken, data.userId, item).then(function (result) {

        options.items = result.Items;
        tagItems(options.items, data);
        playFromOptions(data.options);
    });
}

export function shuffle(data, options, item) {
    getShuffleItems(data.serverAddress, data.accessToken, data.userId, item).then(function (result) {
        options.items = result.Items;
        tagItems(options.items, data);
        playFromOptions(data.options);
    });
}

export function queue(items) {
    for (var i = 0, length = items.length; i < length; i++) {
        window.playlist.push(items[i]);
    }
}

export function playFromOptions(options) {
    var firstItem = options.items[0];

    if (options.startPositionTicks || firstItem.MediaType !== 'Video') {
        playFromOptionsInternal(options);
        return;
    }

    getIntros(firstItem.serverAddress, firstItem.accessToken, firstItem.userId, firstItem).then(function (intros) {

        tagItems(intros.Items, {
            userId: firstItem.userId,
            accessToken: firstItem.accessToken,
            serverAddress: firstItem.serverAddress
        });

        options.items = intros.Items.concat(options.items);
        playFromOptionsInternal(options);
    });
}

export function playFromOptionsInternal(options) {

    var stopPlayer = window.playlist && window.playlist.length > 0;

    window.playlist = options.items;
    window.currentPlaylistIndex = -1;
    playNextItem(options, stopPlayer);
}

// Plays the next item in the list
export function playNextItem(options, stopPlayer) {

    var nextItemInfo = getNextPlaybackItemInfo();

    if (nextItemInfo) {
        window.currentPlaylistIndex = nextItemInfo.index;

        var item = nextItemInfo.item;

        playItem(item, options || {}, stopPlayer);
        return true;
    }

    return false;
}

export function playPreviousItem(options) {

    var playlist = window.playlist;

    if (playlist && window.currentPlaylistIndex > 0) {
        window.currentPlaylistIndex--;

        var item = playlist[window.currentPlaylistIndex];

        playItem(item, options || {}, true);
        return true;
    }
    return false;
}

export function playItem(item, options, stopPlayer) {

    var callback = function () {
        onStopPlayerBeforePlaybackDone(item, options);
    };

    if (stopPlayer) {

        stop("none").then(callback);
    } else {
        callback();
    }
}

export function onStopPlayerBeforePlaybackDone(item, options) {

    var requestUrl = getUrl(item.serverAddress, 'Users/' + item.userId + '/Items/' + item.Id);

    return ajax({

        url: requestUrl,
        headers: getSecurityHeaders(item.accessToken, item.userId),
        dataType: 'json',
        type: 'GET'

    }).then(function (data) {

        // Attach the custom properties we created like userId, serverAddress, itemId, etc
        extend(data, item);

        playItemInternal(data, options);

    }, broadcastConnectionErrorMessage);
}

export function getDeviceProfile(maxBitrate) {

    let transcodingAudioChannels = document.createElement('video').canPlayType('audio/mp4; codecs="ac-3"').replace(/no/, '') ?
        6 :
        2;

    return deviceProfileBuilder({
        supportsCustomSeeking: true,
        audioChannels: transcodingAudioChannels
    });

}

export function playItemInternal(item, options) {

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
                            playMediaSource(result.PlaySessionId, item, openLiveStreamResult.MediaSource, options);
                        });

                    } else {
                        playMediaSource(result.PlaySessionId, item, mediaSource, options);
                    }
                } else {
                    showPlaybackInfoErrorMessage('NoCompatibleStream');
                }
            }

        }, broadcastConnectionErrorMessage);
    });
}

var lastBitrateDetect = 0;
var detectedBitrate = 0;
export function getMaxBitrate(mediaType) {

    console.log('getMaxBitrate');

    return new Promise(function (resolve, reject) {

        if (window.MaxBitrate) {
            console.log('bitrate is set to ' + window.MaxBitrate);

            resolve(window.MaxBitrate);
            return;
        }

        if (detectedBitrate && (new Date().getTime() - lastBitrateDetect) < 600000) {
            console.log('returning previous detected bitrate of ' + detectedBitrate);
            resolve(detectedBitrate);
            return;
        }

        if (mediaType != 'Video') {
            // We don't need to bother with bitrate detection for music
            resolve(window.DefaultMaxBitrate);
            return;
        }

        console.log('detecting bitrate');

        jellyfinActions.detectBitrate($scope).then(function (bitrate) {

            console.log('Max bitrate auto detected to ' + bitrate);
            lastBitrateDetect = new Date().getTime();
            detectedBitrate = bitrate;

            resolve(detectedBitrate);

        }, function () {

            console.log('Error detecting bitrate, will return default value.');
            resolve(window.DefaultMaxBitrate);
        });
    });
}

export function validatePlaybackInfoResult(result) {

    if (result.ErrorCode) {

        showPlaybackInfoErrorMessage(result.ErrorCode);
        return false;
    }

    return true;
}

export function showPlaybackInfoErrorMessage(errorCode) {

    broadcastToMessageBus({
        type: 'playbackerror',
        message: errorCode
    });
}

export function getOptimalMediaSource(versions) {

    var optimalVersion = versions.filter(function (v) {

        v.enableDirectPlay = supportsDirectPlay(v);

        return v.enableDirectPlay;

    })[0];

    if (!optimalVersion) {
        optimalVersion = versions.filter(function (v) {

            return v.SupportsDirectStream;

        })[0];
    }

    return optimalVersion || versions.filter(function (s) {
        return s.SupportsTranscoding;
    })[0];
}

export function supportsDirectPlay(mediaSource) {

    if (mediaSource.SupportsDirectPlay && mediaSource.Protocol == 'Http' && !mediaSource.RequiredHttpHeaders.length) {

        // TODO: Need to verify the host is going to be reachable
        return true;
    }

    return false;
}

export function setTextTrack(index) {
    try {
        var textTracksManager = window.mediaManager.getTextTracksManager();
        if (index == null) {
            textTracksManager.setActiveByIds(null);
            return;
        }

        var tracks = textTracksManager.getTracks();
        var subtitleTrack = tracks.find(function (track) {
            return track.trackId === index;
        });
        if (subtitleTrack) {
            textTracksManager.setActiveByIds([subtitleTrack.trackId]);
            var subtitleAppearance = window.subtitleAppearance;
            if (subtitleAppearance) {
                var textTrackStyle = new cast.framework.messages.TextTrackStyle();
                if (subtitleAppearance.dropShadow != null) {
                    // Empty string is DROP_SHADOW
                    textTrackStyle.edgeType = subtitleAppearance.dropShadow.toUpperCase() || cast.framework.messages.TextTrackEdgeType.DROP_SHADOW;
                    textTrackStyle.edgeColor = "#000000FF";
                }

                if (subtitleAppearance.font) {
                    textTrackStyle.fontFamily = subtitleAppearance.font;
                }

                if (subtitleAppearance.textColor) {
                    // Append the transparency, hardcoded to 100%
                    textTrackStyle.foregroundColor = subtitleAppearance.textColor + "FF";
                }

                if (subtitleAppearance.textBackground === "transparent") {
                    textTrackStyle.backgroundColor = "#00000000" // RGBA
                }

                switch (subtitleAppearance.textSize) {
                    case 'smaller':
                        textTrackStyle.fontScale = 0.6;
                        break;
                    case 'small':
                        textTrackStyle.fontScale = 0.8;
                        break;
                    case 'large':
                        textTrackStyle.fontScale = 1.15;
                        break;
                    case 'larger':
                        textTrackStyle.fontScale = 1.3;
                        break;
                    case 'extralarge':
                        textTrackStyle.fontScale = 1.45;
                        break;
                    default:
                        textTrackStyle.fontScale = 1.0;
                        break;
                }
                textTracksManager.setTextTrackStyle(textTrackStyle);
            }
        }
    } catch (e) {
        console.log("Setting subtitle track failed: " + e);
    }
}

export function createMediaInformation(playSessionId, item, streamInfo) {
    var mediaInfo = new cast.framework.messages.MediaInformation();
    mediaInfo.contentId = streamInfo.url;
    mediaInfo.contentType = streamInfo.contentType;
    mediaInfo.customData = {
        startPositionTicks: streamInfo.startPositionTicks || 0,
        serverAddress: item.serverAddress,
        userId: item.userId,
        itemId: item.Id,
        mediaSourceId: streamInfo.mediaSource.Id,
        audioStreamIndex: streamInfo.audioStreamIndex,
        subtitleStreamIndex: streamInfo.subtitleStreamIndex,
        playMethod: streamInfo.isStatic ? 'DirectStream' : 'Transcode',
        runtimeTicks: streamInfo.mediaSource.RunTimeTicks,
        liveStreamId: streamInfo.mediaSource.LiveStreamId,
        accessToken: item.accessToken,
        canSeek: streamInfo.canSeek,
        canClientSeek: streamInfo.canClientSeek,
        playSessionId: playSessionId
    }

    mediaInfo.metadata = getMetadata(item);

    mediaInfo.streamType = cast.framework.messages.StreamType.BUFFERED;
    mediaInfo.tracks = streamInfo.tracks;

    if (streamInfo.mediaSource.RunTimeTicks) {
        mediaInfo.duration = Math.floor(streamInfo.mediaSource.RunTimeTicks / 10000000);
    }

    mediaInfo.customData.startPositionTicks = streamInfo.startPosition || 0;

    return mediaInfo;
}

export function playMediaSource(playSessionId, item, mediaSource, options) {

    setAppStatus('loading');

    var streamInfo = createStreamInfo(item, mediaSource, options.startPositionTicks);

    var url = streamInfo.url;

    var mediaInfo = createMediaInformation(playSessionId, item, streamInfo);
    var loadRequestData = new cast.framework.messages.LoadRequestData();
    loadRequestData.media = mediaInfo;
    loadRequestData.autoplay = true;

    jellyfinActions.load($scope, mediaInfo.customData, item);
    window.mediaManager.load(loadRequestData);

    $scope.PlaybackMediaSource = mediaSource;

    console.log('setting src to ' + url);
    $scope.mediaSource = mediaSource;

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
    window.mediaManager.setMediaInformation(mediaInfo, false);
}

playbackConfig.supportedCommands = cast.framework.messages.Command.ALL_BASIC_MEDIA;

// Set the available buttons in the UI controls.
const controls = cast.framework.ui.Controls.getInstance();
controls.clearDefaultSlotAssignments();

/* Disabled for now, dynamically set controls for each media type in the future.
// Assign buttons to control slots.
controls.assignButton(
    cast.framework.ui.ControlsSlot.SLOT_SECONDARY_1,
    cast.framework.ui.ControlsButton.CAPTIONS
);*/

controls.assignButton(
    cast.framework.ui.ControlsSlot.SLOT_PRIMARY_1,
    cast.framework.ui.ControlsButton.SEEK_BACKWARD_15
);
controls.assignButton(
    cast.framework.ui.ControlsSlot.SLOT_PRIMARY_2,
    cast.framework.ui.ControlsButton.SEEK_FORWARD_15
);

window.castReceiverContext.start(playbackConfig);
