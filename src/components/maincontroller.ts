import type {
    BaseItemDto,
    MediaStream,
    MediaSourceInfo
} from '@jellyfin/sdk/lib/generated-client';
import { getSessionApi } from '@jellyfin/sdk/lib/utils/api';
import {
    getCurrentPositionTicks,
    getReportingParams,
    getMetadata,
    getStreamByIndex,
    getShuffleItems,
    getInstantMixItems,
    translateRequestedItems,
    broadcastToMessageBus,
    ticksToSeconds,
    TicksPerSecond
} from '../helpers';
import {
    reportPlaybackStart,
    reportPlaybackProgress,
    reportPlaybackStopped,
    play,
    detectBitrate
} from './jellyfinActions';
import { getDeviceProfile } from './deviceprofileBuilder';
import { JellyfinApi } from './jellyfinApi';
import { PlaybackManager, PlaybackState } from './playbackManager';
import { CommandHandler } from './commandHandler';
import { getMaxBitrateSupport } from './codecSupportHelper';
import { PlayRequest } from '~/types/global';

window.castReceiverContext = cast.framework.CastReceiverContext.getInstance();
window.playerManager = window.castReceiverContext.getPlayerManager();

PlaybackManager.setPlayerManager(window.playerManager);

CommandHandler.configure(window.playerManager);

PlaybackManager.resetPlaybackScope();

let broadcastToServer = new Date();

let hasReportedCapabilities = false;

/**
 * onMediaElementTimeUpdate
 */
export function onMediaElementTimeUpdate(): void {
    if (PlaybackManager.playbackState.isChangingStream) {
        return;
    }

    const now = new Date();

    const elapsed = now.valueOf() - broadcastToServer.valueOf();
    const playbackState = PlaybackManager.playbackState;

    if (elapsed > 5000) {
        // TODO use status as input
        reportPlaybackProgress(
            playbackState,
            getReportingParams(playbackState)
        );
        broadcastToServer = now;
    } else if (elapsed > 1500) {
        // TODO use status as input
        reportPlaybackProgress(
            playbackState,
            getReportingParams(playbackState),
            false
        );
    }
}

/**
 * onMediaElementPause
 */
export function onMediaElementPause(): void {
    if (PlaybackManager.playbackState.isChangingStream) {
        return;
    }

    reportEvent('playstatechange', true);
}

/**
 * onMediaElementPlaying
 */
export function onMediaElementPlaying(): void {
    if (PlaybackManager.playbackState.isChangingStream) {
        return;
    }

    reportEvent('playstatechange', true);
}

/**
 * onMediaElementVolumeChange
 * @param event - event
 */
function onMediaElementVolumeChange(event: framework.system.Event): void {
    window.volume = (event as framework.system.SystemVolumeChangedEvent).data;
    console.log(`Received volume update: ${window.volume.level}`);

    if (JellyfinApi.serverAddress !== null) {
        reportEvent('volumechange', true);
    }
}

/**
 * enableTimeUpdateListener
 */
export function enableTimeUpdateListener(): void {
    window.playerManager.addEventListener(
        cast.framework.events.EventType.TIME_UPDATE,
        onMediaElementTimeUpdate
    );
    window.castReceiverContext.addEventListener(
        cast.framework.system.EventType.SYSTEM_VOLUME_CHANGED,
        onMediaElementVolumeChange
    );
    window.playerManager.addEventListener(
        cast.framework.events.EventType.PAUSE,
        onMediaElementPause
    );
    window.playerManager.addEventListener(
        cast.framework.events.EventType.PLAYING,
        onMediaElementPlaying
    );
}

/**
 * disableTimeUpdateListener
 */
export function disableTimeUpdateListener(): void {
    window.playerManager.removeEventListener(
        cast.framework.events.EventType.TIME_UPDATE,
        onMediaElementTimeUpdate
    );
    window.castReceiverContext.removeEventListener(
        cast.framework.system.EventType.SYSTEM_VOLUME_CHANGED,
        onMediaElementVolumeChange
    );
    window.playerManager.removeEventListener(
        cast.framework.events.EventType.PAUSE,
        onMediaElementPause
    );
    window.playerManager.removeEventListener(
        cast.framework.events.EventType.PLAYING,
        onMediaElementPlaying
    );
}

enableTimeUpdateListener();

window.addEventListener('beforeunload', () => {
    disableTimeUpdateListener();
});

window.playerManager.addEventListener(
    cast.framework.events.EventType.PLAY,
    (): void => {
        const playbackState = PlaybackManager.playbackState;

        play(playbackState);
        reportPlaybackProgress(
            playbackState,
            getReportingParams(playbackState)
        );
    }
);

