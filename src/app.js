import "./components/maincontroller";

window.deviceInfo = {
    deviceId: "chromecast_" + new Date().getTime(),
    deviceName: 'Chromecast',
    versionNumber: '3.0.0'
};

window.mediaElement = document.getElementById('video-player');

window.playlist = [];
window.currentPlaylistIndex = -1;
window.repeatMode = "RepeatNone";

// Global variable set by Webpack
if (!PRODUCTION) {
    cast.framework.CastReceiverContext.getInstance().setLoggerLevel(cast.framework.LoggerLevel.DEBUG);
} else {
    cast.framework.CastReceiverContext.getInstance().setLoggerLevel(cast.framework.LoggerLevel.NONE);
}