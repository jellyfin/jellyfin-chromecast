import {
    getCurrentPositionTicks,
    getReportingParams,
    resetPlaybackScope,
    getMetadata,
    createStreamInfo,
    getStreamByIndex,
    getShuffleItems,
    getInstantMixItems,
    translateRequestedItems,
    extend,
    broadcastToMessageBus,
    broadcastConnectionErrorMessage,
    cleanName
} from '../helpers';
import {
    reportPlaybackProgress,
    reportPlaybackStopped,
    play,
    getPlaybackInfo,
    stopActiveEncodings,
    detectBitrate
} from './jellyfinActions';
import { getDeviceProfile } from './deviceprofileBuilder';
import { JellyfinApi } from './jellyfinApi';
import { playbackManager } from './playbackManager';
import { CommandHandler } from './commandHandler';
import { getMaxBitrateSupport } from './codecSupportHelper';
import { DocumentManager } from './documentManager';
import { BaseItemDto } from '~/api/generated/models/base-item-dto';
import { MediaSourceInfo } from '~/api/generated/models/media-source-info';
import { GlobalScope, PlayRequest } from '~/types/global';

window.castReceiverContext = cast.framework.CastReceiverContext.getInstance();
window.mediaManager = window.castReceiverContext.getPlayerManager();

const playbackMgr = new playbackManager(window.mediaManager);

CommandHandler.configure(window.mediaManager, playbackMgr);

resetPlaybackScope($scope);

const mgr = window.mediaManager;

let broadcastToServer = new Date();

let hasReportedCapabilities = false;

/**
 *
 */
export function onMediaElementTimeUpdate(): void {
    if ($scope.isChangingStream) {
        return;
    }

    const now = new Date();

    const elapsed = now.valueOf() - broadcastToServer.valueOf();

    if (elapsed > 5000) {
        // TODO use status as input
        reportPlaybackProgress($scope, getReportingParams($scope));
        broadcastToServer = now;
    } else if (elapsed > 1500) {
        // TODO use status as input
        reportPlaybackProgress($scope, getReportingParams($scope), false);
    }
}

/**
 *
 */
export function onMediaElementPause(): void {
    if ($scope.isChangingStream) {
        return;
    }

    reportEvent('playstatechange', true);
}

/**
 *
 */
export function onMediaElementPlaying(): void {
    if ($scope.isChangingStream) {
        return;
    }

    reportEvent('playstatechange', true);
}

/**
 * @param event
 */
function onMediaElementVolumeChange(event: framework.system.Event): void {
    window.volume = (<framework.system.SystemVolumeChangedEvent>event).data;
    console.log(`Received volume update: ${window.volume.level}`);

    if (JellyfinApi.serverAddress !== null) {
        reportEvent('volumechange', true);
    }
}

/**
 *
 */
export function enableTimeUpdateListener(): void {
    window.mediaManager.addEventListener(
        cast.framework.events.EventType.TIME_UPDATE,
        onMediaElementTimeUpdate
    );
    window.castReceiverContext.addEventListener(
        cast.framework.system.EventType.SYSTEM_VOLUME_CHANGED,
        onMediaElementVolumeChange
    );
    window.mediaManager.addEventListener(
        cast.framework.events.EventType.PAUSE,
        onMediaElementPause
    );
    window.mediaManager.addEventListener(
        cast.framework.events.EventType.PLAYING,
        onMediaElementPlaying
    );
}

/**
 *
 */
export function disableTimeUpdateListener(): void {
    window.mediaManager.removeEventListener(
        cast.framework.events.EventType.TIME_UPDATE,
        onMediaElementTimeUpdate
    );
    window.castReceiverContext.removeEventListener(
        cast.framework.system.EventType.SYSTEM_VOLUME_CHANGED,
        onMediaElementVolumeChange
    );
    window.mediaManager.removeEventListener(
        cast.framework.events.EventType.PAUSE,
        onMediaElementPause
    );
    window.mediaManager.removeEventListener(
        cast.framework.events.EventType.PLAYING,
        onMediaElementPlaying
    );
}

enableTimeUpdateListener();

window.addEventListener('beforeunload', () => {
    // Try to cleanup after ourselves before the page closes
    disableTimeUpdateListener();
    reportPlaybackStopped($scope, getReportingParams($scope));
});

mgr.addEventListener(cast.framework.events.EventType.PLAY, (): void => {
    play($scope);
    reportPlaybackProgress($scope, getReportingParams($scope));
});

