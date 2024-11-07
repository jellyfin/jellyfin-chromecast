import type {
    BaseItemDto,
    DeviceProfile,
    LiveStreamResponse,
    MediaSourceInfo,
    PlaybackInfoDto,
    PlaybackProgressInfo,
    PlayRequest
} from '@jellyfin/sdk/lib/generated-client';
import {
    getHlsSegmentApi,
    getMediaInfoApi,
    getPlaystateApi
} from '@jellyfin/sdk/lib/utils/api';
import { getSenderReportingData, broadcastToMessageBus } from '../helpers';
import { AppStatus } from '../types/appStatus';
import { JellyfinApi } from './jellyfinApi';
import { DocumentManager } from './documentManager';
import { PlaybackManager, PlaybackState } from './playbackManager';

interface PlayRequestQuery extends PlayRequest {
    UserId?: string;
    StartTimeTicks?: number;
    MaxStreamingBitrate?: number;
    LiveStreamId?: string;
    ItemId?: string;
    PlaySessionId?: string;
}

let pingInterval: number;
let lastTranscoderPing = 0;

/**
 * Start the transcoder pinging.
 *
 * This is used to keep the transcode available during pauses
 * @param reportingParams - parameters to report to the server
 */
function restartPingInterval(reportingParams: PlaybackProgressInfo): void {
    stopPingInterval();

    if (reportingParams.PlayMethod == 'Transcode') {
        pingInterval = window.setInterval(() => {
            pingTranscoder(reportingParams);
        }, 1000);
    }
}

/**
 * Stop the transcoder ping
 *
 * Needed to stop the pinging when it's not needed anymore
 */
export function stopPingInterval(): void {
    if (pingInterval !== 0) {
        clearInterval(pingInterval);
        pingInterval = 0;
    }
}

/**
 * Report to the server that playback has started.
 * @param state - playback state.
 * @param reportingParams - parameters to send to the server
 * @returns promise to wait for the request
 */
export async function reportPlaybackStart(
    state: PlaybackState,
    reportingParams: PlaybackProgressInfo
): Promise<void> {
    // it's just "reporting" that the playback is starting
    // but it's also disabling the rotating backdrops
    // in the line below.
    // TODO move the responsibility to the caller.
    DocumentManager.clearBackdropInterval();

    broadcastToMessageBus({
        //TODO: convert these to use a defined type in the type field
        data: getSenderReportingData(state, reportingParams),
        type: 'playbackstart'
    });

    restartPingInterval(reportingParams);

    await getPlaystateApi(JellyfinApi.jellyfinApi).reportPlaybackStart({
        playbackStartInfo: reportingParams
    });
}

/**
 * Report to the server the progress of the playback.
 * @param state - playback state.
 * @param reportingParams - parameters for jellyfin
 * @param reportToServer - if jellyfin should be informed
 * @param broadcastEventName - name of event to send to the cast sender
 * @returns Promise for the http request
 */
export async function reportPlaybackProgress(
    state: PlaybackState,
    reportingParams: PlaybackProgressInfo,
    reportToServer = true,
    broadcastEventName = 'playbackprogress'
): Promise<void> {
    broadcastToMessageBus({
        data: getSenderReportingData(state, reportingParams),
        type: broadcastEventName
    });

    if (reportToServer === false) {
        return Promise.resolve();
    }

    restartPingInterval(reportingParams);
    lastTranscoderPing = new Date().getTime();

    await getPlaystateApi(JellyfinApi.jellyfinApi).reportPlaybackProgress({
        playbackProgressInfo: reportingParams
    });
}

/**
 * Report to the server that playback has stopped.
 * @param state - playback state.
 * @param reportingParams - parameters to send to the server
 * @returns promise for waiting for the request
 */
export function reportPlaybackStopped(
    state: PlaybackState,
    reportingParams: PlaybackProgressInfo
): Promise<void> {
    stopPingInterval();

    broadcastToMessageBus({
        data: getSenderReportingData(state, reportingParams),
        type: 'playbackstop'
    });

    return JellyfinApi.authAjax('Sessions/Playing/Stopped', {
        contentType: 'application/json',
        data: JSON.stringify(reportingParams),
        type: 'POST'
    });
}

