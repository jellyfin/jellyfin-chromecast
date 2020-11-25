import { ajax } from "./fetchhelper";

import {
    getUrl,
    getSenderReportingData,
    resetPlaybackScope,
    getSecurityHeaders,
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
} from "../helpers";

import { GlobalScope } from "../types/global";
import { PlaybackProgressInfo } from "../api/generated/models/playback-progress-info";
import { BaseItemDto } from "../api/generated/models/base-item-dto";
import { DeviceProfile } from "../api/generated/models/device-profile";
import { MediaSourceInfo } from "../api/generated/models/media-source-info";
import { PlayRequest } from "../api/generated/models/play-request";

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

function restartPingInterval($scope: GlobalScope, reportingParams: PlaybackProgressInfo): void {

    stopPingInterval();

    if (reportingParams.PlayMethod == 'Transcode') {
        pingInterval = <any>setInterval(function () {
            pingTranscoder($scope, {
                PlaySessionId: reportingParams.PlaySessionId
            });
        }, 1000);
    }
}

export function stopPingInterval(): void {
    if (pingInterval !== 0) {
        clearInterval(pingInterval);
        pingInterval = 0;
    }
}

export function reportPlaybackStart(
    $scope: GlobalScope,
    reportingParams: PlaybackProgressInfo
): Promise<any> {

    stopDynamicContent();

    if (!$scope.userId) {
        throw new Error("null userId");
    }

    if (!$scope.serverAddress) {
        throw new Error("null serverAddress");
    }

    const url = getUrl($scope.serverAddress, "Sessions/Playing");

    broadcastToMessageBus({
        //TODO: convert these to use a defined type in the type field
        type: 'playbackstart',
        data: getSenderReportingData($scope, reportingParams)
    });

    restartPingInterval($scope, reportingParams);

    return ajax({
        url: url,
        headers: getSecurityHeaders($scope.accessToken, $scope.userId),
        type: 'POST',
        data: JSON.stringify(reportingParams),
        contentType: 'application/json'
    });
}

export function reportPlaybackProgress(
    $scope: GlobalScope,
    reportingParams: PlaybackProgressInfo,
    reportToServer: boolean,
    broadcastEventName: string
): Promise<any> {

    if (!$scope.userId) {
        throw new Error("null userId");
    }

    if (!$scope.serverAddress) {
        throw new Error("null serverAddress");
    }

    broadcastToMessageBus({
        type: broadcastEventName || 'playbackprogress',
        data: getSenderReportingData($scope, reportingParams)
    });

    if (reportToServer === false) {
        return Promise.resolve();
    }

    const url = getUrl($scope.serverAddress, "Sessions/Playing/Progress");

    restartPingInterval($scope, reportingParams);
    lastTranscoderPing = new Date().getTime();

    return ajax({
        url: url,
        headers: getSecurityHeaders($scope.accessToken, $scope.userId),
        type: 'POST',
        data: JSON.stringify(reportingParams),
        contentType: 'application/json'
    });
}

export function reportPlaybackStopped(
    $scope: GlobalScope,
    reportingParams: PlaybackProgressInfo
): Promise<any> {

    stopPingInterval();

    if (!$scope.userId) {
        throw new Error("null userId");
    }

    if (!$scope.serverAddress) {
        throw new Error("null serverAddress");
    }

    const url = getUrl($scope.serverAddress, "Sessions/Playing/Stopped");

    broadcastToMessageBus({
        type: 'playbackstop',
        data: getSenderReportingData($scope, reportingParams)
    });

    return ajax({
        url: url,
        headers: getSecurityHeaders($scope.accessToken, $scope.userId),
        type: 'POST',
        data: JSON.stringify(reportingParams),
        contentType: 'application/json'
    });
}

export function pingTranscoder(
    $scope: GlobalScope,
    reportingParams: PlaybackProgressInfo
): Promise<any> {

    if (!$scope.userId) {
        throw new Error("null userId");
    }

    if (!$scope.serverAddress) {
        throw new Error("null serverAddress");
    }

    const now = new Date().getTime();

    if ((now - lastTranscoderPing) < 10000) {
        console.log("Skipping ping due to recent progress check-in");
        return new Promise(function (resolve) {
            resolve();
        });
    }

    const url = getUrl($scope.serverAddress, "Sessions/Playing/Ping");
    lastTranscoderPing = new Date().getTime();

    return ajax({
        url: url,
        headers: getSecurityHeaders($scope.accessToken, $scope.userId),
        type: 'POST',
        data: JSON.stringify(reportingParams),
        contentType: 'application/json'
    });
}

