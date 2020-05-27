/* eslint-disable */

import { ajax } from "./components/fetchhelper";

export function getUrl(serverAddress, name) {

    if (!name) {
        throw new Error("Url name cannot be empty");
    }

    var url = serverAddress;

    if (name.charAt(0) != '/') {
        url += '/';
    }

    url += name;

    return url;
}

export function getCurrentPositionTicks($scope) {

    var positionTicks = window.mediaManager.getCurrentTimeSec() * 10000000;
    var mediaInformation = window.mediaManager.getMediaInformation();
    if (mediaInformation && !mediaInformation.customData.canClientSeek) {
        positionTicks += ($scope.startPositionTicks || 0);
    }

    return positionTicks;
}

export function getReportingParams($scope) {
    var volumeInfo = window.castReceiverContext.getSystemVolume();
    return {
        PositionTicks: getCurrentPositionTicks($scope),
        IsPaused: window.mediaManager.getPlayerState() === cast.framework.messages.PlayerState.PAUSED,
        IsMuted: volumeInfo.muted,
        AudioStreamIndex: $scope.audioStreamIndex,
        SubtitleStreamIndex: $scope.subtitleStreamIndex,
        VolumeLevel: volumeInfo.level * 100,
        ItemId: $scope.itemId,
        MediaSourceId: $scope.mediaSourceId,
        QueueableMediaTypes: ['Audio', 'Video'],
        CanSeek: $scope.canSeek,
        PlayMethod: $scope.playMethod,
        LiveStreamId: $scope.liveStreamId,
        PlaySessionId: $scope.playSessionId,
        RepeatMode: window.repeatMode
    };
}

export function getNextPlaybackItemInfo() {

    var playlist = window.playlist;

    if (!playlist) {
        return null;
    }

    var newIndex;

    if (window.currentPlaylistIndex == -1) {
        newIndex = 0;
    } else {
        switch (window.repeatMode) {

            case 'RepeatOne':
                newIndex = window.currentPlaylistIndex;
                break;
            case 'RepeatAll':
                newIndex = window.currentPlaylistIndex + 1;
                if (newIndex >= window.playlist.length) {
                    newIndex = 0;
                }
                break;
            default:
                newIndex = window.currentPlaylistIndex + 1;
                break;
        }
    }

    if (newIndex < playlist.length) {

        var item = playlist[newIndex];

        return {
            item: item,
            index: newIndex
        };
    }
    return null;
}

export function getSenderReportingData($scope, reportingData) {
    var state = {
        ItemId: reportingData.ItemId,
        PlayState: extend({}, reportingData),
        QueueableMediaTypes: reportingData.QueueableMediaTypes
    };

    // Don't want this here
    state.PlayState.QueueableMediaTypes = null;
    delete state.PlayState.QueueableMediaTypes;
    state.PlayState.ItemId = null;
    delete state.PlayState.ItemId;

    state.NowPlayingItem = {

        Id: reportingData.ItemId,
        RunTimeTicks: $scope.runtimeTicks
    };

    var item = $scope.item;

    if (item) {

        var nowPlayingItem = state.NowPlayingItem;

        nowPlayingItem.ServerId = item.ServerId;
        nowPlayingItem.Chapters = item.Chapters || [];

        // TODO: Fill these
        var mediaSource = item.MediaSources.filter(function (m) {
            return m.Id == reportingData.MediaSourceId;
        })[0];

        nowPlayingItem.MediaStreams = mediaSource ? mediaSource.MediaStreams : [];

        nowPlayingItem.MediaType = item.MediaType;
        nowPlayingItem.Type = item.Type;
        nowPlayingItem.Name = item.Name;

        nowPlayingItem.IndexNumber = item.IndexNumber;
        nowPlayingItem.IndexNumberEnd = item.IndexNumberEnd;
        nowPlayingItem.ParentIndexNumber = item.ParentIndexNumber;
        nowPlayingItem.ProductionYear = item.ProductionYear;
        nowPlayingItem.PremiereDate = item.PremiereDate;
        nowPlayingItem.SeriesName = item.SeriesName;
        nowPlayingItem.Album = item.Album;
        nowPlayingItem.Artists = item.Artists;

        var imageTags = item.ImageTags || {};

        if (item.SeriesPrimaryImageTag) {

            nowPlayingItem.PrimaryImageItemId = item.SeriesId;
            nowPlayingItem.PrimaryImageTag = item.SeriesPrimaryImageTag;
        } else if (imageTags.Primary) {

            nowPlayingItem.PrimaryImageItemId = item.Id;
            nowPlayingItem.PrimaryImageTag = imageTags.Primary;
        } else if (item.AlbumPrimaryImageTag) {

            nowPlayingItem.PrimaryImageItemId = item.AlbumId;
            nowPlayingItem.PrimaryImageTag = item.AlbumPrimaryImageTag;
        }

        if (item.BackdropImageTags && item.BackdropImageTags.length) {

            nowPlayingItem.BackdropItemId = item.Id;
            nowPlayingItem.BackdropImageTag = item.BackdropImageTags[0];
        } else if (item.ParentBackdropImageTags && item.ParentBackdropImageTags.length) {

            nowPlayingItem.BackdropItemId = item.ParentBackdropItemId;
            nowPlayingItem.BackdropImageTag = item.ParentBackdropImageTags[0];
        }

        if (imageTags.Thumb) {

            nowPlayingItem.ThumbItemId = item.Id;
            nowPlayingItem.ThumbImageTag = imageTags.Thumb;
        }

        if (imageTags.Logo) {

            nowPlayingItem.LogoItemId = item.Id;
            nowPlayingItem.LogoImageTag = imageTags.Logo;
        } else if (item.ParentLogoImageTag) {

            nowPlayingItem.LogoItemId = item.ParentLogoItemId;
            nowPlayingItem.LogoImageTag = item.ParentLogoImageTag;
        }

        if ($scope.playNextItem) {
            var nextItemInfo = getNextPlaybackItemInfo();

            if (nextItemInfo) {
                state.NextMediaType = nextItemInfo.item.MediaType;
            }
        }
    }

    return state;
}

