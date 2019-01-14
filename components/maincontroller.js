define(['datetime', 'embyactions', 'browserdeviceprofile', '//www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js'], function (datetime, embyActions, deviceProfileBuilder) {

    window.castReceiverContext = cast.framework.CastReceiverContext.getInstance();
    window.mediaManager = window.castReceiverContext.getPlayerManager();
    window.mediaManager.addEventListener(cast.framework.events.category.CORE,
        event => {
          console.log("Core event: " + event.type);
          console.log(event);
        });
      
    const playbackConfig = new cast.framework.PlaybackConfig();

    // Set the player to start playback as soon as there are five seconds of
    // media content buffered. Default is 10.
    playbackConfig.autoResumeDuration = 5;

    setInterval(updateTimeOfDay, 40000);

    // According to cast docs this should be disabled when not needed
    //cast.receiver.logger.setLevelValue(cast.receiver.LoggerLevel.ERROR);

    var init = function () {

        resetPlaybackScope($scope);
    };

    init();

    embyActions.setApplicationClose();

    var mgr = window.mediaManager;

    var broadcastToServer = new Date();

    function onMediaElementTimeUpdate(e) {
        if ($scope.isChangingStream) {
            return;
        }

        var now = new Date();

        var elapsed = now - broadcastToServer;

        if (elapsed > 5000) {
            // TODO use status as input
            embyActions.reportPlaybackProgress($scope, getReportingParams($scope));
            broadcastToServer = now;
        }
        else if (elapsed > 1500) {
            // TODO use status as input
            embyActions.reportPlaybackProgress($scope, getReportingParams($scope), false);
        }
    }

    function onMediaElementPause() {

        if ($scope.isChangingStream) {
            return;
        }

        reportEvent('playstatechange', true);
    }

    function onMediaElementPlaying() {

        if ($scope.isChangingStream) {
            return;
        }

        reportEvent('playstatechange', true);
    }

    function onMediaElementVolumeChange() {

        var volume = window.mediaElement.volume;
        window.VolumeInfo.Level = volume * 100;
        window.VolumeInfo.IsMuted = volume == 0;

        reportEvent('volumechange', true);
    }

    function enableTimeUpdateListener(enabled) {
        if (enabled) {
            window.mediaManager.addEventListener(cast.framework.events.EventType.TIME_UPDATE, onMediaElementTimeUpdate);
            window.mediaManager.addEventListener(cast.framework.events.EventType.REQUEST_VOLUME_CHANGE, onMediaElementVolumeChange);
            window.mediaManager.addEventListener(cast.framework.events.EventType.PAUSE, onMediaElementPause);
            window.mediaManager.addEventListener(cast.framework.events.EventType.PLAYING, onMediaElementPlaying);
        } else {
            window.mediaManager.removeEventListener(cast.framework.events.EventType.TIME_UPDATE, onMediaElementTimeUpdate);
            window.mediaManager.removeEventListener(cast.framework.events.EventType.REQUEST_VOLUME_CHANGE, onMediaElementVolumeChange);
            window.mediaManager.removeEventListener(cast.framework.events.EventType.PAUSE, onMediaElementPause);
            window.mediaManager.removeEventListener(cast.framework.events.EventType.PLAYING, onMediaElementPlaying);
        }
    }

    function isPlaying() {
        return window.mediaManager.getPlayerState() === cast.framework.messages.PlayerState.PLAYING;
    }

    window.addEventListener('beforeunload', function () {

        // Try to cleanup after ourselves before the page closes
        enableTimeUpdateListener(false);
        embyActions.reportPlaybackStopped($scope, getReportingParams($scope));
    });

    mgr.defaultOnPlay = function (event) {

        embyActions.play($scope, event);
        embyActions.reportPlaybackProgress($scope, getReportingParams($scope));
    };
    mgr.addEventListener('PLAY', mgr.defaultOnPlay);

    mgr.defaultOnPause = function (event) {
        embyActions.pause($scope);
        embyActions.reportPlaybackProgress($scope, getReportingParams($scope));
    };
    mgr.addEventListener('PAUSE', mgr.defaultOnPause);

    mgr.defaultOnStop = function (event) {
        stop();
    };
    mgr.addEventListener('ABORT', mgr.defaultOnStop);

    mgr.addEventListener('ENDED', function () {

        // Ignore
        if ($scope.isChangingStream) {
            return;
        }

        embyActions.setApplicationClose();
        enableTimeUpdateListener(false);
        embyActions.reportPlaybackStopped($scope, getReportingParams($scope));
        init();

        if (!playNextItem()) {
            window.playlist = [];
            window.currentPlaylistIndex = -1;
            embyActions.displayUserInfo($scope, $scope.serverAddress, $scope.accessToken, $scope.userId);
        }
    });

    function stop(nextMode) {

        $scope.playNextItem = nextMode ? true : false;
        embyActions.stop($scope);
        enableTimeUpdateListener(false);

        var reportingParams = getReportingParams($scope);

        var promise;

        embyActions.stopPingInterval();

        if (reportingParams.ItemId) {
            promise = embyActions.reportPlaybackStopped($scope, reportingParams);
        }

        window.mediaManager.stop();
        promise = promise || Promise.resolve();

        return promise;
    }

    window.castReceiverContext.addEventListener(cast.framework.system.EventType.SYSTEM_VOLUME_CHANGED, function (event) {
        console.log("### Cast Receiver Manager - System Volume Changed : " + JSON.stringify(event.data));
        
        if ($scope.userId != null) {
            reportEvent('volumechange', true);
        }
    });

    console.log('Application is ready, starting system');

    function cleanName(name) {

        return name.replace(/[^\w\s]/gi, '');
    }

    function processMessage(data) {

        if (!data.command || !data.serverAddress || !data.userId || !data.accessToken) {

            console.log('Invalid message sent from sender. Sending error response');

            broadcastToMessageBus({
                type: 'error',
                message: "Missing one or more required params - command,options,userId,accessToken,serverAddress"
            });
            return;
        }

        $scope.userId = data.userId;
        $scope.accessToken = data.accessToken;
        $scope.serverAddress = data.serverAddress;

        data.options = data.options || {};
        var cleanReceiverName = cleanName(data.receiverName || '');
        window.deviceInfo.deviceName = cleanReceiverName || window.deviceInfo.deviceName;
        // deviceId just needs to be unique-ish
        window.deviceInfo.deviceId = cleanReceiverName ? btoa(cleanReceiverName) : window.deviceInfo.deviceId;

        if (data.maxBitrate) {
            window.MaxBitrate = data.maxBitrate;
        }

        // Items will have properties - Id, Name, Type, MediaType, IsFolder

        var reportEventType;
        var systemVolume = window.castReceiverContext.getSystemVolume();

        if (data.command == 'PlayLast' || data.command == 'PlayNext') {

            translateItems(data, data.options, data.options.items, data.command);
        }
        else if (data.command == 'Shuffle') {
            shuffle(data, data.options, data.options.items[0]);
        }
        else if (data.command == 'InstantMix') {
            instantMix(data, data.options, data.options.items[0]);
        }
        else if (data.command == 'DisplayContent') {

            if (!isPlaying()) {

                console.log('DisplayContent');

                embyActions.displayItem($scope, data.serverAddress, data.accessToken, data.userId, data.options.ItemId);
            }

        }
        else if (data.command == 'NextTrack') {

            if (window.playlist && window.currentPlaylistIndex < window.playlist.length - 1) {
                playNextItem({}, true);
            }

        }
        else if (data.command == 'PreviousTrack') {

            if (window.playlist && window.currentPlaylistIndex > 0) {
                playPreviousItem({});
            }

        }
        else if (data.command == 'SetAudioStreamIndex') {
            setAudioStreamIndex($scope, data.options.index, data.serverAddress);
        }
        else if (data.command == 'SetSubtitleStreamIndex') {

            setSubtitleStreamIndex($scope, data.options.index, data.serverAddress);
        }
        else if (data.command == 'VolumeUp') {
            window.castReceiverContext.setSystemVolumeLevel(Math.min(1, systemVolume.level + 0.2));
        }
        else if (data.command == 'VolumeDown') {
            window.castReceiverContext.setSystemVolumeLevel(Math.max(0, systemVolume.level - 0.2));
        }
        else if (data.command == 'ToggleMute') {
            window.castReceiverContext.setSystemVolumeMuted(!systemVolume.muted);
        }
        else if (data.command == 'Identify') {

            if (!isPlaying()) {
                embyActions.displayUserInfo($scope, data.serverAddress, data.accessToken, data.userId);
            }
        }
        else if (data.command == 'SetVolume') {
            // Scale 0-100
            window.castReceiverContext.setSystemVolumeLevel(data.options.volume / 100);
        }
        else if (data.command == 'Seek') {
            seek(data.options.position * 10000000);
        }
        else if (data.command == 'Mute') {
            window.castReceiverContext.setSystemVolumeMuted(true);
         }
        else if (data.command == 'Unmute') {
            window.castReceiverContext.setSystemVolumeMuted(false);
        }
        else if (data.command == 'Stop') {
            stop();
        }
        else if (data.command == 'PlayPause') {

            if (window.mediaManager.getPlayerState() === cast.framework.messages.PlayerState.PAUSED) {
                window.mediaManager.play();
            } else {
                window.mediaManager.pause();
            }
        }
        else if (data.command == 'Pause') {
            window.mediaManager.pause();
        }
        else if (data.command == 'SetRepeatMode') {
            window.repeatMode = data.options.RepeatMode;
            reportEventType = 'repeatmodechange';
        }
        else if (data.command == 'Unpause') {
            window.mediaManager.play();
        }
        else {

            translateItems(data, data.options, data.options.items, 'play');
        }

        if (reportEventType) {

            var report = function () {
                embyActions.reportPlaybackProgress($scope, getReportingParams($scope));
            };
            embyActions.reportPlaybackProgress($scope, getReportingParams($scope), true, reportEventType);
            setTimeout(report, 100);
            setTimeout(report, 500);
        }
    }

    function reportEvent(name, reportToServer) {
        embyActions.reportPlaybackProgress($scope, getReportingParams($scope), reportToServer, name);
    }

    function setSubtitleStreamIndex($scope, index, serverAddress) {

        console.log('setSubtitleStreamIndex. index: ' + index);

        var currentSubtitleStream = $scope.mediaSource.MediaStreams.filter(function (m) {
            return m.Index == $scope.subtitleStreamIndex && m.Type == 'Subtitle';
        })[0];
        var currentDeliveryMethod = currentSubtitleStream ? currentSubtitleStream.DeliveryMethod : null;

        if (index == -1 || index == null) {

            // Need to change the stream to turn off the subs
            if (currentDeliveryMethod == 'Encode') {
                console.log('setSubtitleStreamIndex video url change required');
                var positionTicks = getCurrentPositionTicks($scope);
                changeStream(positionTicks, { SubtitleStreamIndex: -1 });
            } else {
                $scope.subtitleStreamIndex = -1;
                setTextTrack($scope);
            }
            return;
        }

        var mediaStreams = $scope.PlaybackMediaSource.MediaStreams;

        var subtitleStream = getStreamByIndex(mediaStreams, 'Subtitle', index);

        if (!subtitleStream) {
            console.log('setSubtitleStreamIndex error condition - subtitle stream not found.');
            return;
        }

        console.log('setSubtitleStreamIndex DeliveryMethod:' + subtitleStream.DeliveryMethod);

        if (subtitleStream.DeliveryMethod == 'External' || currentDeliveryMethod == 'Encode') {

            var textStreamUrl = subtitleStream.IsExternalUrl ? subtitleStream.DeliveryUrl : (getUrl(serverAddress, subtitleStream.DeliveryUrl));

            console.log('Subtitle url: ' + textStreamUrl);
            setTextTrack($scope, textStreamUrl, index);
            $scope.subtitleStreamIndex = subtitleStream.Index;
            return;
        } else {
            console.log('setSubtitleStreamIndex video url change required');
            var positionTicks = getCurrentPositionTicks($scope);
            changeStream(positionTicks, { SubtitleStreamIndex: index });
        }
    }

    function setAudioStreamIndex($scope, index, serverAddress) {

        var positionTicks = getCurrentPositionTicks($scope);
        changeStream(positionTicks, { AudioStreamIndex: index });
    }

    function seek(ticks) {
        changeStream(ticks);
    }

    function changeStream(ticks, params) {
        debugger;

        if (ticks) {
            ticks = parseInt(ticks);
        }

        if ($scope.canClientSeek && params == null) {

            window.mediaElement.currentTime = ticks / 10000000;
            embyActions.reportPlaybackProgress($scope, getReportingParams($scope));
            return;
        }

        params = params || {};

        var playSessionId = $scope.playSessionId;
        var liveStreamId = $scope.liveStreamId;

        var item = $scope.item;
        var mediaType = item.MediaType;

        getMaxBitrate(mediaType).then(function (maxBitrate) {

            var deviceProfile = getDeviceProfile(maxBitrate);

            var audioStreamIndex = params.AudioStreamIndex == null ? $scope.audioStreamIndex : params.AudioStreamIndex;
            var subtitleStreamIndex = params.SubtitleStreamIndex == null ? $scope.subtitleStreamIndex : params.SubtitleStreamIndex;

            embyActions.getPlaybackInfo(item, maxBitrate, deviceProfile, ticks, $scope.mediaSourceId, audioStreamIndex, subtitleStreamIndex, liveStreamId).then(function (result) {

                if (validatePlaybackInfoResult(result)) {

                    var mediaSource = result.MediaSources[0];

                    var streamInfo = createStreamInfo(item, mediaSource, ticks);

                    if (!streamInfo.url) {
                        showPlaybackInfoErrorMessage('NoCompatibleStream');
                        //self.nextTrack();
                        return;
                    }

                    changeStreamToUrl(playSessionId, mediaType, streamInfo);
                    $scope.subtitleStreamIndex = subtitleStreamIndex;
                    $scope.audioStreamIndex = audioStreamIndex;
                }
            });
        });
    }

    function changeStreamToUrl(playSessionId, mediaType, streamInfo) {

        $scope.isChangingStream = true;

        var requiresStoppingTranscoding = mediaType == "Video";
        // TODO: Reactivate for HLS
        requiresStoppingTranscoding = false;

        if (requiresStoppingTranscoding) {

            window.mediaElement.pause();

            embyActions.stopActiveEncodings(playSessionId).then(function () {

                setSrcIntoRenderer(streamInfo);
            });

        } else {

            setSrcIntoRenderer(streamInfo);
        }
    }

    // Create a message handler for the custome namespace channel
    // TODO save namespace somewhere global?
    window.castReceiverContext.addCustomMessageListener('urn:x-cast:com.jellyfin.cast', function(evt) {
        console.log('Playlist message: ' + JSON.stringify(evt));

        var data = evt.data;

        data.options = data.options || {};
        data.options.senderId = evt.senderId;
        // TODO set it somewhere better perhaps
        window.senderId = evt.senderId;

        processMessage(data);
    });

    function tagItems(items, data) {

        // Attach server data to the items
        // Once day the items could be coming from multiple servers, each with their own security info
        for (var i = 0, length = items.length; i < length; i++) {

            items[i].userId = data.userId;
            items[i].accessToken = data.accessToken;
            items[i].serverAddress = data.serverAddress;
        }
    }

    function translateItems(data, options, items, method) {

        var callback = function (result) {

            options.items = result.Items;
            tagItems(options.items, data);

            if (method == 'PlayNext' || method == 'PlayLast') {
                queue(options.items, method);
            } else {
                playFromOptions(data.options);
            }
        };

        var smartTranslate = method != 'PlayNext' && method != 'PlayLast';
        translateRequestedItems(data.serverAddress, data.accessToken, data.userId, items, smartTranslate).then(callback);
    }

    function instantMix(data, options, item) {

        getInstantMixItems(data.serverAddress, data.accessToken, data.userId, item).then(function (result) {

            options.items = result.Items;
            tagItems(options.items, data);
            playFromOptions(data.options);
        });
    }

    function shuffle(data, options, item) {

        getShuffleItems(data.serverAddress, data.accessToken, data.userId, item).then(function (result) {

            options.items = result.Items;
            tagItems(options.items, data);
            playFromOptions(data.options);
        });
    }

    function queue(items, method) {

        for (var i = 0, length = items.length; i < length; i++) {

            window.playlist.push(items[i]);
        }
    }

    function playFromOptions(options) {

        var firstItem = options.items[0];

        if (options.startPositionTicks || firstItem.MediaType !== 'Video') {
            playFromOptionsInternal(options);
            return;
        }

        getIntros(firstItem.serverAddress, firstItem.accessToken, firstItem.userId, firstItem).then(function (intros) {

            tagItems(intros.Items, {
                userId: firstItem.userId,
                accessToken: firstItem.accessToken,
                serverAddress: firstItem.serverAddress
            });

            options.items = intros.Items.concat(options.items);
            playFromOptionsInternal(options);
        });
    }

    function playFromOptionsInternal(options) {

        var stopPlayer = window.playlist && window.playlist.length > 0;

        window.playlist = options.items;
        window.currentPlaylistIndex = -1;
        playNextItem(options, stopPlayer);
    }

    // Plays the next item in the list
    function playNextItem(options, stopPlayer) {

        var nextItemInfo = getNextPlaybackItemInfo();

        if (nextItemInfo) {
            window.currentPlaylistIndex = nextItemInfo.index;

            var item = nextItemInfo.item;

            playItem(item, options || {}, stopPlayer);
            return true;
        }

        return false;
    }

    function playPreviousItem(options) {

        var playlist = window.playlist;

        if (playlist && window.currentPlaylistIndex > 0) {
            window.currentPlaylistIndex--;

            var item = playlist[window.currentPlaylistIndex];

            playItem(item, options || {}, true);
            return true;
        }
        return false;
    }

    function playItem(item, options, stopPlayer) {

        var callback = function () {
            onStopPlayerBeforePlaybackDone(item, options);
        };

        if (stopPlayer) {

            stop("none").then(callback);
        }
        else {
            callback();
        }
    }

    function onStopPlayerBeforePlaybackDone(item, options) {

        var requestUrl = getUrl(item.serverAddress, 'Users/' + item.userId + '/Items/' + item.Id);

        return fetchhelper.ajax({

            url: requestUrl,
            headers: getSecurityHeaders(item.accessToken, item.userId),
            dataType: 'json',
            type: 'GET'

        }).then(function (data) {

            // Attach the custom properties we created like userId, serverAddress, itemId, etc
            extend(data, item);

            playItemInternal(data, options);

        }, broadcastConnectionErrorMessage);
    }

    function getDeviceProfile(maxBitrate) {

        var transcodingAudioChannels = document.createElement('video').canPlayType('audio/mp4; codecs="ac-3"').replace(/no/, '') ?
            6 :
            2;

        var profile = deviceProfileBuilder({
            supportsCustomSeeking: true,
            audioChannels: transcodingAudioChannels
        });

        profile.MaxStreamingBitrate = maxBitrate;
        profile.MaxStaticBitrate = maxBitrate;
        profile.MusicStreamingTranscodingBitrate = 192000;

        // This needs to be forced
        profile.DirectPlayProfiles.push({
            Container: "flac",
            Type: 'Audio'
        });

        profile.SubtitleProfiles = [];
        profile.SubtitleProfiles.push({
            Format: 'js',
            Method: 'External'
        });

        return profile;
    }

    function playItemInternal(item, options) {

        $scope.isChangingStream = false;
        setAppStatus('loading');

        getMaxBitrate(item.MediaType).then(function (maxBitrate) {

            var deviceProfile = getDeviceProfile(maxBitrate);

            embyActions.getPlaybackInfo(item, maxBitrate, deviceProfile, options.startPositionTicks, options.mediaSourceId, options.audioStreamIndex, options.subtitleStreamIndex).then(function (result) {

                if (validatePlaybackInfoResult(result)) {

                    var mediaSource = getOptimalMediaSource(item.MediaType, result.MediaSources);

                    if (mediaSource) {

                        if (mediaSource.RequiresOpening) {

                            embyActions.getLiveStream(item, result.PlaySessionId, maxBitrate, deviceProfile, options.startPositionTicks, mediaSource, null, null).then(function (openLiveStreamResult) {

                                openLiveStreamResult.MediaSource.enableDirectPlay = supportsDirectPlay(openLiveStreamResult.MediaSource);
                                playMediaSource(result.PlaySessionId, item, openLiveStreamResult.MediaSource, options);
                            });

                        } else {
                            playMediaSource(result.PlaySessionId, item, mediaSource, options);
                        }
                    } else {
                        showPlaybackInfoErrorMessage('NoCompatibleStream');
                    }
                }

            }, broadcastConnectionErrorMessage);
        });
    }

    var lastBitrateDetect = 0;
    var detectedBitrate = 0;
    function getMaxBitrate(mediaType) {

        console.log('getMaxBitrate');

        return new Promise(function (resolve, reject) {

            if (window.MaxBitrate) {
                console.log('bitrate is set to ' + window.MaxBitrate);

                resolve(Math.min(window.MaxBitrate || window.BitrateCap, window.BitrateCap));
                return;
            }

            if (detectedBitrate && (new Date().getTime() - lastBitrateDetect) < 600000) {
                console.log('returning previous detected bitrate of ' + detectedBitrate);
                resolve(Math.min(detectedBitrate, window.DetectedBitrateCap));
                return;
            }

            if (mediaType != 'Video') {
                // We don't need to bother with bitrate detection for music
                resolve(window.DefaultMaxBitrate);
                return;
            }

            console.log('detecting bitrate');

            embyActions.detectBitrate($scope).then(function (bitrate) {

                console.log('Max bitrate auto detected to ' + bitrate);
                lastBitrateDetect = new Date().getTime();
                detectedBitrate = bitrate;

                resolve(Math.min(detectedBitrate, window.DetectedBitrateCap));

            }, function () {

                console.log('Error detecting bitrate, will return default value.');
                resolve(window.DefaultMaxBitrate);
            });
        });
    }

    function validatePlaybackInfoResult(result) {

        if (result.ErrorCode) {

            showPlaybackInfoErrorMessage(result.ErrorCode);
            return false;
        }

        return true;
    }

    function showPlaybackInfoErrorMessage(errorCode) {

        broadcastToMessageBus({
            type: 'playbackerror',
            message: errorCode
        });
    }

    function getOptimalMediaSource(mediaType, versions) {

        var optimalVersion = versions.filter(function (v) {

            v.enableDirectPlay = supportsDirectPlay(v);

            return v.enableDirectPlay;

        })[0];

        if (!optimalVersion) {
            optimalVersion = versions.filter(function (v) {

                return v.SupportsDirectStream;

            })[0];
        }

        return optimalVersion || versions.filter(function (s) {
            return s.SupportsTranscoding;
        })[0];
    }

    function supportsDirectPlay(mediaSource) {

        if (mediaSource.SupportsDirectPlay && mediaSource.Protocol == 'Http' && !mediaSource.RequiredHttpHeaders.length) {

            // TODO: Need to verify the host is going to be reachable
            return true;
        }

        return false;
    }

    function setTextTrack($scope, subtitleStreamUrl, index) {

        try {
            var tracks = window.mediaManager.getTextTracksManager().getTracks();
            var subtitleTrack = tracks.filter(function(track) {
                return track.Index === index && track.Type === 'SUBTITLES'
            });
            if (subtitleTrack) {
                window.mediaManager.getTextTracksManager().setActiveByIds([subtitleTrack.Index]);
            }
        } catch(e) {
            console.log("Setting subtitle track failed: " + e);
        }

        // while (window.mediaElement.firstChild) {
        //     window.mediaElement.removeChild(window.mediaElement.firstChild);
        // }
        // var track;
        // if (window.mediaManager.getTextTracksManager().getTracks().length == 0) {
        //     window.mediaElement.addTextTrack("subtitles");
        // }
        // track = window.mediaElement.textTracks[0];
        // var cues = track.cues;
        // for (var i = cues.length - 1 ; i >= 0 ; i--) {
        //     track.removeCue(cues[i]);
        // }
        // if (subtitleStreamUrl) {
        //     embyActions.getSubtitle($scope, subtitleStreamUrl).then(function (data) {

        //         track.mode = "showing";

        //         data.TrackEvents.forEach(function (trackEvent) {
        //             track.addCue(new VTTCue(trackEvent.StartPositionTicks / 10000000, trackEvent.EndPositionTicks / 10000000, trackEvent.Text.replace(/\\N/gi, '\n')));
        //         });
        //     });
        // }
    }

    function playMediaSource(playSessionId, item, mediaSource, options) {

        setAppStatus('loading');

        var streamInfo = createStreamInfo(item, mediaSource, options.startPositionTicks);

        var url = streamInfo.url;
        //window.mediaManager.getTextTracksManager().addTracks(streamInfo.tracks);
        console.log('setting setTextTrack to ' + (streamInfo.subtitleStreamUrl || ''));
        //setTextTrack($scope, streamInfo.subtitleStreamUrl);

        var mediaInfo = new cast.framework.messages.MediaInformation();
        mediaInfo.contentId = url;
        mediaInfo.contentType = streamInfo.contentType;
        mediaInfo.customData = {
            startPositionTicks: options.startPositionTicks || 0,
            serverAddress: item.serverAddress,
            userId: item.userId,
            itemId: item.Id,
            mediaSourceId: streamInfo.mediaSource.Id,
            audioStreamIndex: streamInfo.audioStreamIndex,
            subtitleStreamIndex: streamInfo.subtitleStreamIndex,
            playMethod: streamInfo.isStatic ? 'DirectStream' : 'Transcode',
            runtimeTicks: streamInfo.mediaSource.RunTimeTicks,
            liveStreamId: streamInfo.mediaSource.LiveStreamId,
            accessToken: item.accessToken,
            canSeek: streamInfo.canSeek,
            canClientSeek: streamInfo.canClientSeek,
            playSessionId: playSessionId
        }
        mediaInfo.metadata = new cast.framework.messages.GenericMediaMetadata();
        mediaInfo.streamType = cast.framework.messages.StreamType.BUFFERED;
        mediaInfo.tracks = streamInfo.tracks;

        if (streamInfo.mediaSource.RunTimeTicks) {
            mediaInfo.duration = Math.floor(streamInfo.mediaSource.RunTimeTicks / 10000000);
        }

        mediaInfo.customData.startPositionTicks = streamInfo.startPosition || 0;

        var loadRequestData = new cast.framework.messages.LoadRequestData();
        loadRequestData.media = mediaInfo;
        loadRequestData.autoplay = true;

        embyActions.load($scope, mediaInfo.customData, item);
        window.mediaManager.load(loadRequestData);

        $scope.PlaybackMediaSource = mediaSource;

        var autoplay = true;

        console.log('setting src to ' + url);
        // window.mediaElement.autoplay = true;
        // window.mediaElement.src = url;
        $scope.mediaSource = mediaSource;

        // console.log('calling mediaElement.load');
        // window.mediaElement.load();

        if (autoplay) {
            //window.mediaElement.pause();
            console.log('calling embyActions.delayStart');
            embyActions.delayStart($scope);
        }
        enableTimeUpdateListener(false);
        enableTimeUpdateListener(true);

        setMetadata(item, mediaInfo.metadata, datetime);

        // We use false as we do not want to broadcast the new status yet
        // we will broadcast manually when the media has been loaded, this
        // is to be sure the duration has been updated in the media element
        window.mediaManager.setMediaInformation(mediaInfo, false);
    }

    window.castReceiverContext.start();
});