window.playerManager.addEventListener(
    cast.framework.events.EventType.PAUSE,
    (): void => {
        const playbackState = PlaybackManager.playbackState;

        reportPlaybackProgress(
            playbackState,
            getReportingParams(playbackState)
        );
    }
);

/**
 * defaultOnStop
 */
function defaultOnStop(): void {
    PlaybackManager.onStop();
}

window.playerManager.addEventListener(
    cast.framework.events.EventType.MEDIA_FINISHED,
    (mediaFinishedEvent): void => {
        const playbackState = PlaybackManager.playbackState;

        // Don't notify server or client if changing streams, but notify next time.
        if (!playbackState.isChangingStream) {
            reportPlaybackStopped(playbackState, {
                ...getReportingParams(playbackState),
                PositionTicks:
                    (mediaFinishedEvent.currentMediaTime ??
                        getCurrentPositionTicks(playbackState)) * TicksPerSecond
            });

            defaultOnStop();
        } else {
            playbackState.isChangingStream = false;
        }
    }
);

window.playerManager.addEventListener(
    cast.framework.events.EventType.ABORT,
    defaultOnStop
);

window.playerManager.addEventListener(
    cast.framework.events.EventType.ENDED,
    (): void => {
        const playbackState = PlaybackManager.playbackState;

        // If we're changing streams, do not report playback ended.
        if (playbackState.isChangingStream) {
            return;
        }

        PlaybackManager.resetPlaybackScope();

        if (!PlaybackManager.playNextItem()) {
            PlaybackManager.resetPlaylist();
            PlaybackManager.onStop();
        }
    }
);

// Notify of playback start as soon as the media is playing. Only then is the tick position good.
window.playerManager.addEventListener(
    cast.framework.events.EventType.PLAYING,
    (): void => {
        reportPlaybackStart(
            PlaybackManager.playbackState,
            getReportingParams(PlaybackManager.playbackState)
        );
    }
);

// Set the active subtitle track once the player has loaded
window.playerManager.addEventListener(
    cast.framework.events.EventType.PLAYER_LOAD_COMPLETE,
    () => {
        setTextTrack(
            window.playerManager.getMediaInformation()?.customData
                ?.subtitleStreamIndex ?? null
        );
    }
);

/**
 * reportDeviceCapabilities
 * @returns Promise
 */
export async function reportDeviceCapabilities(): Promise<void> {
    const maxBitrate = await getMaxBitrate();

    const deviceProfile = getDeviceProfile({
        bitrateSetting: maxBitrate,
        enableHls: true
    });

    hasReportedCapabilities = true;

    await getSessionApi(JellyfinApi.jellyfinApi).postFullCapabilities({
        clientCapabilitiesDto: {
            DeviceProfile: deviceProfile,
            PlayableMediaTypes: ['Audio', 'Video'],
            SupportsMediaControl: true,
            SupportsPersistentIdentifier: false
        }
    });
}

/**
 * processMessage
 * @param data - data
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    data.options = data.options || {};

    // Items will have properties - Id, Name, Type, MediaType, IsFolder

    JellyfinApi.setServerInfo(
        data.userId,
        data.accessToken,
        data.serverAddress,
        data.receiverName
    );

    if (data.subtitleAppearance) {
        window.subtitleAppearance = data.subtitleAppearance;
    }

    if (data.maxBitrate) {
        window.MaxBitrate = data.maxBitrate;
    }

    // Report device capabilities
    if (!hasReportedCapabilities) {
        reportDeviceCapabilities();
    }

    CommandHandler.processMessage(data, data.command);

    if (window.reportEventType) {
        const playbackState = PlaybackManager.playbackState;

        const report = (): void => {
            reportPlaybackProgress(
                playbackState,
                getReportingParams(playbackState)
            );
        };

        reportPlaybackProgress(
            playbackState,
            getReportingParams(playbackState),
            true,
            window.reportEventType
        );

        setTimeout(report, 100);
        setTimeout(report, 500);
    }
}

/**
 * reportEvent
 * @param name - name
 * @param reportToServer - reportToServer
 * @returns Promise
 */
export function reportEvent(
    name: string,
    reportToServer: boolean
): Promise<void> {
    const playbackState = PlaybackManager.playbackState;

    return reportPlaybackProgress(
        playbackState,
        getReportingParams(playbackState),
        reportToServer,
        name
    );
}

/**
 * setSubtitleStreamIndex
 * @param state - playback state.
 * @param index - index
 */