export function resetPlaybackScope($scope) {
    setAppStatus('waiting');

    setStartPositionTicks(0);
    setWaitingBackdrop('');
    $scope.mediaType = '';
    $scope.itemId = '';

    $scope.audioStreamIndex = null;
    $scope.subtitleStreamIndex = null;
    $scope.mediaSource = null;
    $scope.mediaSourceId = '';
    $scope.PlaybackMediaSource = null;

    $scope.playMethod = '';
    $scope.canSeek = false;
    $scope.canClientSeek = false;
    $scope.isChangingStream = false;
    $scope.playNextItem = true;

    $scope.item = null;
    $scope.liveStreamId = '';
    $scope.playSessionId = '';

    // Detail content
    setLogo('');
    setDetailImage('');
}

export function getMetadata(item) {
    var metadata;
    var posterUrl = '';

    if (item.SeriesPrimaryImageTag) {
        posterUrl = $scope.serverAddress + '/emby/Items/' + item.SeriesId + '/Images/Primary?tag=' + item.SeriesPrimaryImageTag;
    } else if (item.AlbumPrimaryImageTag) {
        posterUrl = $scope.serverAddress + '/emby/Items/' + item.AlbumId + '/Images/Primary?tag=' + (item.AlbumPrimaryImageTag);
    } else if (item.PrimaryImageTag) {
        posterUrl = $scope.serverAddress + '/emby/Items/' + item.Id + '/Images/Primary?tag=' + (item.PrimaryImageTag);
    } else if (item.ImageTags.Primary) {
        posterUrl = $scope.serverAddress + '/emby/Items/' + item.Id + '/Images/Primary?tag=' + (item.ImageTags.Primary);
    }

    if (item.Type == 'Episode') {
        metadata = new cast.framework.messages.TvShowMediaMetadata();
        metadata.seriesTitle = item.SeriesName;

        if (item.PremiereDate) {
            metadata.originalAirdate = parseISO8601Date(item.PremiereDate).toISOString();
        }

        if (item.IndexNumber != null) {
            metadata.episode = item.IndexNumber;
        }

        if (item.ParentIndexNumber != null) {
            metadata.season = item.ParentIndexNumber;
        }
    } else if (item.Type == 'Photo') {

        metadata = new cast.framework.messages.PhotoMediaMetadata();

        if (item.PremiereDate) {
            metadata.creationDateTime = parseISO8601Date(item.PremiereDate).toISOString();
        }
        // TODO more metadata?
    } else if (item.Type == 'Audio') {

        metadata = new cast.framework.messages.MusicTrackMediaMetadata();
        metadata.songName = item.Name;
        metadata.artist = item.Artists && item.Artists.length ? item.Artists.join(', ') : '';
        metadata.albumArtist = item.AlbumArtist;
        metadata.albumName = item.Album;

        if (item.PremiereDate) {
            metadata.releaseDate = parseISO8601Date(item.PremiereDate).toISOString();
        }

        if (item.IndexNumber != null) {
            metadata.trackNumber = item.IndexNumber;
        }

        if (item.ParentIndexNumber != null) {
            metadata.discNumber = item.ParentIndexNumber;
        }

        var composer = (item.People || []).filter(function (p) {
            return p.PersonType == 'Type';
        })[0];

        if (composer) {
            metadata.composer = composer.Name;
        }
    } else if (item.Type == 'Movie') {

        metadata = new cast.framework.messages.MovieMediaMetadata();
        if (item.PremiereDate) {
            metadata.releaseDate = parseISO8601Date(item.PremiereDate).toISOString();
        }
    } else {
        metadata = new cast.framework.messages.GenericMediaMetadata();

        if (item.PremiereDate) {
            metadata.releaseDate = parseISO8601Date(item.PremiereDate).toISOString();
        }
        if (item.Studios && item.Studios.length) {
            metadata.Studio = item.Studios[0];
        }
    }

    metadata.title = item.Name;
    metadata.images = [new cast.framework.messages.Image(posterUrl)];
    return metadata;
}