/**
 * This keeps the session alive when playback is paused by refreshing the server.
 * /Sessions/Playing/Progress does work but may not be called during pause.
 * The web client calls that during pause, but this endpoint gets the job done
 * as well.
 * @param reportingParams - progress information to carry
 * @returns promise for waiting for the request
 */
export function pingTranscoder(
    reportingParams: PlaybackProgressInfo
): Promise<void> {
    const now = new Date().getTime();

    // 10s is the timeout value, so use half that to report often enough
    if (now - lastTranscoderPing < 5000) {
        console.debug('Skipping ping due to recent progress check-in');

        return new Promise((resolve) => {
            resolve(undefined);
        });
    }

    lastTranscoderPing = new Date().getTime();

    // 10.7 oddly wants it as a query string parameter. This is a server bug for now.
    return JellyfinApi.authAjax(
        `Sessions/Playing/Ping?playSessionId=${reportingParams.PlaySessionId}`,
        {
            contentType: 'application/json',
            data: JSON.stringify({
                // jellyfin <= 10.6 wants it in the post data.
                PlaySessionId: reportingParams.PlaySessionId
            }),
            type: 'POST'
        }
    );
}

/**
 * Update the context about the item we are playing.
 * @param customData - data to set on playback state.
 * @param serverItem - item that is playing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function load(customData: any, serverItem: BaseItemDto): void {
    PlaybackManager.resetPlaybackScope();

    const state = PlaybackManager.playbackState;

    // These are set up in maincontroller.createMediaInformation
    state.playSessionId = customData.playSessionId;
    state.audioStreamIndex = customData.audioStreamIndex;
    state.subtitleStreamIndex = customData.subtitleStreamIndex;
    state.startPositionTicks = customData.startPositionTicks;
    state.canSeek = customData.canSeek;
    state.itemId = customData.itemId;
    state.liveStreamId = customData.liveStreamId;
    state.mediaSourceId = customData.mediaSourceId;
    state.playMethod = customData.playMethod;
    state.runtimeTicks = customData.runtimeTicks;

    state.item = serverItem;

    DocumentManager.setAppStatus(AppStatus.Backdrop);
    state.mediaType = serverItem?.MediaType;
}

/**
 * Tell the media manager to play and switch back into the correct view for Audio at least
 * It's really weird and I don't get the 20ms delay.
 *
 * I also don't get doing nothing based on the currently visible app status
 *
 * TODO: rename these
 * @param state - playback state.
 */
export function play(state: PlaybackState): void {
    if (
        DocumentManager.getAppStatus() == AppStatus.Backdrop ||
        DocumentManager.getAppStatus() == AppStatus.PlayingWithControls ||
        DocumentManager.getAppStatus() == AppStatus.Audio
    ) {
        setTimeout(() => {
            window.playerManager.play();

            if (state.mediaType == 'Audio') {
                DocumentManager.setAppStatus(AppStatus.Audio);
            } else {
                DocumentManager.setAppStatus(AppStatus.PlayingWithControls);
            }
        }, 20);
    }
}

/**
 * get PlaybackInfo
 * @param item - item
 * @param maxBitrate - maxBitrate
 * @param deviceProfile - deviceProfile
 * @param startPosition - startPosition
 * @param mediaSourceId - mediaSourceId
 * @param audioStreamIndex - audioStreamIndex
 * @param subtitleStreamIndex - subtitleStreamIndex
 * @param liveStreamId - liveStreamId
 * @returns promise
 */
export async function getPlaybackInfo(
    item: BaseItemDto,
    maxBitrate: number,
    deviceProfile: DeviceProfile,
    startPosition: number,
    mediaSourceId: string,
    audioStreamIndex: number,
    subtitleStreamIndex: number,
    liveStreamId: string | null = null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
    if (!item.Id) {
        console.error('getPlaybackInfo: Item ID not provided');

        return Promise.reject('Item ID not available.');
    }

    const query: PlaybackInfoDto = {
        DeviceProfile: deviceProfile,
        MaxStreamingBitrate: maxBitrate,
        StartTimeTicks: startPosition || 0,
        UserId: JellyfinApi.userId
    };

    if (audioStreamIndex != null) {
        query.AudioStreamIndex = audioStreamIndex;
    }

    if (subtitleStreamIndex != null) {
        query.SubtitleStreamIndex = subtitleStreamIndex;
    }

    if (mediaSourceId) {
        query.MediaSourceId = mediaSourceId;
    }

    if (liveStreamId) {
        query.LiveStreamId = liveStreamId;
    }

    const response = await getMediaInfoApi(
        JellyfinApi.jellyfinApi
    ).getPostedPlaybackInfo({
        itemId: item.Id,
        playbackInfoDto: query
    });

    return response.data;
}