mgr.addEventListener(cast.framework.events.EventType.PAUSE, (): void => {
    reportPlaybackProgress($scope, getReportingParams($scope));
});

/**
 *
 */
function defaultOnStop(): void {
    playbackMgr.stop();
}

mgr.addEventListener(
    cast.framework.events.EventType.MEDIA_FINISHED,
    defaultOnStop
);
mgr.addEventListener(cast.framework.events.EventType.ABORT, defaultOnStop);

mgr.addEventListener(cast.framework.events.EventType.ENDED, () => {
    // Ignore
    if ($scope.isChangingStream) {
        return;
    }

    reportPlaybackStopped($scope, getReportingParams($scope));
    resetPlaybackScope($scope);

    if (!playbackMgr.playNextItem()) {
        window.playlist = [];
        window.currentPlaylistIndex = -1;
        DocumentManager.startBackdropInterval();
    }
});

// Set the active subtitle track once the player has loaded
window.mediaManager.addEventListener(
    cast.framework.events.EventType.PLAYER_LOAD_COMPLETE,
    () => {
        setTextTrack(
            window.mediaManager.getMediaInformation().customData
                .subtitleStreamIndex
        );
    }
);

/**
 *
 */
export async function reportDeviceCapabilities(): Promise<void> {
    const maxBitrate = await getMaxBitrate();

    const deviceProfile = getDeviceProfile({
        bitrateSetting: maxBitrate,
        enableHls: true
    });

    const capabilities = {
        DeviceProfile: deviceProfile,
        PlayableMediaTypes: ['Audio', 'Video'],
        SupportsMediaControl: true,
        SupportsPersistentIdentifier: false
    };

    hasReportedCapabilities = true;

    return JellyfinApi.authAjax('Sessions/Capabilities/Full', {
        contentType: 'application/json',
        data: JSON.stringify(capabilities),
        type: 'POST'
    });
}

/**
 * @param data
 */
export function processMessage(data: any): void {
    if (
        !data.command ||
        !data.serverAddress ||
        !data.userId ||
        !data.accessToken
    ) {
        console.log('Invalid message sent from sender. Sending error response');

        broadcastToMessageBus({
            message:
                'Missing one or more required params - command,options,userId,accessToken,serverAddress',
            type: 'error'
        });

        return;
    }

    // Items will have properties - Id, Name, Type, MediaType, IsFolder

    JellyfinApi.setServerInfo(
        data.userId,
        data.accessToken,
        data.serverAddress
    );

    if (data.subtitleAppearance) {
        window.subtitleAppearance = data.subtitleAppearance;
    }

    // Report device capabilities
    if (!hasReportedCapabilities) {
        reportDeviceCapabilities();
    }

    data.options = data.options || {};

    const cleanReceiverName = cleanName(data.receiverName || '');

    window.deviceInfo.deviceName =
        cleanReceiverName || window.deviceInfo.deviceName;
    // deviceId just needs to be unique-ish
    window.deviceInfo.deviceId = cleanReceiverName
        ? btoa(cleanReceiverName)
        : window.deviceInfo.deviceId;

    if (data.maxBitrate) {
        window.MaxBitrate = data.maxBitrate;
    }

    CommandHandler.processMessage(data, data.command);

    if (window.reportEventType) {
        const report = (): Promise<void> =>
            reportPlaybackProgress($scope, getReportingParams($scope));

        reportPlaybackProgress(
            $scope,
            getReportingParams($scope),
            true,
            window.reportEventType
        );
        setTimeout(report, 100);
        setTimeout(report, 500);
    }
}

/**
 * @param name
 * @param reportToServer
 */
export function reportEvent(
    name: string,
    reportToServer: boolean
): Promise<void> {
    return reportPlaybackProgress(
        $scope,
        getReportingParams($scope),
        reportToServer,
        name
    );
}

/**
 * @param $scope
 * @param index
 */