export function createStreamInfo(item, mediaSource, startPosition) {

    var mediaUrl;
    var contentType;

    var startPositionInSeekParam = startPosition ? (startPosition / 10000000) : 0;
    var seekParam = startPositionInSeekParam ? '#t=' + startPositionInSeekParam : '';

    var isStatic = false;
    var streamContainer = mediaSource.Container;

    var playerStartPositionTicks = 0;

    var type = item.MediaType.toLowerCase();

    if (type == 'video') {

        contentType = 'video/' + mediaSource.Container;

        if (mediaSource.enableDirectPlay) {
            mediaUrl = mediaSource.Path;
            isStatic = true;
        } else if (mediaSource.SupportsDirectStream) {

            mediaUrl = getUrl(item.serverAddress, 'Videos/' + item.Id + '/stream.' + mediaSource.Container);
            mediaUrl += "?mediaSourceId=" + mediaSource.Id;
            mediaUrl += "&api_key=" + item.accessToken;
            mediaUrl += "&static=true" + seekParam;
            isStatic = true;
            playerStartPositionTicks = startPosition || 0;

        } else {

            mediaUrl = getUrl(item.serverAddress, mediaSource.TranscodingUrl);

            if (mediaSource.TranscodingSubProtocol == 'hls') {

                mediaUrl += seekParam;
                playerStartPositionTicks = startPosition || 0;
                contentType = 'application/x-mpegURL';
                streamContainer = 'm3u8';
            } else {

                contentType = 'video/' + mediaSource.TranscodingContainer;
                streamContainer = mediaSource.TranscodingContainer;

                if (mediaUrl.toLowerCase().indexOf('copytimestamps=true') != -1) {
                    startPosition = 0;
                }
            }
        }

    } else {

        contentType = 'audio/' + mediaSource.Container;

        if (mediaSource.enableDirectPlay) {

            mediaUrl = mediaSource.Path;
            isStatic = true;
            playerStartPositionTicks = startPosition || 0;

        } else {

            var isDirectStream = mediaSource.SupportsDirectStream;

            if (isDirectStream) {

                var outputContainer = (mediaSource.Container || '').toLowerCase();

                mediaUrl = getUrl(item.serverAddress, 'Audio/' + item.Id + '/stream.' + outputContainer);
                mediaUrl += "?mediaSourceId=" + mediaSource.Id;
                mediaUrl += "&api_key=" + item.accessToken;
                mediaUrl += "&static=true" + seekParam;
                isStatic = true;

            } else {

                streamContainer = mediaSource.TranscodingContainer;
                contentType = 'audio/' + mediaSource.TranscodingContainer;

                mediaUrl = getUrl(item.serverAddress, mediaSource.TranscodingUrl);
            }
        }
    }

    // TODO: Remove the second half of the expression by supporting changing the mediaElement src dynamically.
    // It is a pain and will require unbinding all event handlers during the operation
    var canSeek = (mediaSource.RunTimeTicks || 0) > 0;

    var info = {
        url: mediaUrl,
        mediaSource: mediaSource,
        isStatic: isStatic,
        contentType: contentType,
        streamContainer: streamContainer,
        canSeek: canSeek,
        canClientSeek: isStatic || (canSeek && streamContainer == 'm3u8'),
        audioStreamIndex: mediaSource.DefaultAudioStreamIndex,
        subtitleStreamIndex: mediaSource.DefaultSubtitleStreamIndex,
        playerStartPositionTicks: playerStartPositionTicks,
        startPositionTicks: startPosition
    };

    var subtitleStreams = mediaSource.MediaStreams.filter(function (stream) {
        return stream.Type === "Subtitle";
    });
    var subtitleTracks = []
    subtitleStreams.forEach(function (subtitleStream) {
        let subStreamCodec = subtitleStream.Codec.toLowerCase();
        if (subStreamCodec !== 'vtt' && subStreamCodec !== 'webvtt') {
            /* the CAF v3 player only supports vtt currently,
            support for more could be added with a custom implementation*/
            return;
        }
        var textStreamUrl = subtitleStream.IsExternalUrl ? subtitleStream.DeliveryUrl : (getUrl(item.serverAddress, subtitleStream.DeliveryUrl));

        var track = new cast.framework.messages.Track(info.subtitleStreamIndex, cast.framework.messages.TrackType.TEXT)
        track.trackId = subtitleStream.Index;
        track.trackContentId = textStreamUrl;
        track.language = subtitleStream.Language;
        track.name = subtitleStream.DisplayTitle;
        // TODO this should not be hardcoded but we only support VTT currently
        track.trackContentType = 'text/vtt';
        track.subtype = cast.framework.messages.TextTrackType.SUBTITLES;
        subtitleTracks.push(track)
        console.log('Subtitle url: ' + info.subtitleStreamUrl);
    });

    if (subtitleTracks) {
        info.tracks = subtitleTracks;
    }

    return info;
}

