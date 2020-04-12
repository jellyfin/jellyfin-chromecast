import "./components/maincontroller";

var DefaultMaxBitrate = 10000000;
var MaxBitrate = null;

// Just until we're able to deprecate this
$scope = {};

window.deviceInfo = {
    deviceId: "chromecast_" + new Date().getTime(),
    deviceName: 'Chromecast',
    versionNumber: '3.0.0'
};

window.mediaElement = document.getElementById('video-player');

window.playlist = [];
window.currentPlaylistIndex = -1;
window.repeatMode = "RepeatNone";

function broadcastToMessageBus(msg) {
    window.castReceiverContext.sendCustomMessage('urn:x-cast:com.connectsdk', window.senderId, msg);
}

function broadcastConnectionErrorMessage() {

    broadcastToMessageBus({
        type: 'connectionerror',
        message: ""
    });
}