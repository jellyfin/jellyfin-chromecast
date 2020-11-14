import "./components/maincontroller";

const senders = cast.framework.CastReceiverContext.getInstance().getSenders();
const id = senders.length !== 0 && senders[0].id ? senders[0].id : new Date().getTime();

window.deviceInfo = {
    deviceId: id,
    deviceName: 'Google Cast',
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