export function getStreamByIndex(streams, type, index) {
    return streams.filter(function (s) {

        return s.Type == type && s.Index == index;

    })[0];
}

export function getSecurityHeaders(accessToken, userId) {

    var auth = 'Emby Client="Chromecast", Device="' + deviceInfo.deviceName + '", DeviceId="' + deviceInfo.deviceId + '", Version="' + deviceInfo.versionNumber + '"';

    if (userId) {
        auth += ', UserId="' + userId + '"';
    }

    var headers = {
        Authorization: auth
    }

    headers["X-MediaBrowser-Token"] = accessToken;

    return headers;
}

export function getBackdropUrl(item, serverAddress) {

    var url;

    if (item.BackdropImageTags && item.BackdropImageTags.length) {
        url = getUrl(serverAddress, 'Items/' + item.Id + '/Images/Backdrop/0?tag=' + item.BackdropImageTags[0]);
    } else if (item.ParentBackdropItemId && item.ParentBackdropImageTags && item.ParentBackdropImageTags.length) {
        url = getUrl(serverAddress, 'Items/' + item.ParentBackdropItemId + '/Images/Backdrop/0?tag=' + item.ParentBackdropImageTags[0]);
    }

    return url;
}

export function getLogoUrl(item, serverAddress) {
    var url;
    if (item.ImageTags && item.ImageTags.Logo) {
        url = getUrl(serverAddress, 'Items/' + item.Id + '/Images/Logo/0?tag=' + item.ImageTags.Logo);
    } else if (item.ParentLogoItemId && item.ParentLogoImageTag) {
        url = getUrl(serverAddress, 'Items/' + item.ParentLogoItemId + '/Images/Logo/0?tag=' + item.ParentLogoImageTag);
    }

    return url;
}

export function getPrimaryImageUrl(item, serverAddress) {
    var posterUrl = '';
    if (item.AlbumPrimaryImageTag) {
        posterUrl = getUrl(serverAddress, 'Items/' + item.AlbumId + '/Images/Primary?tag=' + (item.AlbumPrimaryImageTag));
    } else if (item.PrimaryImageTag) {
        posterUrl = getUrl(serverAddress, 'Items/' + item.Id + '/Images/Primary?tag=' + (item.PrimaryImageTag));
    } else if (item.ImageTags.Primary) {
        posterUrl = getUrl(serverAddress, 'Items/' + item.Id + '/Images/Primary?tag=' + (item.ImageTags.Primary));
    }

    return posterUrl;
}

