import "./components/maincontroller";
import { CastReceiverContext, PlayerManager } from "chromecast-caf-receiver/cast.framework";

declare global {
    var $scope;

    interface Window {
        castReceiverContext : CastReceiverContext,
        mediaManager : PlayerManager,
        mediaElement,
        VolumeInfo,
        playlist,
        currentPlaylistIndex,
        hasReportedCapabilities,
        DefaultMaxBitrate
        MaxBitrate,
        commandHandler,
        deviceInfo,
        reportEventType,
        senderId,
        subtitleAppearance,
        repeatMode,
    }
}

let senders = CastReceiverContext.getInstance().getSenders();
let id = senders.length !== 0 && senders[0].id ? senders[0].id : new Date().getTime();

window.deviceInfo = {
    deviceId: id,
    deviceName: 'Google Cast',
    versionNumber: '3.0.0'
};

window.mediaElement = document.getElementById('video-player');

window.playlist = [];
window.currentPlaylistIndex = -1;
window.repeatMode = "RepeatNone";

declare var PRODUCTION;

// Global variable set by Webpack
if (!PRODUCTION) {
    cast.framework.CastReceiverContext.getInstance().setLoggerLevel(cast.framework.LoggerLevel.DEBUG);
} else {
    cast.framework.CastReceiverContext.getInstance().setLoggerLevel(cast.framework.LoggerLevel.NONE);
}