function clearBackropInterval(): void {
    if (backdropInterval !== 0) {
        clearInterval(backdropInterval);
        backdropInterval = 0;
    }
}

function startBackdropInterval(
    $scope: GlobalScope,
    serverAddress: string,
    accessToken: string,
    userId: string
): void {

    clearBackropInterval();

    setRandomUserBackdrop($scope, serverAddress, accessToken, userId);

    backdropInterval = <any> setInterval(function () {
        setRandomUserBackdrop($scope, serverAddress, accessToken, userId);
    }, 30000);
}

function setRandomUserBackdrop(
    $scope: GlobalScope,
    serverAddress: string,
    accessToken: string,
    userId: string
): void {
    const url = getUrl(serverAddress, "Users/" + userId + "/Items");

    ajax({
        url: url,
        headers: getSecurityHeaders(accessToken, userId),
        dataType: 'json',
        type: 'GET',
        query: {
            SortBy: "Random",
            IncludeItemTypes: "Movie,Series",
            ImageTypes: 'Backdrop',
            Recursive: true,
            Limit: 1,
            // Although we're limiting to what the user has access to,
            // not everyone will want to see adult backdrops rotating on their TV.
            MaxOfficialRating: 'PG-13'
        }
    }).then(function (result) {
        const item = result.Items[0];

        let backdropUrl = '';

        if (item) {
            backdropUrl = getBackdropUrl(item, serverAddress) || '';
        }

        setWaitingBackdrop(backdropUrl);
    });
}

export function displayUserInfo(
    $scope: GlobalScope,
    serverAddress: string,
    accessToken: string,
    userId: string
): void {
    startBackdropInterval($scope, serverAddress, accessToken, userId);
}

export function stopDynamicContent(): void {
    clearBackropInterval();
}

function showItem(
    $scope: GlobalScope,
    serverAddress: string,
    accessToken: string,
    userId: string,
    item: BaseItemDto
): void {

    clearBackropInterval();

    const backdropUrl = getBackdropUrl(item, serverAddress) || '';
    let detailImageUrl = getPrimaryImageUrl(item, serverAddress) || '';

    setAppStatus('details');
    setWaitingBackdrop(backdropUrl);

    setLogo(getLogoUrl(item, serverAddress) || '');
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
            playedIndicator.innerHTML = '<span class="glyphicon glyphicon-ok"></span>';
        } else if (item?.UserData?.UnplayedItemCount) {
            playedIndicator.style.display = 'block';
            playedIndicator.innerHTML = item.UserData.UnplayedItemCount.toString();
        } else {
            playedIndicator.style.display = 'none';
        }
    }

    if (item?.UserData?.PlayedPercentage
        && item?.UserData?.PlayedPercentage < 100
        && !item.IsFolder
    ) {
        setHasPlayedPercentage(false);
        setPlayedPercentage(item.UserData.PlayedPercentage);

        detailImageUrl += "&PercentPlayed=" + item.UserData.PlayedPercentage.toString();
    } else {
        setHasPlayedPercentage(false);
        setPlayedPercentage(0);
    }

    setDetailImage(detailImageUrl);
}

export function displayItem(
    $scope: GlobalScope,
    serverAddress: string,
    accessToken: string,
    userId: string,
    itemId: string
): void {
    const url = getUrl(serverAddress, "Users/" + userId + "/Items/" + itemId);

    ajax({
        url: url,
        headers: getSecurityHeaders(accessToken, userId),
        dataType: 'json',
        type: 'GET'
    }).then(function (item) {
        showItem($scope, serverAddress, accessToken, userId, item);
    });
}

export function getSubtitle(
    $scope: GlobalScope,
    subtitleStreamUrl: string
): Promise<any> {
    return ajax({

        url: subtitleStreamUrl,
        headers: getSecurityHeaders($scope.accessToken, $scope.userId),
        type: 'GET',
        dataType: 'json'
    });
}

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