export function getDisplayName(item) {
    var name = item.EpisodeTitle || item.Name;

    if (item.Type == "TvChannel") {

        if (item.Number) {
            return item.Number + ' ' + name;
        }
        return name;
    }

    if (item.Type == "Episode" && item.IndexNumber != null && item.ParentIndexNumber != null) {
        var displayIndexNumber = item.IndexNumber;

        var number = "E" + displayIndexNumber;

        number = "S" + item.ParentIndexNumber + ", " + number;

        if (item.IndexNumberEnd) {

            displayIndexNumber = item.IndexNumberEnd;
            number += "-" + displayIndexNumber;
        }

        name = number + " - " + name;
    }

    return name;
}

export function getRatingHtml(item) {
    var html = "";

    if (item.CommunityRating) {

        html += "<div class='starRating' title='" + item.CommunityRating + "'></div>";
        html += '<div class="starRatingValue">';
        html += item.CommunityRating.toFixed(1);
        html += '</div>';
    }

    if (item.CriticRating != null) {

        if (item.CriticRating >= 60) {
            html += '<div class="fresh rottentomatoesicon" title="fresh"></div>';
        } else {
            html += '<div class="rotten rottentomatoesicon" title="rotten"></div>';
        }

        html += '<div class="criticRating">' + item.CriticRating + '%</div>';
    }

    return html;
}

var requiredItemFields = "MediaSources,Chapters";

export function getShuffleItems(serverAddress, accessToken, userId, item) {

    var query = {
        UserId: userId,
        Fields: requiredItemFields,
        Limit: 50,
        Filters: "IsNotFolder",
        Recursive: true,
        SortBy: "Random"
    };

    if (item.Type == "MusicArtist") {

        query.MediaTypes = "Audio";
        query.ArtistIds = item.Id;

    } else if (item.Type == "MusicGenre") {

        query.MediaTypes = "Audio";
        query.Genres = item.Name;

    } else {
        query.ParentId = item.Id;
    }

    return getItemsForPlayback(serverAddress, accessToken, userId, query);
}

export function getInstantMixItems(serverAddress, accessToken, userId, item) {

    var query = {
        UserId: userId,
        Fields: requiredItemFields,
        Limit: 50
    };

    var url;

    if (item.Type == "MusicArtist") {

        url = "Artists/InstantMix";
        query.Id = item.Id;

    } else if (item.Type == "MusicGenre") {

        url = "MusicGenres/InstantMix";
        query.Id = item.Id;

    } else if (item.Type == "MusicAlbum") {

        url = "Albums/" + item.Id + "/InstantMix";

    } else if (item.Type == "Audio") {

        url = "Songs/" + item.Id + "/InstantMix";
    } else if (item.Type == "Playlist") {

        url = "Playlists/" + item.Id + "/InstantMix";
    }

    url = getUrl(serverAddress, url);

    return ajax({

        url: url,
        headers: getSecurityHeaders(accessToken, userId),
        query: query,
        type: 'GET',
        dataType: 'json'
    });
}

export function getItemsForPlayback(serverAddress, accessToken, userId, query) {

    query.UserId = userId;
    query.Limit = query.Limit || 100;
    query.Fields = requiredItemFields;
    query.ExcludeLocationTypes = "Virtual";

    var url = getUrl(serverAddress, "Users/" + userId + "/Items");

    if (query.Ids && query.Ids.split(',').length == 1) {

        url += '/' + query.Ids.split(',')[0];
        return ajax({

            url: url,
            headers: getSecurityHeaders(accessToken, userId),
            type: 'GET',
            dataType: 'json'

        }).then(function (item) {
            return {
                Items: [item],
                TotalRecordCount: 1
            };
        });
    }

    return ajax({

        url: url,
        headers: getSecurityHeaders(accessToken, userId),
        query: query,
        type: 'GET',
        dataType: 'json'
    });
}