export function setSubtitleStreamIndex(
    $scope: GlobalScope,
    index: number
): void {
    console.log(`setSubtitleStreamIndex. index: ${index}`);

    let positionTicks;

    const currentSubtitleStream = $scope.mediaSource.MediaStreams.filter(
        (m: any) => {
            return (
                m.Index == $scope.subtitleStreamIndex && m.Type == 'Subtitle'
            );
        }
    )[0];
    const currentDeliveryMethod = currentSubtitleStream
        ? currentSubtitleStream.DeliveryMethod
        : null;

    if (index == -1 || index == null) {
        // Need to change the stream to turn off the subs
        if (currentDeliveryMethod == 'Encode') {
            console.log('setSubtitleStreamIndex video url change required');
            positionTicks = getCurrentPositionTicks($scope);
            changeStream(positionTicks, {
                SubtitleStreamIndex: -1
            });
        } else {
            $scope.subtitleStreamIndex = -1;
            setTextTrack(null);
        }

        return;
    }

    const mediaStreams = $scope.PlaybackMediaSource.MediaStreams;

    const subtitleStream = getStreamByIndex(mediaStreams, 'Subtitle', index);

    if (!subtitleStream) {
        console.log(
            'setSubtitleStreamIndex error condition - subtitle stream not found.'
        );

        return;
    }

    console.log(
        `setSubtitleStreamIndex DeliveryMethod:${subtitleStream.DeliveryMethod}`
    );

    if (
        subtitleStream.DeliveryMethod == 'External' ||
        currentDeliveryMethod == 'Encode'
    ) {
        const textStreamUrl = subtitleStream.IsExternalUrl
            ? subtitleStream.DeliveryUrl
            : JellyfinApi.createUrl(subtitleStream.DeliveryUrl);

        console.log(`Subtitle url: ${textStreamUrl}`);
        setTextTrack(index);
        $scope.subtitleStreamIndex = subtitleStream.Index;

        return;
    } else {
        console.log('setSubtitleStreamIndex video url change required');
        positionTicks = getCurrentPositionTicks($scope);
        changeStream(positionTicks, {
            SubtitleStreamIndex: index
        });
    }
}

/**
 * @param $scope
 * @param index
 */
export function setAudioStreamIndex(
    $scope: GlobalScope,
    index: number
): Promise<void> {
    const positionTicks = getCurrentPositionTicks($scope);

    return changeStream(positionTicks, {
        AudioStreamIndex: index
    });
}

/**
 * @param ticks
 */
export function seek(ticks: number): Promise<void> {
    return changeStream(ticks);
}

/**
 * @param ticks
 * @param params
 */
export async function changeStream(
    ticks: number,
    params: any = undefined
): Promise<void> {
    if (
        window.mediaManager.getMediaInformation().customData.canClientSeek &&
        params == null
    ) {
        window.mediaManager.seek(ticks / 10000000);
        reportPlaybackProgress($scope, getReportingParams($scope));

        return Promise.resolve();
    }

    params = params || {};

    const playSessionId = $scope.playSessionId;
    const liveStreamId = $scope.liveStreamId;

    const item = $scope.item;
    const maxBitrate = await getMaxBitrate();

    const deviceProfile = getDeviceProfile({
        bitrateSetting: maxBitrate,
        enableHls: true
    });
    const audioStreamIndex =
        params.AudioStreamIndex == null
            ? $scope.audioStreamIndex
            : params.AudioStreamIndex;
    const subtitleStreamIndex =
        params.SubtitleStreamIndex == null
            ? $scope.subtitleStreamIndex
            : params.SubtitleStreamIndex;

    const playbackInformation = await getPlaybackInfo(
        item,
        maxBitrate,
        deviceProfile,
        ticks,
        $scope.mediaSourceId,
        audioStreamIndex,
        subtitleStreamIndex,
        liveStreamId
    );

    if (!validatePlaybackInfoResult(playbackInformation)) {
        return;
    }

    const mediaSource = playbackInformation.MediaSources[0];
    const streamInfo = createStreamInfo(item, mediaSource, ticks);

    if (!streamInfo.url) {
        showPlaybackInfoErrorMessage('NoCompatibleStream');

        return;
    }

    const mediaInformation = createMediaInformation(
        playSessionId,
        item,
        streamInfo
    );
    const loadRequest = new cast.framework.messages.LoadRequestData();

    loadRequest.media = mediaInformation;
    loadRequest.autoplay = true;

    // TODO something to do with HLS?
    const requiresStoppingTranscoding = false;

    if (requiresStoppingTranscoding) {
        window.mediaManager.pause();
        await stopActiveEncodings(playSessionId);
    }

    window.mediaManager.load(loadRequest);
    window.mediaManager.play();
    $scope.subtitleStreamIndex = subtitleStreamIndex;
    $scope.audioStreamIndex = audioStreamIndex;
}

// Create a message handler for the custome namespace channel
// TODO save namespace somewhere global?
window.castReceiverContext.addCustomMessageListener(
    'urn:x-cast:com.connectsdk',
    (evt: any) => {
        let data: any = evt.data;

        // Apparently chromium likes to pass it as json, not as object.
        // chrome on android works fine
        if (typeof data === 'string') {
            console.log('Event data is a string.. Chromium detected..');
            data = JSON.parse(data);
        }

        data.options = data.options || {};
        data.options.senderId = evt.senderId;
        // TODO set it somewhere better perhaps
        window.senderId = evt.senderId;

        console.log(`Received message: ${JSON.stringify(data)}`);
        processMessage(data);
    }
);