/**
 * get LiveStream
 * @param item - item
 * @param playSessionId - playSessionId
 * @param maxBitrate - maxBitrate
 * @param deviceProfile - deviceProfile
 * @param startPosition - startPosition
 * @param mediaSource - mediaSource
 * @param audioStreamIndex - audioStreamIndex
 * @param subtitleStreamIndex - subtitleStreamIndex
 * @returns promise
 */
export function getLiveStream(
    item: BaseItemDto,
    playSessionId: string,
    maxBitrate: number,
    deviceProfile: DeviceProfile,
    startPosition: number,
    mediaSource: MediaSourceInfo,
    audioStreamIndex: number | null,
    subtitleStreamIndex: number | null
): Promise<LiveStreamResponse> {
    const postData = {
        DeviceProfile: deviceProfile,
        OpenToken: mediaSource.OpenToken
    };

    const query: PlayRequestQuery = {
        ItemId: item.Id,
        MaxStreamingBitrate: maxBitrate,
        PlaySessionId: playSessionId,
        StartTimeTicks: startPosition || 0,
        UserId: JellyfinApi.userId ?? undefined
    };

    if (audioStreamIndex != null) {
        query.AudioStreamIndex = audioStreamIndex;
    }

    if (subtitleStreamIndex != null) {
        query.SubtitleStreamIndex = subtitleStreamIndex;
    }

    return JellyfinApi.authAjax('LiveStreams/Open', {
        contentType: 'application/json',
        data: JSON.stringify(postData),
        dataType: 'json',
        query: query,
        type: 'POST'
    });
}

/**
 * Get download speed based on the jellyfin bitratetest api.
 * The API has a 10MB limit.
 * @param byteSize - number of bytes to request
 * @returns the bitrate in bits/s
 */
export async function getDownloadSpeed(byteSize: number): Promise<number> {
    const path = `Playback/BitrateTest?size=${byteSize}`;

    const now = new Date().getTime();

    const response = await JellyfinApi.authAjax(path, {
        timeout: 5000,
        type: 'GET'
    });

    // Force javascript to download the whole response before calculating bitrate
    await response.blob();

    const responseTimeSeconds = (new Date().getTime() - now) / 1000;
    const bytesPerSecond = byteSize / responseTimeSeconds;
    const bitrate = Math.round(bytesPerSecond * 8);

    return bitrate;
}

/**
 * Function to detect the bitrate.
 * It starts at 500kB and doubles it every time it takes under 2s, for max 10MB.
 * This should get an accurate bitrate relatively fast on any connection
 * @param numBytes - Number of bytes to start with, default 500k
 * @returns bitrate in bits/s
 */
export async function detectBitrate(numBytes = 500000): Promise<number> {
    // Jellyfin has a 10MB limit on the test size
    const byteLimit = 10000000;

    if (numBytes > byteLimit) {
        numBytes = byteLimit;
    }

    const bitrate = await getDownloadSpeed(numBytes);

    if (bitrate * (2 / 8.0) < numBytes || numBytes >= byteLimit) {
        // took > 2s, or numBytes hit the limit
        return Math.round(bitrate * 0.8);
    } else {
        // If that produced a fairly high speed, try again with a larger size to get a more accurate result
        return await detectBitrate(numBytes * 2);
    }
}

/**
 * Tell Jellyfin to kill off our active transcoding session
 * @param playSessionId - the play session ID to stop encoding
 * @returns Promise for the http request to go through
 */
export async function stopActiveEncodings(
    playSessionId: string
): Promise<void> {
    await getHlsSegmentApi(JellyfinApi.jellyfinApi).stopEncodingProcess({
        deviceId: JellyfinApi.deviceId,
        playSessionId: playSessionId
    });
}