export function setSubtitleStreamIndex(
    state: PlaybackState,
    index: number
): void {
    console.log(`setSubtitleStreamIndex. index: ${index}`);

    let positionTicks;

    // FIXME: Possible index error when MediaStreams is undefined.
    const currentSubtitleStream = state.mediaSource?.MediaStreams?.find(
        (m: MediaStream) => {
            return m.Index == state.subtitleStreamIndex && m.Type == 'Subtitle';
        }
    );

    const currentDeliveryMethod = currentSubtitleStream
        ? currentSubtitleStream.DeliveryMethod
        : null;

    if (index == -1 || index == null) {
        // Need to change the stream to turn off the subs
        if (currentDeliveryMethod == 'Encode') {
            console.log('setSubtitleStreamIndex video url change required');
            positionTicks = getCurrentPositionTicks(state);
            changeStream(state, positionTicks, {
                SubtitleStreamIndex: -1
            });
        } else {
            state.subtitleStreamIndex = -1;
            setTextTrack(null);
        }

        return;
    }

    const mediaStreams = state.PlaybackMediaSource?.MediaStreams ?? [];

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
        state.subtitleStreamIndex = subtitleStream.Index;

        return;
    } else {
        console.log('setSubtitleStreamIndex video url change required');
        positionTicks = getCurrentPositionTicks(state);
        changeStream(state, positionTicks, {
            SubtitleStreamIndex: index
        });
    }
}

/**
 * setAudioStreamIndex
 * @param state - playback state.
 * @param index - index
 * @returns promise
 */
export function setAudioStreamIndex(
    state: PlaybackState,
    index: number
): Promise<void> {
    const positionTicks = getCurrentPositionTicks(state);

    return changeStream(state, positionTicks, {
        AudioStreamIndex: index
    });
}

/**
 * seek
 * @param state - playback state.
 * @param ticks - ticks
 * @returns promise
 */
export function seek(state: PlaybackState, ticks: number): Promise<void> {
    return changeStream(state, ticks);
}

/**
 * changeStream
 * @param state - playback state.
 * @param ticks - ticks
 * @param params - params
 * @returns promise
 */
export async function changeStream(
    state: PlaybackState,
    ticks: number,
    params: any = undefined // eslint-disable-line @typescript-eslint/no-explicit-any
): Promise<void> {
    if (
        window.playerManager.getMediaInformation()?.customData?.canClientSeek &&
        params == null
    ) {
        window.playerManager.seek(ticksToSeconds(ticks));
        reportPlaybackProgress(state, getReportingParams(state));

        return Promise.resolve();
    }

    params = params || {};

    // TODO Could be useful for garbage collection.
    //      It needs to predict if the server side transcode needs
    //      to restart.
    //      Possibility: Always assume it will. Downside: VTT subs switching doesn't
    //      need to restart the transcode.
    //const requiresStoppingTranscoding = false;
    //
    //if (requiresStoppingTranscoding) {
    //    window.playerManager.pause();
    //    await stopActiveEncodings($scope.playSessionId);
    //}

    state.isChangingStream = true;

    // @ts-expect-error is possible here
    return await PlaybackManager.playItemInternal(state.item, {
        audioStreamIndex: params.AudioStreamIndex ?? state.audioStreamIndex,
        liveStreamId: state.liveStreamId,
        mediaSourceId: state.mediaSourceId,
        startPositionTicks: ticks,
        subtitleStreamIndex:
            params.SubtitleStreamIndex ?? state.subtitleStreamIndex
    });
}

// Create a message handler for the custome namespace channel
// TODO save namespace somewhere global?
window.castReceiverContext.addCustomMessageListener(
    'urn:x-cast:com.connectsdk',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (evt: any) => {
        let data: any = evt.data; // eslint-disable-line @typescript-eslint/no-explicit-any

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
 * translateItems
 * @param data - data
 * @param options - options
 * @param method - method
 * @returns promise
 */
export async function translateItems(
    data: any, // eslint-disable-line @typescript-eslint/no-explicit-any
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
            PlaybackManager.enqueue(options.items[i]);
        }
    } else {
        PlaybackManager.playFromOptions(data.options);
    }
}

/**
 * instantMix
 * @param data - data
 * @param options - options
 * @param item - item
 * @returns promise
 */
export async function instantMix(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    options: PlayRequest,
    item: BaseItemDto
): Promise<void> {
    const result = await getInstantMixItems(data.userId, item);

    options.items = result.Items ?? [];
    PlaybackManager.playFromOptions(data.options);
}

/**
 * shuffle
 * @param data - data
 * @param options - options
 * @param item - item
 * @returns promise
 */
export async function shuffle(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: any,
    options: PlayRequest,
    item: BaseItemDto
): Promise<void> {
    const result = await getShuffleItems(data.userId, item);

    options.items = result.Items ?? [];
    PlaybackManager.playFromOptions(data.options);
}

