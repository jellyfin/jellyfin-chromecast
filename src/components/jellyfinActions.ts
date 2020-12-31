import {
    getSenderReportingData,
    resetPlaybackScope,
    getBackdropUrl,
    getLogoUrl,
    getPrimaryImageUrl,
    getDisplayName,
    getRatingHtml,
    getMiscInfoHtml,
    setAppStatus,
    setDisplayName,
    setGenres,
    setOverview,
    setPlayedPercentage,
    setWaitingBackdrop,
    setHasPlayedPercentage,
    setLogo,
    setDetailImage,
    extend,
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

interface PlayRequestQuery extends PlayRequest {
    UserId?: string;
    StartTimeTicks?: number;
    MaxStreamingBitrate?: number;
    LiveStreamId?: string;
    ItemId?: string;
    PlaySessionId?: string;
}

let pingInterval: number;
let backdropInterval: number;
let lastTranscoderPing = 0;

/**
 * Start the transcoder pinging.
 *
 * This is used to keep the transcode available during pauses
 *
 * @param $scope global context
 * @param reportingParams parameters to report to the server
 */
function restartPingInterval(
    $scope: GlobalScope,
    reportingParams: PlaybackProgressInfo
): void {
    stopPingInterval();

    if (reportingParams.PlayMethod == 'Transcode') {
        pingInterval = <any>setInterval(function () {
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
 * @param $scope global scope
 * @param reportingParams parameters to send to the server
 * @returns promise to wait for the request
 */
export function reportPlaybackStart(
    $scope: GlobalScope,
    reportingParams: PlaybackProgressInfo
): Promise<void> {
    clearBackdropInterval();

    broadcastToMessageBus({
        //TODO: convert these to use a defined type in the type field
        type: 'playbackstart',
        data: getSenderReportingData($scope, reportingParams)
    });

    restartPingInterval($scope, reportingParams);

    return JellyfinApi.authAjax('Sessions/Playing', {
        type: 'POST',
        data: JSON.stringify(reportingParams),
        contentType: 'application/json'
    });
}

/**
 * Report to the server the progress of the playback.
 *
 * @param $scope global scope
 * @param reportingParams parameters for jellyfin
 * @param reportToServer if jellyfin should be informed
 * @param broadcastEventName name of event to send to the cast sender
 */
export function reportPlaybackProgress(
    $scope: GlobalScope,
    reportingParams: PlaybackProgressInfo,
    reportToServer = true,
    broadcastEventName = 'playbackprogress'
): Promise<void> {
    broadcastToMessageBus({
        type: broadcastEventName,
        data: getSenderReportingData($scope, reportingParams)
    });

    if (reportToServer === false) {
        return Promise.resolve();
    }

    restartPingInterval($scope, reportingParams);
    lastTranscoderPing = new Date().getTime();

    return JellyfinApi.authAjax('Sessions/Playing/Progress', {
        type: 'POST',
        data: JSON.stringify(reportingParams),
        contentType: 'application/json'
    });
}

/**
 * Report to the server that playback has stopped.
 *
 * @param $scope global scope
 * @param reportingParams parameters to send to the server
 * @returns promise for waiting for the request
 */
export function reportPlaybackStopped(
    $scope: GlobalScope,
    reportingParams: PlaybackProgressInfo
): Promise<void> {
    stopPingInterval();

    broadcastToMessageBus({
        type: 'playbackstop',
        data: getSenderReportingData($scope, reportingParams)
    });

    return JellyfinApi.authAjax('Sessions/Playing/Stopped', {
        type: 'POST',
        data: JSON.stringify(reportingParams),
        contentType: 'application/json'
    });
}

/**
 * This keeps the session alive when playback is paused by refreshing the server.
 * /Sessions/Playing/Progress does work but may not be called during pause.
 * The web client calls that during pause, but this endpoint gets the job done
 * as well.
 *
 * @param reportingParams progress information to carry
 * @returns promise for waiting for the request
 */
export function pingTranscoder(
    reportingParams: PlaybackProgressInfo
): Promise<void> {
    const now = new Date().getTime();

    // 10s is the timeout value, so use half that to report often enough
    if (now - lastTranscoderPing < 5000) {
        console.debug('Skipping ping due to recent progress check-in');
        return new Promise(function (resolve) {
            resolve();
        });
    }

    lastTranscoderPing = new Date().getTime();

    // 10.7 oddly wants it as a query string parameter. This is a server bug for now.
    return JellyfinApi.authAjax(
        'Sessions/Playing/Ping?playSessionId=' + reportingParams.PlaySessionId,
        {
            type: 'POST',
            data: JSON.stringify({
                // jellyfin <= 10.6 wants it in the post data.
                PlaySessionId: reportingParams.PlaySessionId
            }),
            contentType: 'application/json'
        }
    );
}

/**
 * Stop the backdrop rotation
 */
function clearBackdropInterval(): void {
    if (backdropInterval !== 0) {
        clearInterval(backdropInterval);
        backdropInterval = 0;
    }
}

/**
 * Start the backdrop rotation
 */
export function startBackdropInterval(): void {
    clearBackdropInterval();

    setRandomUserBackdrop();

    backdropInterval = <any>setInterval(function () {
        setRandomUserBackdrop();
    }, 30000);
}

/**
 * Get a random backdrop to set on the waiting container
 *
 * @returns promise to wait for the request
 */
function setRandomUserBackdrop(): Promise<void> {
    return JellyfinApi.authAjaxUser('Items', {
        dataType: 'json',
        type: 'GET',
        query: {
            SortBy: 'Random',
            IncludeItemTypes: 'Movie,Series',
            ImageTypes: 'Backdrop',
            Recursive: true,
            Limit: 1,
            // Although we're limiting to what the user has access to,
            // not everyone will want to see adult backdrops rotating on their TV.
            MaxOfficialRating: 'PG-13'
        }
    }).then(function (result: any) {
        const item = result.Items[0];

        let backdropUrl = '';

        if (item) {
            backdropUrl = getBackdropUrl(item) || '';
        }

        setWaitingBackdrop(backdropUrl);
    });
}

/**
 * This function takes an item and shows details about it.
 * This function is responsible for the details page that is shown while browsing jellyfin
 *
 * @param item item to show information about
 */
function showItem(item: BaseItemDto): void {
    clearBackdropInterval();

    const backdropUrl = getBackdropUrl(item) || '';
    let detailImageUrl = getPrimaryImageUrl(item) || '';

    setAppStatus('details');
    setWaitingBackdrop(backdropUrl);

    setLogo(getLogoUrl(item) || '');
    setOverview(item.Overview || '');
    setGenres(item?.Genres?.join(' / '));
    setDisplayName(getDisplayName(item));

    const detailRating = document.getElementById('detailRating');
    const miscInfo = document.getElementById('miscInfo');
    if (miscInfo) {
        miscInfo.innerHTML = getMiscInfoHtml(item) || '';
    }

    if (detailRating) {
        detailRating.innerHTML = getRatingHtml(item);
    }

    const playedIndicator = document.getElementById('playedIndicator');

    if (playedIndicator) {
        if (item?.UserData?.Played) {
            playedIndicator.style.display = 'block';
            playedIndicator.innerHTML =
                '<span class="glyphicon glyphicon-ok"></span>';
        } else if (item?.UserData?.UnplayedItemCount) {
            playedIndicator.style.display = 'block';
            playedIndicator.innerHTML = item.UserData.UnplayedItemCount.toString();
        } else {
            playedIndicator.style.display = 'none';
        }
    }

    if (
        item?.UserData?.PlayedPercentage &&
        item?.UserData?.PlayedPercentage < 100 &&
        !item.IsFolder
    ) {
        setHasPlayedPercentage(false);
        setPlayedPercentage(item.UserData.PlayedPercentage);

        detailImageUrl +=
            '&PercentPlayed=' + item.UserData.PlayedPercentage.toString();
    } else {
        setHasPlayedPercentage(false);
        setPlayedPercentage(0);
    }

    setDetailImage(detailImageUrl);
}

/**
 * Show item, but resolve it from an id number first
 *
 * @param itemId id to look up
 * @returns promise to wait for the request
 */
export function displayItem(itemId: string): Promise<void> {
    return JellyfinApi.authAjaxUser('Items/' + itemId, {
        dataType: 'json',
        type: 'GET'
    }).then((item: BaseItemDto) => showItem(item));
}

/**
 * Update the context about the item we are playing.
 *
 * @param $scope global context
 * @param customData data to set on $scope
 * @param serverItem item that is playing
 */
export function load(
    $scope: GlobalScope,
    customData: PlaybackProgressInfo,
    serverItem: BaseItemDto
): void {
    resetPlaybackScope($scope);

    extend($scope, customData);

    $scope.item = serverItem;

    setAppStatus('backdrop');
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
 * @param $scope global scope
 */
export function play($scope: GlobalScope): void {
    if (
        $scope.status == 'backdrop' ||
        $scope.status == 'playing-with-controls' ||
        $scope.status == 'playing' ||
        $scope.status == 'audio'
    ) {
        setTimeout(function () {
            window.mediaManager.play();

            setAppStatus('playing-with-controls');
            if ($scope.mediaType == 'Audio') {
                setAppStatus('audio');
            }
        }, 20);
    }
}

/**
 * Don't actually stop, just show the idle view after 20ms
 */
export function stop(): void {
    setTimeout(function () {
        setAppStatus('waiting');
    }, 20);
}

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
        UserId: JellyfinApi.userId ?? undefined,
        StartTimeTicks: startPosition || 0,
        MaxStreamingBitrate: maxBitrate
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

    return JellyfinApi.authAjax('Items/' + item.Id + '/PlaybackInfo', {
        query: query,
        type: 'POST',
        dataType: 'json',
        data: JSON.stringify(postData),
        contentType: 'application/json'
    });
}

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
        UserId: JellyfinApi.userId ?? undefined,
        StartTimeTicks: startPosition || 0,
        ItemId: item.Id,
        MaxStreamingBitrate: maxBitrate,
        PlaySessionId: playSessionId
    };

    if (audioStreamIndex != null) {
        query.AudioStreamIndex = audioStreamIndex;
    }
    if (subtitleStreamIndex != null) {
        query.SubtitleStreamIndex = subtitleStreamIndex;
    }

    return JellyfinApi.authAjax('LiveStreams/Open', {
        query: query,
        type: 'POST',
        dataType: 'json',
        data: JSON.stringify(postData),
        contentType: 'application/json'
    });
}

/**
 * Get download speed based on the jellyfin bitratetest api.
 *
 * FYI this API has a 10MB limit.
 *
 * @param byteSize number of bytes to request
 * @returns the bitrate in bits/s
 */
export function getDownloadSpeed(byteSize: number): Promise<number> {
    const path = 'Playback/BitrateTest?size=' + byteSize;

    const now = new Date().getTime();

    return JellyfinApi.authAjax(path, {
        type: 'GET',
        timeout: 5000
    })
        .then(function (response) {
            // Need to wait for the whole response before calculating speed
            return response.blob();
        })
        .then(function () {
            const responseTimeSeconds = (new Date().getTime() - now) / 1000;
            const bytesPerSecond = byteSize / responseTimeSeconds;
            const bitrate = Math.round(bytesPerSecond * 8);

            return bitrate;
        });
}

/**
 * Function to detect the bitrate.
 * It first tries 1MB and if bitrate is above 1Mbit/s it tries again with 2.4MB.
 *
 * @returns bitrate in bits/s
 */
export function detectBitrate(): Promise<number> {
    // First try a small amount so that we don't hang up their mobile connection
    return getDownloadSpeed(1000000).then(function (bitrate) {
        if (bitrate < 1000000) {
            return Math.round(bitrate * 0.8);
        } else {
            // If that produced a fairly high speed, try again with a larger size to get a more accurate result
            return getDownloadSpeed(2400000).then(function (bitrate) {
                return Math.round(bitrate * 0.8);
            });
        }
    });
}

/**
 * Tell Jellyfin to kill off our active transcoding session
 *
 * @param $scope
 */
export function stopActiveEncodings($scope: GlobalScope): Promise<void> {
    const options = {
        deviceId: window.deviceInfo.deviceId,
        PlaySessionId: undefined
    };

    if ($scope.playSessionId) {
        options.PlaySessionId = $scope.playSessionId;
    }

    return JellyfinApi.authAjax('Videos/ActiveEncodings', {
        type: 'DELETE',
        query: options
    });
}
