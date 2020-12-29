import {
    getSenderReportingData,
    resetPlaybackScope,
    broadcastToMessageBus
} from '../helpers';

import { GlobalScope } from '../types/global';
import { PlaybackProgressInfo } from '../api/generated/models/playback-progress-info';
import { BaseItemDto } from '../api/generated/models/base-item-dto';
import { DeviceProfile } from '../api/generated/models/device-profile';
import { MediaSourceInfo } from '../api/generated/models/media-source-info';
import { PlayRequest } from '../api/generated/models/play-request';
import { LiveStreamResponse } from '../api/generated/models/live-stream-response';
import { JellyfinApi } from './jellyfinApi';
import { DocumentManager } from './documentManager';

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
 *
 * @param $scope - global context
 * @param reportingParams - parameters to report to the server
 */
function restartPingInterval(
    $scope: GlobalScope,
    reportingParams: PlaybackProgressInfo
): void {
    stopPingInterval();

    if (reportingParams.PlayMethod == 'Transcode') {
        pingInterval = <any>setInterval(() => {
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
 *
 * @param $scope - global scope
 * @param reportingParams - parameters to send to the server
 * @returns promise to wait for the request
 */
export function reportPlaybackStart(
    $scope: GlobalScope,
    reportingParams: PlaybackProgressInfo
): Promise<void> {
    // it's just "reporting" that the playback is starting
    // but it's also disabling the rotating backdrops
    // in the line below.
    // TODO move the responsibility to the caller.
    DocumentManager.clearBackdropInterval();

    broadcastToMessageBus({
        //TODO: convert these to use a defined type in the type field
        data: getSenderReportingData($scope, reportingParams),
        type: 'playbackstart'
    });

    restartPingInterval($scope, reportingParams);

    return JellyfinApi.authAjax('Sessions/Playing', {
        contentType: 'application/json',
        data: JSON.stringify(reportingParams),
        type: 'POST'
    });
}

/**
 * Report to the server the progress of the playback.
 *
 * @param $scope - global scope
 * @param reportingParams - parameters for jellyfin
 * @param reportToServer - if jellyfin should be informed
 * @param broadcastEventName - name of event to send to the cast sender
 * @returns Promise for the http request
 */
export function reportPlaybackProgress(
    $scope: GlobalScope,
    reportingParams: PlaybackProgressInfo,
    reportToServer = true,
    broadcastEventName = 'playbackprogress'
): Promise<void> {
    broadcastToMessageBus({
        data: getSenderReportingData($scope, reportingParams),
        type: broadcastEventName
    });

    if (reportToServer === false) {
        return Promise.resolve();
    }

    restartPingInterval($scope, reportingParams);
    lastTranscoderPing = new Date().getTime();

    return JellyfinApi.authAjax('Sessions/Playing/Progress', {
        contentType: 'application/json',
        data: JSON.stringify(reportingParams),
        type: 'POST'
    });
}

/**
 * Report to the server that playback has stopped.
 *
 * @param $scope - global scope
 * @param reportingParams - parameters to send to the server
 * @returns promise for waiting for the request
 */
export function reportPlaybackStopped(
    $scope: GlobalScope,
    reportingParams: PlaybackProgressInfo
): Promise<void> {
    stopPingInterval();

    broadcastToMessageBus({
        data: getSenderReportingData($scope, reportingParams),
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
 *
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
 *
 * @param $scope - global context
 * @param customData - data to set on $scope
 * @param serverItem - item that is playing
 */
export function load(
    $scope: GlobalScope,
    customData: any,
    serverItem: BaseItemDto
): void {
    resetPlaybackScope($scope);

    // These are set up in maincontroller.createMediaInformation
    $scope.playSessionId = customData.playSessionId;
    $scope.audioStreamIndex = customData.audioStreamIndex;
    $scope.subtitleStreamIndex = customData.subtitleStreamIndex;
    $scope.startPositionTicks = customData.startPositionTicks;
    $scope.canSeek = customData.canSeek;
    $scope.itemId = customData.itemId;
    $scope.liveStreamId = customData.liveStreamId;
    $scope.mediaSourceId = customData.mediaSourceId;
    $scope.playMethod = customData.playMethod;
    $scope.runtimeTicks = customData.runtimeTicks;

    $scope.item = serverItem;

    DocumentManager.setAppStatus('backdrop');
    $scope.mediaType = serverItem?.MediaType;
}

/**
 * Tell the media manager to play and switch back into the correct view for Audio at least
 * It's really weird and I don't get the 20ms delay.
 *
 * I also don't get doing nothing based on the currently visible app status
 *
 * TODO: rename these
 *
 * @param $scope - global scope
 */
export function play($scope: GlobalScope): void {
    if (
        DocumentManager.getAppStatus() == 'backdrop' ||
        DocumentManager.getAppStatus() == 'playing-with-controls' ||
        DocumentManager.getAppStatus() == 'playing' ||
        DocumentManager.getAppStatus() == 'audio'
    ) {
        setTimeout(() => {
            window.playerManager.play();

            if ($scope.mediaType == 'Audio') {
                DocumentManager.setAppStatus('audio');
            } else {
                DocumentManager.setAppStatus('playing-with-controls');
            }
        }, 20);
    }
}

/**
 * @param item
 * @param maxBitrate
 * @param deviceProfile
 * @param startPosition
 * @param mediaSourceId
 * @param audioStreamIndex
 * @param subtitleStreamIndex
 * @param liveStreamId
 */
export function getPlaybackInfo(
    item: BaseItemDto,
    maxBitrate: number,
    deviceProfile: DeviceProfile,
    startPosition: number,
    mediaSourceId: string,
    audioStreamIndex: number,
    subtitleStreamIndex: number,
    liveStreamId: string | null = null
): Promise<any> {
    const postData = {
        DeviceProfile: deviceProfile
    };

    // TODO: PlayRequestQuery might not be the proper type for this
    const query: PlayRequestQuery = {
        MaxStreamingBitrate: maxBitrate,
        StartTimeTicks: startPosition || 0,
        UserId: JellyfinApi.userId ?? undefined
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

    return JellyfinApi.authAjax(`Items/${item.Id}/PlaybackInfo`, {
        contentType: 'application/json',
        data: JSON.stringify(postData),
        dataType: 'json',
        query: query,
        type: 'POST'
    });
}

/**
 * @param item
 * @param playSessionId
 * @param maxBitrate
 * @param deviceProfile
 * @param startPosition
 * @param mediaSource
 * @param audioStreamIndex
 * @param subtitleStreamIndex
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
 *
 * The API has a 10MB limit.
 *
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
 *
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
 *
 * @param $scope - Global scope variable
 * @returns Promise for the http request to go through
 */
export function stopActiveEncodings($scope: GlobalScope): Promise<void> {
    const options = {
        deviceId: JellyfinApi.deviceId,
        PlaySessionId: undefined
    };

    if ($scope.playSessionId) {
        options.PlaySessionId = $scope.playSessionId;
    }

    return JellyfinApi.authAjax('Videos/ActiveEncodings', {
        query: options,
        type: 'DELETE'
    });
}