export function getEpisodesForPlayback(serverAddress, accessToken, userId, seriesId, query) {

    query.UserId = userId;
    query.Fields = requiredItemFields;
    query.ExcludeLocationTypes = "Virtual";

    var url = getUrl(serverAddress, "Shows/" + seriesId + "/Episodes");

    return ajax({

        url: url,
        headers: getSecurityHeaders(accessToken, userId),
        query: query,
        type: 'GET',
        dataType: 'json'
    });
}

export function getIntros(serverAddress, accessToken, userId, firstItem) {

    var url = getUrl(serverAddress, 'Users/' + userId + '/Items/' + firstItem.Id + '/Intros');

    return ajax({
        url: url,
        dataType: 'json',
        headers: getSecurityHeaders(accessToken, userId),
        type: 'GET'
    });
}

export function getUser(serverAddress, accessToken, userId) {

    var url = getUrl(serverAddress, 'Users/' + userId);

    return ajax({
        url: url,
        dataType: 'json',
        headers: getSecurityHeaders(accessToken, userId),
        type: 'GET'
    });
}

export function translateRequestedItems(serverAddress, accessToken, userId, items, smart) {

    var firstItem = items[0];

    if (firstItem.Type == "Playlist") {

        return getItemsForPlayback(serverAddress, accessToken, userId, {
            ParentId: firstItem.Id
        });

    } else if (firstItem.Type == "MusicArtist") {
        return getItemsForPlayback(serverAddress, accessToken, userId, {
            ArtistIds: firstItem.Id,
            Filters: "IsNotFolder",
            Recursive: true,
            SortBy: "SortName",
            MediaTypes: "Audio"
        });

    } else if (firstItem.Type == "MusicGenre") {
        return getItemsForPlayback(serverAddress, accessToken, userId, {
            Genres: firstItem.Name,
            Filters: "IsNotFolder",
            Recursive: true,
            SortBy: "SortName",
            MediaTypes: "Audio"
        });

    } else if (firstItem.IsFolder) {
        return getItemsForPlayback(serverAddress, accessToken, userId, {
            ParentId: firstItem.Id,
            Filters: "IsNotFolder",
            Recursive: true,
            SortBy: "SortName",
            MediaTypes: "Audio,Video"
        });
    } else if (smart && firstItem.Type == "Episode" && items.length == 1) {
        return getUser(serverAddress, accessToken, userId).then(function (user) {

            if (!user.Configuration.EnableNextEpisodeAutoPlay) {

                return {
                    Items: items
                };
            }

            return getItemsForPlayback(serverAddress, accessToken, userId, {

                Ids: firstItem.Id

            }).then(function (result) {

                var episode = result.Items[0];

                if (!episode.SeriesId) {
                    return result;
                }

                return getEpisodesForPlayback(serverAddress, accessToken, userId, episode.SeriesId, {
                    IsVirtualUnaired: false,
                    IsMissing: false,
                    UserId: userId

                }).then(function (episodesResult) {

                    var foundItem = false;
                    episodesResult.Items = episodesResult.Items.filter(function (e) {

                        if (foundItem) {
                            return true;
                        }
                        if (e.Id == episode.Id) {
                            foundItem = true;
                            return true;
                        }

                        return false;
                    });
                    episodesResult.TotalRecordCount = episodesResult.Items.length;
                    return episodesResult;
                });
            });
        });
    }

    return Promise.resolve({
        Items: items
    });
}