//TODO: rename these
export function play($scope: GlobalScope): void {
    if ($scope.status == 'backdrop' || $scope.status == 'playing-with-controls' || $scope.status == 'playing' || $scope.status == 'audio') {
        setTimeout(function () {

            window.mediaManager.play();

            setAppStatus('playing-with-controls');
            if ($scope.mediaType == "Audio") {
                setAppStatus('audio');
            }
        }, 20);
    }
}

export function stop(): void {
    setTimeout(function () {
        setAppStatus('waiting');
    }, 20);
}

export function getPlaybackInfo (
    // TODO: change to BaseItemDto once refactor happens,
    // userId and serverAddress should not be on item
    item: any,
    maxBitrate: number,
    deviceProfile: DeviceProfile,
    startPosition: number,
    mediaSourceId: string,
    audioStreamIndex: number,
    subtitleStreamIndex: number,
    liveStreamId: string
): Promise<any> {
    if (!item.userId) {
        throw new Error("null userId");
    }

    if (!item.serverAddress) {
        throw new Error("null serverAddress");
    }

    const postData = {
        DeviceProfile: deviceProfile
    };

    // TODO: PlayRequestQuery might not be the proper type for this
    const query: PlayRequestQuery = {
        UserId: item.userId,
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

    const url = getUrl(item.serverAddress, 'Items/' + item.Id + '/PlaybackInfo');

    return ajax({
        url: url,
        headers: getSecurityHeaders(item.accessToken, item.userId),
        query: query,
        type: 'POST',
        dataType: 'json',
        data: JSON.stringify(postData),
        contentType: 'application/json'
    });
}

export function getLiveStream(
    // TODO: change to BaseItemDto once refactor happens,
    // userId and serverAddress should not be on item
    item: any,
    playSessionId: string,
    maxBitrate: number,
    deviceProfile: DeviceProfile,
    startPosition: number,
    mediaSource: MediaSourceInfo,
    audioStreamIndex: number,
    subtitleStreamIndex: number
): Promise<any> {

    if (!item.userId) {
        throw new Error("null userId");
    }

    if (!item.serverAddress) {
        throw new Error("null serverAddress");
    }

    const postData = {
        DeviceProfile: deviceProfile,
        OpenToken: mediaSource.OpenToken
    };

    const query: PlayRequestQuery = {
        UserId: item.userId,
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

    const url = getUrl(item.serverAddress, 'LiveStreams/Open');

    return ajax({
        url: url,
        headers: getSecurityHeaders(item.accessToken, item.userId),
        query: query,
        type: 'POST',
        dataType: 'json',
        data: JSON.stringify(postData),
        contentType: 'application/json'
    });
}

export function getDownloadSpeed($scope: GlobalScope, byteSize: number): Promise<any> {

    if (!$scope.userId) {
        throw new Error("null userId");
    }

    if (!$scope.serverAddress) {
        throw new Error("null serverAddress");
    }

    let url = getUrl($scope.serverAddress, "Playback/BitrateTest");
    url += "?size=" + byteSize;

    const now = new Date().getTime();

    return ajax({
        type: "GET",
        url: url,
        headers: getSecurityHeaders($scope.accessToken, $scope.userId),
        timeout: 5000
    }).then(function () {
        const responseTimeSeconds = (new Date().getTime() - now) / 1000;
        const bytesPerSecond = byteSize / responseTimeSeconds;
        const bitrate = Math.round(bytesPerSecond * 8);

        return bitrate;
    });
}

export function detectBitrate($scope: GlobalScope): Promise<number> {

    // First try a small amount so that we don't hang up their mobile connection
    return getDownloadSpeed($scope, 1000000).then(function (bitrate) {

        if (bitrate < 1000000) {
            return Math.round(bitrate * 0.8);
        } else {

            // If that produced a fairly high speed, try again with a larger size to get a more accurate result
            return getDownloadSpeed($scope, 2400000).then(function (bitrate) {

                return Math.round(bitrate * 0.8);
            });
        }

    });
}

export function stopActiveEncodings($scope: GlobalScope): Promise<any> {

    const options = {
        deviceId: window.deviceInfo.deviceId,
        PlaySessionId: undefined
    };

    if ($scope.playSessionId) {
        options.PlaySessionId = $scope.playSessionId;
    }

    const url = getUrl($scope.serverAddress, "Videos/ActiveEncodings");

    return ajax({
        type: "DELETE",
        headers: getSecurityHeaders($scope.accessToken, $scope.userId),
        url: url,
        query: options
    });
}
