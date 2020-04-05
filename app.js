var DefaultMaxBitrate = 10000000;
var MaxBitrate = null;

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

function initRequire(customPaths) {

    console.log('Initializing requirejs');

    var bowerPath = "jellyfin-web/src/bower_components";
    var embyWebComponentsBowerPath = bowerPath + '/emby-webcomponents';

    var paths = {
        browserdeviceprofile: embyWebComponentsBowerPath + "/browserdeviceprofile",
        castdevices: "./components/castDevices",
        browser: embyWebComponentsBowerPath + "/browser",
        jellyfinactions: 'components/jellyfinactions',
        maincontroller: 'components/maincontroller',
        apiclient: 'bower_components/emby-apiclient/apiclient',
        fetchhelper: embyWebComponentsBowerPath + "/fetchhelper"
    };

    var urlArgs = "t=" + new Date().getTime();

    var config = {

        waitSeconds: 0,
        urlArgs: urlArgs,

        paths: paths,
        map: {
            '*': {
                'css': embyWebComponentsBowerPath + '/requirecss',
                'html': embyWebComponentsBowerPath + '/requirehtml'
            }
        }
    };

    requirejs.config(config);
    
    // mock this for now. not used in this app
    define("globalize", [], function () {
        return {
            getCurrentLocale: function () {

                if (navigator.language) {
                    return navigator.language;
                }
                if (navigator.userLanguage) {
                    return navigator.userLanguage;
                }
                if (navigator.languages && navigator.languages.length) {
                    return navigator.languages[0];
                }

                return 'en-us';
            }
        };
    });
}

function startApp() {

    initRequire();

    // Just until we're able to deprecate this
    window.$scope = {};

    require(['fetchhelper', 'maincontroller', 'helpers'], function (fetchhelper, maincontroller) {
        window.fetchhelper = fetchhelper;
    });
}

startApp();