export function getMiscInfoHtml(item) {

    var miscInfo = [];
    var text, date;

    if (item.Type == "Episode") {

        if (item.PremiereDate) {

            try {
                date = parseISO8601Date(item.PremiereDate);

                text = date.toLocaleDateString();
                miscInfo.push(text);
            } catch (e) {
                console.log("Error parsing date: " + item.PremiereDate);
            }
        }
    }

    if (item.StartDate) {
        try {
            date = parseISO8601Date(item.StartDate);

            text = date.toLocaleDateString();
            miscInfo.push(text);
        } catch (e) {
            console.log("Error parsing date: " + item.PremiereDate);
        }
    }

    if (item.ProductionYear && item.Type == "Series") {

        if (item.Status == "Continuing") {
            miscInfo.push(item.ProductionYear + "-Present");

        } else if (item.ProductionYear) {
            text = item.ProductionYear;
            if (item.EndDate) {
                try {
                    var endYear = parseISO8601Date(item.EndDate).getFullYear();

                    if (endYear != item.ProductionYear) {
                        text += "-" + parseISO8601Date(item.EndDate).getFullYear();
                    }

                } catch (e) {
                    console.log("Error parsing date: " + item.EndDate);
                }
            }

            miscInfo.push(text);
        }
    }

    if (item.Type != "Series" && item.Type != "Episode") {

        if (item.ProductionYear) {

            miscInfo.push(item.ProductionYear);
        } else if (item.PremiereDate) {

            try {
                text = parseISO8601Date(item.PremiereDate).getFullYear();
                miscInfo.push(text);
            } catch (e) {
                console.log("Error parsing date: " + item.PremiereDate);
            }
        }
    }

    var minutes;

    if (item.RunTimeTicks && item.Type != "Series") {

        if (item.Type == "Audio") {

            miscInfo.push(getDisplayRunningTime(item.RunTimeTicks));

        } else {
            minutes = item.RunTimeTicks / 600000000;

            minutes = minutes || 1;

            miscInfo.push(Math.round(minutes) + "min");
        }
    }

    if (item.OfficialRating && item.Type !== "Season" && item.Type !== "Episode") {
        miscInfo.push(item.OfficialRating);
    }

    if (item.Video3DFormat) {
        miscInfo.push("3D");
    }

    return miscInfo.join('&nbsp;&nbsp;&nbsp;&nbsp;');
}

export function setAppStatus(status) {
    $scope.status = status;
    document.body.className = status;
}
export function setDisplayName(name) {
    $scope.displayName = name;
    document.querySelector('.displayName').innerHTML = name || '';
}
export function setGenres(name) {
    $scope.genres = name;
    document.querySelector('.genres').innerHTML = name || '';
}
export function setOverview(name) {
    $scope.overview = name;
    document.querySelector('.overview').innerHTML = name || '';
}
export function setInnerHTML(selector, html, autoHide) {
    var elems = document.querySelectorAll(selector);
    for (var i = 0, length = elems.length; i < length; i++) {

        elems[i].innerHTML = html || ''

        if (autoHide) {
            if (html) {
                elems[i].classList.remove('hide');
            } else {
                elems[i].classList.add('hide');
            }
        }
    }
}
export function setPlayedPercentage(value) {
    $scope.playedPercentage = value;
    document.querySelector('.itemProgressBar').value = value || 0;
}

export function setStartPositionTicks(value) {
    $scope.startPositionTicks = value;
}

export function setWaitingBackdrop(src) {
    document.querySelector('#waiting-container-backdrop').style.backgroundImage = src ? 'url(' + src + ')' : ''
}

export function setHasPlayedPercentage(value) {
    if (value) {
        document.querySelector('.detailImageProgressContainer').classList.remove('hide');
    } else {
        document.querySelector('.detailImageProgressContainer').classList.add('hide');
    }
}

export function setLogo(src) {
    document.querySelector('.detailLogo').style.backgroundImage = src ? 'url(' + src + ')' : ''
}

export function setDetailImage(src) {
    document.querySelector('.detailImage').style.backgroundImage = src ? 'url(' + src + ')' : ''
}

export function extend(target, source) {
    for (var i in source) {
        target[i] = source[i];
    }
    return target;
}

export function parseISO8601Date(s, toLocal) {
    return new Date(s);
}

export function getDisplayRunningTime(ticks) {
    var ticksPerHour = 36000000000;
    var ticksPerMinute = 600000000;
    var ticksPerSecond = 10000000;

    var parts = [];

    var hours = ticks / ticksPerHour;
    hours = Math.floor(hours);

    if (hours) {
        parts.push(hours);
    }

    ticks -= (hours * ticksPerHour);

    var minutes = ticks / ticksPerMinute;
    minutes = Math.floor(minutes);

    ticks -= (minutes * ticksPerMinute);

    if (minutes < 10 && hours) {
        minutes = '0' + minutes;
    }
    parts.push(minutes);

    var seconds = ticks / ticksPerSecond;
    seconds = Math.floor(seconds);

    if (seconds < 10) {
        seconds = '0' + seconds;
    }
    parts.push(seconds);

    return parts.join(':');
}

export function broadcastToMessageBus(msg) {
    window.castReceiverContext.sendCustomMessage('urn:x-cast:com.connectsdk', window.senderId, msg);
}

export function broadcastConnectionErrorMessage() {

    broadcastToMessageBus({
        type: 'connectionerror',
        message: ""
    });
}