/**
 * @param data
 * @param options
 * @param method
 */
export async function translateItems(
    data: any,
    options: PlayRequest,
    method: string
): Promise<void> {
    const playNow = method != 'PlayNext' && method != 'PlayLast';

    const result = await translateRequestedItems(
        data.userId,
        options.items,
        playNow
    );

    if (result.Items) {
        options.items = result.Items;
    }

    if (method == 'PlayNext' || method == 'PlayLast') {
        for (let i = 0, length = options.items.length; i < length; i++) {
            window.playlist.push(options.items[i]);
        }
    } else {
        playbackMgr.playFromOptions(data.options);
    }
}

/**
 * @param data
 * @param options
 * @param item
 */
export async function instantMix(
    data: any,
    options: any,
    item: BaseItemDto
): Promise<void> {
    const result = await getInstantMixItems(data.userId, item);

    options.items = result.Items;
    playbackMgr.playFromOptions(data.options);
}

/**
 * @param data
 * @param options
 * @param item
 */
export async function shuffle(
    data: any,
    options: any,
    item: BaseItemDto
): Promise<void> {
    const result = await getShuffleItems(data.userId, item);

    options.items = result.Items;
    playbackMgr.playFromOptions(data.options);
}

/**
 * @param item
 * @param options
 */
export async function onStopPlayerBeforePlaybackDone(
    item: BaseItemDto,
    options: any
): Promise<void> {
    const data = await JellyfinApi.authAjaxUser(`Items/${item.Id}`, {
        dataType: 'json',
        type: 'GET'
    });

    // Attach the custom properties we created like userId, serverAddress, itemId, etc
    extend(data, item);
    playbackMgr.playItemInternal(data, options);
    broadcastConnectionErrorMessage();
}

let lastBitrateDetect = 0;
let detectedBitrate = 0;
/**
 *
 */
export async function getMaxBitrate(): Promise<number> {
    console.log('getMaxBitrate');

    if (window.MaxBitrate) {
        console.log(`bitrate is set to ${window.MaxBitrate}`);

        return window.MaxBitrate;
    }

    if (detectedBitrate && new Date().getTime() - lastBitrateDetect < 600000) {
        console.log(
            `returning previous detected bitrate of ${detectedBitrate}`
        );

        return detectedBitrate;
    }

    console.log('detecting bitrate');

    const bitrate = await detectBitrate();

    try {
        console.log(`Max bitrate auto detected to ${bitrate}`);
        lastBitrateDetect = new Date().getTime();
        detectedBitrate = bitrate;

        return detectedBitrate;
    } catch (e) {
        // The client can set this number
        console.log('Error detecting bitrate, will return device maximum.');

        return getMaxBitrateSupport();
    }
}

/**
 * @param result
 */
export function validatePlaybackInfoResult(result: any): boolean {
    if (result.ErrorCode) {
        showPlaybackInfoErrorMessage(result.ErrorCode);

        return false;
    }

    return true;
}

/**
 * @param error
 */
export function showPlaybackInfoErrorMessage(error: string): void {
    broadcastToMessageBus({ message: error, type: 'playbackerror' });
}

/**
 * @param versions
 */
export function getOptimalMediaSource(versions: Array<any>): any {
    let optimalVersion = versions.filter((v) => {
        checkDirectPlay(v);

        return v.SupportsDirectPlay;
    })[0];

    if (!optimalVersion) {
        optimalVersion = versions.filter((v) => {
            return v.SupportsDirectStream;
        })[0];
    }

    return (
        optimalVersion ||
        versions.filter((s) => {
            return s.SupportsTranscoding;
        })[0]
    );
}

// Disable direct play on non-http sources
/**
 * @param mediaSource
 */
export function checkDirectPlay(mediaSource: MediaSourceInfo): void {
    if (
        mediaSource.SupportsDirectPlay &&
        mediaSource.Protocol == 'Http' &&
        (!mediaSource.RequiredHttpHeaders ||
            !mediaSource.RequiredHttpHeaders.length)
    ) {
        return;
    }

    mediaSource.SupportsDirectPlay = false;
}

/**
 * @param index
 */
