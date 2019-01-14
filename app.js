var BitrateCap = 20000000;
var DetectedBitrateCap = 11000000;
var DefaultMaxBitrate = 3000000;
var MaxBitrate = null;

window.deviceInfo = {
    deviceId: "chromecast_" + new Date().getTime(),
    deviceName: 'Chromecast',
    versionNumber: '2.1.0'
};

window.mediaElement = document.getElementById('video-player');

window.playlist = [];
window.currentPlaylistIndex = -1;
window.repeatMode = "RepeatNone";

function broadcastToMessageBus(msg) {

    window.castReceiverContext.sendCustomMessage('urn:x-cast:com.jellyfin.cast', window.senderId, msg);
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
        datetime: embyWebComponentsBowerPath + "/datetime",
        browserdeviceprofile: embyWebComponentsBowerPath + "/browserdeviceprofile",
        browser: embyWebComponentsBowerPath + "/browser",
        qualityoptions: embyWebComponentsBowerPath + "/qualityoptions",
        embyactions: 'components/embyactions',
        maincontroller: 'components/maincontroller',
        events: 'bower_components/emby-apiclient/events',
        credentialprovider: 'bower_components/emby-apiclient/credentials',
        apiclient: 'bower_components/emby-apiclient/apiclient',
        serverdiscovery: "bower_components/emby-apiclient/serverdiscovery",
        wakeonlan: "bower_components/emby-apiclient/wakeonlan",
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

    require(['fetchhelper', 'maincontroller', 'datetime', 'helpers'], function (fetchhelper, maincontroller, datetime) {
        window.datetime = datetime;
        window.fetchhelper = fetchhelper;
    });
}

startApp();
