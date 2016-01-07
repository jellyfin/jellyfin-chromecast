var BitrateCap = 20000000;
var DetectedBitrateCap = 11000000;
var DefaultMaxBitrate = 3000000;
var MaxBitrate = null;

window.deviceInfo = {
    deviceId: "chromecast_" + new Date().getTime(),
    deviceName: 'Chromecast',
    versionNumber: '2.0.000'
};

window.mediaElement = document.getElementById('video-player');

window.playlist = [];
window.currentPlaylistIndex = -1;
window.repeatMode = "RepeatNone";

function unloadPlayer() {
    if (window.player !== null && window.player !== undefined) {
        window.player.unload();    // Must unload before starting again.
        window.player = null;
    }
}

window.VolumeInfo = {
    IsMuted: false,
    Level: 100
};

function clearMediaElement() {
    document.getElementById('video-player').src = "";
}

function broadcastToMessageBus(msg) {

    window.playlistMessageBus.broadcast(msg);
}

function broadcastConnectionErrorMessage() {

    broadcastToMessageBus({
        type: 'connectionerror',
        message: ""
    });
}

function initRequire(customPaths) {

    console.log('Initializing requirejs');

    var bowerPath = "bower_components";
    var embyWebComponentsBowerPath = bowerPath + '/emby-webcomponents';

    var paths = {
        datetime: embyWebComponentsBowerPath + "/datetime",
        browserdeviceprofile: embyWebComponentsBowerPath + "/browserdeviceprofile",
        browser: embyWebComponentsBowerPath + "/browser",
        qualityoptions: embyWebComponentsBowerPath + "/qualityoptions",
        isMobile: "bower_components/isMobile/isMobile.min",
        embyactions: 'components/embyactions',
        maincontroller: 'components/maincontroller',
        events: 'bower_components/emby-apiclient/events',
        credentialprovider: 'bower_components/emby-apiclient/credentials',
        apiclient: 'bower_components/emby-apiclient/apiclient',
        connectservice: 'bower_components/emby-apiclient/connectservice',
        serverdiscovery: "bower_components/emby-apiclient/serverdiscovery",
        wakeonlan: "bower_components/emby-apiclient/wakeonlan",
        fetchhelper: embyWebComponentsBowerPath + "/fetchhelper"
    };

    var urlArgs = "t=" + new Date().getTime();

    var sha1Path = bowerPath + "/cryptojslib/components/sha1-min";
    var md5Path = bowerPath + "/cryptojslib/components/md5-min";
    var shim = {};

    shim[sha1Path] = {
        deps: [bowerPath + "/cryptojslib/components/core-min"]
    };

    shim[md5Path] = {
        deps: [bowerPath + "/cryptojslib/components/core-min"]
    };

    var config = {

        waitSeconds: 30,
        urlArgs: urlArgs,

        paths: paths,
        map: {
            '*': {
                'css': embyWebComponentsBowerPath + '/requirecss',
                'html': embyWebComponentsBowerPath + '/requirehtml'
            }
        },
        shim: shim
    };

    var baseRoute = window.location.href.split('?')[0].replace('/index.html', '');
    if (baseRoute.lastIndexOf('/') == baseRoute.length - 1) {
        baseRoute = baseRoute.substring(0, baseRoute.length - 1);
    }

    console.log('Setting require baseUrl to ' + baseRoute);

    config.baseUrl = baseRoute;

    requirejs.config(config);

    define("cryptojs-sha1", [sha1Path]);
    define("cryptojs-md5", [md5Path]);
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