export function setTextTrack(index: number | null): void {
    try {
        const textTracksManager = window.mediaManager.getTextTracksManager();

        if (index == null) {
            // docs: null is okay
            // typescript definitions: Must be Array<number>
            textTracksManager.setActiveByIds([]);

            return;
        }

        const tracks: Array<framework.messages.Track> =
            textTracksManager.getTracks();
        const subtitleTrack: framework.messages.Track | undefined = tracks.find(
            (track: framework.messages.Track) => {
                return track.trackId === index;
            }
        );

        if (subtitleTrack && subtitleTrack.trackId !== undefined) {
            textTracksManager.setActiveByIds([subtitleTrack.trackId]);

            const subtitleAppearance = window.subtitleAppearance;

            if (subtitleAppearance) {
                const textTrackStyle =
                    new cast.framework.messages.TextTrackStyle();

                if (subtitleAppearance.dropShadow != null) {
                    // Empty string is DROP_SHADOW
                    textTrackStyle.edgeType =
                        subtitleAppearance.dropShadow.toUpperCase() ||
                        cast.framework.messages.TextTrackEdgeType.DROP_SHADOW;
                    textTrackStyle.edgeColor = '#000000FF';
                }

                if (subtitleAppearance.font) {
                    textTrackStyle.fontFamily = subtitleAppearance.font;
                }

                if (subtitleAppearance.textColor) {
                    // Append the transparency, hardcoded to 100%
                    textTrackStyle.foregroundColor = `${subtitleAppearance.textColor}FF`;
                }

                if (subtitleAppearance.textBackground === 'transparent') {
                    textTrackStyle.backgroundColor = '#00000000'; // RGBA
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
        console.log(`Setting subtitle track failed: ${e}`);
    }
}

// TODO no any types
/**
 * @param playSessionId
 * @param item
 * @param streamInfo
 */
export function createMediaInformation(
    playSessionId: string,
    item: BaseItemDto,
    streamInfo: any
): framework.messages.MediaInformation {
    console.log('streamInfo', streamInfo);
    const mediaInfo = new cast.framework.messages.MediaInformation();

    mediaInfo.contentId = streamInfo.url;
    mediaInfo.contentType = streamInfo.contentType;
    mediaInfo.customData = {
        audioStreamIndex: streamInfo.audioStreamIndex,
        canClientSeek: streamInfo.canClientSeek,
        canSeek: streamInfo.canSeek,
        itemId: item.Id,
        liveStreamId: streamInfo.mediaSource.LiveStreamId,
        mediaSourceId: streamInfo.mediaSource.Id,
        playMethod: streamInfo.isStatic ? 'DirectStream' : 'Transcode',
        playSessionId: playSessionId,
        runtimeTicks: streamInfo.mediaSource.RunTimeTicks,
        startPositionTicks: streamInfo.startPositionTicks || 0,
        subtitleStreamIndex: streamInfo.subtitleStreamIndex
    };

    mediaInfo.metadata = getMetadata(item);

    mediaInfo.streamType = cast.framework.messages.StreamType.BUFFERED;
    mediaInfo.tracks = streamInfo.tracks;

    if (streamInfo.mediaSource.RunTimeTicks) {
        mediaInfo.duration = Math.floor(
            streamInfo.mediaSource.RunTimeTicks / 10000000
        );
    }

    mediaInfo.customData.startPositionTicks = streamInfo.startPosition || 0;

    return mediaInfo;
}

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

const options = new cast.framework.CastReceiverOptions();

// Global variable set by Webpack
if (!PRODUCTION) {
    window.castReceiverContext.setLoggerLevel(cast.framework.LoggerLevel.DEBUG);
    // Don't time out on me :(
    // This is only normally allowed for non media apps, but in this case
    // it's for debugging purposes.
    options.disableIdleTimeout = true;
    // This alternative seems to close sooner; I think it
    // quits once the client closes the connection.
    // options.maxInactivity = 3600;

    window.mediaManager.addEventListener(
        cast.framework.events.category.CORE,
        (event: framework.events.Event) => {
            console.log(`Core event: ${event.type}`);
            console.log(event);
        }
    );
} else {
    window.castReceiverContext.setLoggerLevel(cast.framework.LoggerLevel.NONE);
}

options.playbackConfig = new cast.framework.PlaybackConfig();
// Set the player to start playback as soon as there are five seconds of
// media content buffered. Default is 10.
options.playbackConfig.autoResumeDuration = 5;
options.supportedCommands = cast.framework.messages.Command.ALL_BASIC_MEDIA;

console.log('Application is ready, starting system');
window.castReceiverContext.start(options);