/**
 * onStopPlayerBeforePlaybackDone
 * This function fetches the full information of an item before playing it.
 * Only item.Id needs to be set.
 * @param item - Item to look up
 * @param options - Extra information about how it should be played back.
 * @returns Promise waiting for the item to be loaded for playback
 */
export async function onStopPlayerBeforePlaybackDone(
    item: BaseItemDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: any
): Promise<void> {
    const data = await JellyfinApi.authAjaxUser(`Items/${item.Id}`, {
        dataType: 'json',
        type: 'GET'
    });

    PlaybackManager.playItemInternal(data, options);
}

let lastBitrateDetect = 0;
let detectedBitrate = 0;
/**
 * getMaxBitrate
 * @returns promise
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

        return Math.min(detectedBitrate, getMaxBitrateSupport());
    } catch {
        // The client can set this number
        console.log('Error detecting bitrate, will return device maximum.');

        return getMaxBitrateSupport();
    }
}

/**
 * showPlaybackInfoErrorMessage
 * @param error - error
 */
export function showPlaybackInfoErrorMessage(error: string): void {
    broadcastToMessageBus({ message: error, type: 'playbackerror' });
}

/**
 * getOptimalMediaSource
 * @param versions - versions
 * @returns stream
 */
export function getOptimalMediaSource(
    versions: MediaSourceInfo[]
): MediaSourceInfo | null {
    let optimalVersion = versions.find((v) => {
        checkDirectPlay(v);

        return v.SupportsDirectPlay;
    });

    if (!optimalVersion) {
        optimalVersion = versions.find((v) => {
            return v.SupportsDirectStream;
        });
    }

    return (
        optimalVersion ??
        versions.find((s) => {
            return s.SupportsTranscoding;
        }) ??
        null
    );
}

// Disable direct play on non-http sources
/**
 * checkDirectPlay
 * @param mediaSource - mediaSource
 */
export function checkDirectPlay(mediaSource: MediaSourceInfo): void {
    if (
        mediaSource.SupportsDirectPlay &&
        mediaSource.Protocol == 'Http' &&
        !mediaSource.RequiredHttpHeaders?.length
    ) {
        return;
    }

    mediaSource.SupportsDirectPlay = false;
}

/**
 * setTextTrack
 * @param index - index
 */
export function setTextTrack(index: number | null): void {
    try {
        const textTracksManager = window.playerManager.getTextTracksManager();

        if (index == null) {
            // docs: null is okay
            // typescript definitions: Must be Array<number>
            textTracksManager.setActiveByIds([]);

            return;
        }

        const subtitleTrack = textTracksManager.getTrackById(index);

        if (subtitleTrack?.trackId !== undefined) {
            textTracksManager.setActiveByIds([subtitleTrack.trackId]);

            const subtitleAppearance = window.subtitleAppearance;

            if (subtitleAppearance) {
                const textTrackStyle =
                    new cast.framework.messages.TextTrackStyle();

                if (subtitleAppearance.dropShadow != null) {
                    // Empty string is DROP_SHADOW
                    textTrackStyle.edgeType =
                        subtitleAppearance.dropShadow ||
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
 * createMediaInformation
 * @param playSessionId - playSessionId
 * @param item - item
 * @param streamInfo - streamInfo
 * @returns media information
 */
export function createMediaInformation(
    playSessionId: string,
    item: BaseItemDto,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    streamInfo: any
): framework.messages.MediaInformation {
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
            ticksToSeconds(streamInfo.mediaSource.RunTimeTicks)
        );
    }

    // If the client actually sets startPosition:
    // if(streamInfo.startPosition)
    //     mediaInfo.customData.startPositionTicks = streamInfo.startPosition

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
if (!import.meta.env.PROD) {
    window.castReceiverContext.setLoggerLevel(cast.framework.LoggerLevel.DEBUG);
    // Don't time out on me :(
    // This is only normally allowed for non media apps, but in this case
    // it's for debugging purposes.
    options.disableIdleTimeout = true;
    // This alternative seems to close sooner; I think it
    // quits once the client closes the connection.
    // options.maxInactivity = 3600;

    window.playerManager.addEventListener(
        cast.framework.events.category.CORE,
        (event: framework.events.Event) => {
            console.log(`Core event: ${event.type}`);
            console.log(event);
        }
    );
} else {
    window.castReceiverContext.setLoggerLevel(cast.framework.LoggerLevel.NONE);
}

options.useShakaForHls = true;
options.playbackConfig = new cast.framework.PlaybackConfig();
// Set the player to start playback as soon as there are five seconds of
// media content buffered. Default is 10.
options.playbackConfig.autoResumeDuration = 5;
options.supportedCommands = cast.framework.messages.Command.ALL_BASIC_MEDIA;

console.log('Application is ready, starting system');
window.castReceiverContext.start(options);
