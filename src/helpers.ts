import { JellyfinApi } from './components/jellyfinApi';

import { BaseItemDtoQueryResult } from './api/generated/models/base-item-dto-query-result';
import { PlaybackProgressInfo } from './api/generated/models/playback-progress-info';
import { MediaSourceInfo } from './api/generated/models/media-source-info';
import { BaseItemDto } from './api/generated/models/base-item-dto';
import { BaseItemPerson } from './api/generated/models/base-item-person';
import { GlobalScope, BusMessage, ItemIndex, ItemQuery } from './types/global';

export function getCurrentPositionTicks($scope: GlobalScope): number {
    let positionTicks = window.mediaManager.getCurrentTimeSec() * 10000000;
    const mediaInformation = window.mediaManager.getMediaInformation();
    if (mediaInformation && !mediaInformation.customData.canClientSeek) {
        positionTicks += $scope.startPositionTicks || 0;
    }

    return positionTicks;
}

export function getReportingParams($scope: GlobalScope): PlaybackProgressInfo {
    /* Math.round() calls:
     * on 10.7, any floating point will give an API error,
     * so it's actually really important to make sure that
     * those fields are always rounded.
     */
    return {
        PositionTicks: Math.round(getCurrentPositionTicks($scope)),
        IsPaused:
            window.mediaManager.getPlayerState() ===
            cast.framework.messages.PlayerState.PAUSED,
        IsMuted: window.volume.muted,
        AudioStreamIndex: $scope.audioStreamIndex,
        SubtitleStreamIndex: $scope.subtitleStreamIndex,
        VolumeLevel: Math.round(window.volume.level * 100),
        ItemId: $scope.itemId,
        MediaSourceId: $scope.mediaSourceId,
        CanSeek: $scope.canSeek,
        PlayMethod: $scope.playMethod,
        LiveStreamId: $scope.liveStreamId,
        PlaySessionId: $scope.playSessionId,
        RepeatMode: window.repeatMode
    };
}

export function getNextPlaybackItemInfo(): ItemIndex | null {
    const playlist = window.playlist;

    if (!playlist) {
        return null;
    }

    let newIndex: number;

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
        const item = playlist[newIndex];

        return {
            item: item,
            index: newIndex
        };
    }
    return null;
}

export function getSenderReportingData(
    $scope: GlobalScope,
    reportingData: PlaybackProgressInfo
): any {
    const state: any = {
        ItemId: reportingData.ItemId,
        PlayState: reportingData,
        QueueableMediaTypes: ['Audio', 'Video']
    };

    state.NowPlayingItem = {
        Id: reportingData.ItemId,
        RunTimeTicks: $scope.runtimeTicks
    };

    const item = $scope.item;

    if (item) {
        const nowPlayingItem = state.NowPlayingItem;

        nowPlayingItem.ServerId = item.ServerId;
        nowPlayingItem.Chapters = item.Chapters || [];

        // TODO: Fill these
        const mediaSource = item.MediaSources.filter(function (m: any) {
            return m.Id == reportingData.MediaSourceId;
        })[0];

        nowPlayingItem.MediaStreams = mediaSource
            ? mediaSource.MediaStreams
            : [];

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

        const imageTags = item.ImageTags || {};

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
        } else if (
            item.ParentBackdropImageTags &&
            item.ParentBackdropImageTags.length
        ) {
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
            const nextItemInfo = getNextPlaybackItemInfo();

            if (nextItemInfo) {
                state.NextMediaType = nextItemInfo.item.MediaType;
            }
        }
    }

    return state;
}

export function resetPlaybackScope($scope: GlobalScope): void {
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

export function getMetadata(item: BaseItemDto): any {
    let metadata: any;
    let posterUrl = '';

    if (item.SeriesPrimaryImageTag) {
        posterUrl = JellyfinApi.createUrl(
            'Items/' +
                item.SeriesId +
                '/Images/Primary?tag=' +
                item.SeriesPrimaryImageTag
        );
    } else if (item.AlbumPrimaryImageTag) {
        posterUrl = JellyfinApi.createUrl(
            'Items/' +
                item.AlbumId +
                '/Images/Primary?tag=' +
                item.AlbumPrimaryImageTag
        );
    } else if (item.ImageTags?.Primary) {
        posterUrl = JellyfinApi.createUrl(
            'Items/' + item.Id + '/Images/Primary?tag=' + item.ImageTags.Primary
        );
    }

    if (item.Type == 'Episode') {
        metadata = new cast.framework.messages.TvShowMediaMetadata();
        metadata.seriesTitle = item.SeriesName;

        if (item.PremiereDate) {
            metadata.originalAirdate = parseISO8601Date(
                item.PremiereDate
            ).toISOString();
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
            metadata.creationDateTime = parseISO8601Date(
                item.PremiereDate
            ).toISOString();
        }
        // TODO more metadata?
    } else if (item.Type == 'Audio') {
        metadata = new cast.framework.messages.MusicTrackMediaMetadata();
        metadata.songName = item.Name;
        metadata.artist =
            item.Artists && item.Artists.length ? item.Artists.join(', ') : '';
        metadata.albumArtist = item.AlbumArtist;
        metadata.albumName = item.Album;

        if (item.PremiereDate) {
            metadata.releaseDate = parseISO8601Date(
                item.PremiereDate
            ).toISOString();
        }

        if (item.IndexNumber != null) {
            metadata.trackNumber = item.IndexNumber;
        }

        if (item.ParentIndexNumber != null) {
            metadata.discNumber = item.ParentIndexNumber;
        }

        const composer = (item.People || []).filter(function (
            p: BaseItemPerson
        ) {
            // previously: p.PersonType == 'Type'.. wtf?
            return p.Type == 'Composer';
        })[0];

        if (composer) {
            metadata.composer = composer.Name;
        }
    } else if (item.Type == 'Movie') {
        metadata = new cast.framework.messages.MovieMediaMetadata();
        if (item.PremiereDate) {
            metadata.releaseDate = parseISO8601Date(
                item.PremiereDate
            ).toISOString();
        }
    } else {
        metadata = new cast.framework.messages.GenericMediaMetadata();

        if (item.PremiereDate) {
            metadata.releaseDate = parseISO8601Date(
                item.PremiereDate
            ).toISOString();
        }
        if (item.Studios && item.Studios.length) {
            metadata.studio = item.Studios[0];
        }
    }

    metadata.title = item.Name ?? '????';
    metadata.images = [new cast.framework.messages.Image(posterUrl)];
    return metadata;
}

export function createStreamInfo(
    item: BaseItemDto,
    mediaSource: MediaSourceInfo,
    startPosition: number | null
): any {
    let mediaUrl;
    let contentType;

    const startPositionInSeekParam = startPosition
        ? startPosition / 10000000
        : 0;
    const seekParam = startPositionInSeekParam
        ? '#t=' + startPositionInSeekParam
        : '';

    let isStatic = false;
    let streamContainer = mediaSource.Container;

    let playerStartPositionTicks = 0;

    const type = item.MediaType?.toLowerCase();

    if (type == 'video') {
        contentType = 'video/' + mediaSource.Container;

        if (mediaSource.SupportsDirectPlay) {
            mediaUrl = mediaSource.Path;
            isStatic = true;
        } else if (mediaSource.SupportsDirectStream) {
            mediaUrl = JellyfinApi.createUrl(
                'videos/' + item.Id + '/stream.' + mediaSource.Container
            );
            mediaUrl += '?mediaSourceId=' + mediaSource.Id;
            mediaUrl += '&api_key=' + JellyfinApi.accessToken;
            mediaUrl += '&static=true' + seekParam;
            isStatic = true;
            playerStartPositionTicks = startPosition || 0;
        } else {
            // TODO deal with !TranscodingUrl
            mediaUrl = JellyfinApi.createUrl(
                <string>mediaSource.TranscodingUrl
            );

            if (mediaSource.TranscodingSubProtocol == 'hls') {
                mediaUrl += seekParam;
                playerStartPositionTicks = startPosition || 0;
                contentType = 'application/x-mpegURL';
                streamContainer = 'm3u8';
            } else {
                contentType = 'video/' + mediaSource.TranscodingContainer;
                streamContainer = mediaSource.TranscodingContainer;

                if (
                    mediaUrl.toLowerCase().indexOf('copytimestamps=true') != -1
                ) {
                    startPosition = 0;
                }
            }
        }
    } else {
        contentType = 'audio/' + mediaSource.Container;

        if (mediaSource.SupportsDirectPlay) {
            mediaUrl = mediaSource.Path;
            isStatic = true;
            playerStartPositionTicks = startPosition || 0;
        } else {
            const isDirectStream = mediaSource.SupportsDirectStream;

            if (isDirectStream) {
                const outputContainer = (
                    mediaSource.Container || ''
                ).toLowerCase();

                mediaUrl = JellyfinApi.createUrl(
                    'Audio/' + item.Id + '/stream.' + outputContainer
                );
                mediaUrl += '?mediaSourceId=' + mediaSource.Id;
                mediaUrl += '&api_key=' + JellyfinApi.accessToken;
                mediaUrl += '&static=true' + seekParam;
                isStatic = true;
            } else {
                streamContainer = mediaSource.TranscodingContainer;
                contentType = 'audio/' + mediaSource.TranscodingContainer;

                // TODO deal with !TranscodingUrl
                mediaUrl = JellyfinApi.createUrl(
                    <string>mediaSource.TranscodingUrl
                );
            }
        }
    }

    // TODO: Remove the second half of the expression by supporting changing the mediaElement src dynamically.
    // It is a pain and will require unbinding all event handlers during the operation
    const canSeek = (mediaSource.RunTimeTicks || 0) > 0;

    const info: any = {
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

    const subtitleStreams =
        mediaSource.MediaStreams?.filter(function (stream: any) {
            return stream.Type === 'Subtitle';
        }) ?? [];
    const subtitleTracks: Array<framework.messages.Track> = [];
    subtitleStreams.forEach(function (subtitleStream: any) {
        if (subtitleStream.DeliveryUrl === undefined) {
            /* The CAF v3 player only supports vtt currently,
             * SRT subs can be "transcoded" to vtt by jellyfin.
             * The server will do that in accordance with the device profiles and
             * give us a DeliveryUrl if that is the case.
             * Support for more could be added with a custom implementation
             **/
            return;
        }
        const textStreamUrl = subtitleStream.IsExternalUrl
            ? subtitleStream.DeliveryUrl
            : JellyfinApi.createUrl(subtitleStream.DeliveryUrl);

        const track = new cast.framework.messages.Track(
            info.subtitleStreamIndex,
            cast.framework.messages.TrackType.TEXT
        );
        track.trackId = subtitleStream.Index;
        track.trackContentId = textStreamUrl;
        track.language = subtitleStream.Language;
        track.name = subtitleStream.DisplayTitle;
        // TODO this should not be hardcoded but we only support VTT currently
        track.trackContentType = 'text/vtt';
        track.subtype = cast.framework.messages.TextTrackType.SUBTITLES;
        subtitleTracks.push(track);
        console.log('Subtitle url: ' + info.subtitleStreamUrl);
    });

    info.tracks = subtitleTracks;

    return info;
}

export function getStreamByIndex(
    streams: Array<any>,
    type: string,
    index: number
): any {
    return streams.filter(function (s) {
        return s.Type == type && s.Index == index;
    })[0];
}

export function getBackdropUrl(item: BaseItemDto): string | null {
    let url: string | null = null;

    if (item.BackdropImageTags && item.BackdropImageTags.length) {
        url = JellyfinApi.createUrl(
            'Items/' +
                item.Id +
                '/Images/Backdrop/0?tag=' +
                item.BackdropImageTags[0]
        );
    } else if (
        item.ParentBackdropItemId &&
        item.ParentBackdropImageTags &&
        item.ParentBackdropImageTags.length
    ) {
        url = JellyfinApi.createUrl(
            'Items/' +
                item.ParentBackdropItemId +
                '/Images/Backdrop/0?tag=' +
                item.ParentBackdropImageTags[0]
        );
    }

    return url;
}

export function getLogoUrl(item: BaseItemDto): string | null {
    let url: string | null = null;
    if (item.ImageTags && item.ImageTags.Logo) {
        url = JellyfinApi.createUrl(
            'Items/' + item.Id + '/Images/Logo/0?tag=' + item.ImageTags.Logo
        );
    } else if (item.ParentLogoItemId && item.ParentLogoImageTag) {
        url = JellyfinApi.createUrl(
            'Items/' +
                item.ParentLogoItemId +
                '/Images/Logo/0?tag=' +
                item.ParentLogoImageTag
        );
    }

    return url;
}

export function getPrimaryImageUrl(item: BaseItemDto): string {
    let posterUrl = '';
    if (item.AlbumPrimaryImageTag) {
        posterUrl = JellyfinApi.createUrl(
            'Items/' +
                item.AlbumId +
                '/Images/Primary?tag=' +
                item.AlbumPrimaryImageTag
        );
    } else if (item.ImageTags?.Primary) {
        posterUrl = JellyfinApi.createUrl(
            'Items/' +
                item.Id +
                '/Images/Primary?tag=' +
                item.ImageTags?.Primary
        );
    }

    return posterUrl;
}

export function getDisplayName(item: BaseItemDto): string {
    let name: string = (item.EpisodeTitle || item.Name) ?? '???';

    if (item.Type == 'TvChannel') {
        if (item.Number) {
            return item.Number + ' ' + name;
        }
        return name;
    }

    if (
        item.Type == 'Episode' &&
        item.IndexNumber != null &&
        item.ParentIndexNumber != null
    ) {
        let displayIndexNumber = item.IndexNumber;

        let number = 'E' + displayIndexNumber;

        number = 'S' + item.ParentIndexNumber + ', ' + number;

        if (item.IndexNumberEnd) {
            displayIndexNumber = item.IndexNumberEnd;
            number += '-' + displayIndexNumber;
        }

        name = number + ' - ' + name;
    }

    return name;
}

export function getRatingHtml(item: BaseItemDto): string {
    let html = '';

    if (item.CommunityRating) {
        html +=
            `<div class="starRating" title="${item.CommunityRating}"></div>` +
            '<div class="starRatingValue">' +
            item.CommunityRating.toFixed(1) +
            '</div>';
    }

    if (item.CriticRating != null) {
        if (item.CriticRating >= 60) {
            html +=
                '<div class="fresh rottentomatoesicon" title="fresh"></div>';
        } else {
            html +=
                '<div class="rotten rottentomatoesicon" title="rotten"></div>';
        }

        html += '<div class="criticRating">' + item.CriticRating + '%</div>';
    }

    return html;
}

const requiredItemFields = 'MediaSources,Chapters';

export function getShuffleItems(
    userId: string,
    item: BaseItemDto
): Promise<any> {
    const query: ItemQuery = {
        UserId: userId,
        Fields: requiredItemFields,
        Limit: 50,
        Filters: 'IsNotFolder',
        Recursive: true,
        SortBy: 'Random'
    };

    if (item.Type == 'MusicArtist') {
        query.MediaTypes = 'Audio';
        query.ArtistIds = item.Id;
    } else if (item.Type == 'MusicGenre') {
        query.MediaTypes = 'Audio';
        query.Genres = item.Name ?? undefined;
    } else {
        query.ParentId = item.Id;
    }

    return getItemsForPlayback(userId, query);
}

export function getInstantMixItems(
    userId: string,
    item: BaseItemDto
): Promise<any> {
    const query: any = {
        UserId: userId,
        Fields: requiredItemFields,
        Limit: 50
    };

    let url = '';

    if (item.Type == 'MusicArtist') {
        url = 'Artists/InstantMix';
        query.Id = item.Id;
    } else if (item.Type == 'MusicGenre') {
        url = 'MusicGenres/InstantMix';
        query.Id = item.Id;
    } else if (item.Type == 'MusicAlbum') {
        url = 'Albums/' + item.Id + '/InstantMix';
    } else if (item.Type == 'Audio') {
        url = 'Songs/' + item.Id + '/InstantMix';
    } else if (item.Type == 'Playlist') {
        url = 'Playlists/' + item.Id + '/InstantMix';
    }

    if (url) {
        return JellyfinApi.authAjax(url, {
            query: query,
            type: 'GET',
            dataType: 'json'
        });
    } else {
        return Promise.reject('InstantMix: Unknown item type: ' + item.Type);
    }
}

export function getItemsForPlayback(
    userId: string,
    query: ItemQuery
): Promise<BaseItemDtoQueryResult> {
    query.UserId = userId;
    query.Limit = query.Limit || 100;
    query.Fields = requiredItemFields;
    query.ExcludeLocationTypes = 'Virtual';

    if (query.Ids && query.Ids.split(',').length == 1) {
        return JellyfinApi.authAjaxUser('Items/' + query.Ids.split(',')[0], {
            type: 'GET',
            dataType: 'json'
        }).then(function (item) {
            return {
                Items: [item],
                TotalRecordCount: 1
            };
        });
    } else {
        return JellyfinApi.authAjaxUser('Items', {
            query: query,
            type: 'GET',
            dataType: 'json'
        });
    }
}

export function getEpisodesForPlayback(
    userId: string,
    seriesId: string,
    query: ItemQuery
): Promise<any> {
    query.UserId = userId;
    query.Fields = requiredItemFields;
    query.ExcludeLocationTypes = 'Virtual';

    return JellyfinApi.authAjax('Shows/' + seriesId + '/Episodes', {
        query: query,
        type: 'GET',
        dataType: 'json'
    });
}

export function getIntros(
    firstItem: BaseItemDto
): Promise<BaseItemDtoQueryResult> {
    return JellyfinApi.authAjaxUser('Items/' + firstItem.Id + '/Intros', {
        dataType: 'json',
        type: 'GET'
    });
}

export function getUser(): Promise<any> {
    return JellyfinApi.authAjaxUser('', {
        dataType: 'json',
        type: 'GET'
    });
}

export function translateRequestedItems(
    userId: string,
    items: Array<BaseItemDto>,
    smart = false
): Promise<BaseItemDtoQueryResult> {
    const firstItem = items[0];

    if (firstItem.Type == 'Playlist') {
        return getItemsForPlayback(userId, {
            ParentId: firstItem.Id
        });
    } else if (firstItem.Type == 'MusicArtist') {
        return getItemsForPlayback(userId, {
            ArtistIds: firstItem.Id,
            Filters: 'IsNotFolder',
            Recursive: true,
            SortBy: 'SortName',
            MediaTypes: 'Audio'
        });
    } else if (firstItem.Type == 'MusicGenre') {
        return getItemsForPlayback(userId, {
            Genres: firstItem.Name ?? undefined,
            Filters: 'IsNotFolder',
            Recursive: true,
            SortBy: 'SortName',
            MediaTypes: 'Audio'
        });
    } else if (firstItem.IsFolder) {
        return getItemsForPlayback(userId, {
            ParentId: firstItem.Id,
            Filters: 'IsNotFolder',
            Recursive: true,
            SortBy: 'SortName',
            MediaTypes: 'Audio,Video'
        });
    } else if (smart && firstItem.Type == 'Episode' && items.length == 1) {
        return getUser().then(function (user) {
            if (!user.Configuration.EnableNextEpisodeAutoPlay) {
                return {
                    Items: items
                };
            }

            return getItemsForPlayback(userId, {
                Ids: firstItem.Id
            }).then(function (result) {
                if (!result.Items || result.Items.length < 1) return result;
                const episode = result.Items[0];

                if (!episode.SeriesId) {
                    return result;
                }

                return getEpisodesForPlayback(userId, episode.SeriesId, {
                    IsVirtualUnaired: false,
                    IsMissing: false,
                    UserId: userId
                }).then(function (episodesResult) {
                    let foundItem = false;
                    episodesResult.Items = episodesResult.Items.filter(
                        function (e: BaseItemDto) {
                            if (foundItem) {
                                return true;
                            }
                            if (e.Id == episode.Id) {
                                foundItem = true;
                                return true;
                            }

                            return false;
                        }
                    );
                    episodesResult.TotalRecordCount =
                        episodesResult.Items.length;
                    return episodesResult;
                });
            });
        });
    }

    return Promise.resolve({
        Items: items
    });
}

export function getMiscInfoHtml(item: BaseItemDto): string {
    const miscInfo: string[] = [];
    let date: Date;

    if (item.Type == 'Episode') {
        if (item.PremiereDate) {
            try {
                date = parseISO8601Date(item.PremiereDate);

                miscInfo.push(date.toLocaleDateString());
            } catch (e) {
                console.log('Error parsing date: ' + item.PremiereDate);
            }
        }
    }

    if (item.StartDate) {
        try {
            date = parseISO8601Date(item.StartDate);

            miscInfo.push(date.toLocaleDateString());
        } catch (e) {
            console.log('Error parsing date: ' + item.PremiereDate);
        }
    }

    if (item.ProductionYear && item.Type == 'Series') {
        if (item.Status == 'Continuing') {
            miscInfo.push(item.ProductionYear + '-Present');
        } else if (item.ProductionYear) {
            let text: string = item.ProductionYear.toString();
            if (item.EndDate) {
                try {
                    const endYear = parseISO8601Date(
                        item.EndDate
                    ).getFullYear();

                    if (endYear != item.ProductionYear) {
                        text +=
                            '-' + parseISO8601Date(item.EndDate).getFullYear();
                    }
                } catch (e) {
                    console.log('Error parsing date: ' + item.EndDate);
                }
            }

            miscInfo.push(text);
        }
    }

    if (item.Type != 'Series' && item.Type != 'Episode') {
        if (item.ProductionYear) {
            miscInfo.push(item.ProductionYear.toString());
        } else if (item.PremiereDate) {
            try {
                miscInfo.push(
                    parseISO8601Date(item.PremiereDate).getFullYear().toString()
                );
            } catch (e) {
                console.log('Error parsing date: ' + item.PremiereDate);
            }
        }
    }

    if (item.RunTimeTicks && item.Type != 'Series') {
        if (item.Type == 'Audio') {
            miscInfo.push(getDisplayRunningTime(item.RunTimeTicks));
        } else {
            miscInfo.push(
                Math.round(item.RunTimeTicks / 600000000 || 1).toString() +
                    'min'
            );
        }
    }

    if (
        item.OfficialRating &&
        item.Type !== 'Season' &&
        item.Type !== 'Episode'
    ) {
        miscInfo.push(item.OfficialRating);
    }

    if (item.Video3DFormat) {
        miscInfo.push('3D');
    }

    return miscInfo.join('&nbsp;&nbsp;&nbsp;&nbsp;');
}

export function setAppStatus(status: string): void {
    $scope.status = status;
    document.body.className = status;
}

export function setDisplayName(name = ''): void {
    const element: HTMLElement = <HTMLElement>(
        document.querySelector('.displayName')
    );
    $scope.displayName = name;
    element.innerHTML = name;
}

export function setGenres(name = ''): void {
    const element: HTMLElement = <HTMLElement>document.querySelector('.genres');
    $scope.genres = name;
    element.innerHTML = name;
}

export function setOverview(name = ''): void {
    const element: HTMLElement = <HTMLElement>(
        document.querySelector('.overview')
    );
    $scope.overview = name;
    element.innerHTML = name;
}

export function setPlayedPercentage(value = 0): void {
    const element: HTMLInputElement = <HTMLInputElement>(
        document.querySelector('.itemProgressBar')
    );

    $scope.playedPercentage = value;
    element.value = value.toString();
}

export function setStartPositionTicks(value: number): void {
    $scope.startPositionTicks = value;
}

export function setWaitingBackdrop(src: string | null): void {
    const element: HTMLElement = <HTMLElement>(
        document.querySelector('#waiting-container-backdrop')
    );

    element.style.backgroundImage = src ? 'url(' + src + ')' : '';
}

export function setHasPlayedPercentage(value: boolean): void {
    const element: HTMLElement = <HTMLElement>(
        document.querySelector('.detailImageProgressContainer')
    );
    if (value) element.classList.remove('hide');
    else element.classList.add('hide');
}

export function setLogo(src: string | null): void {
    const element: HTMLElement = <HTMLElement>(
        document.querySelector('.detailLogo')
    );
    element.style.backgroundImage = src ? 'url(' + src + ')' : '';
}

export function setDetailImage(src: string | null): void {
    const element: HTMLElement = <HTMLElement>(
        document.querySelector('.detailImage')
    );

    element.style.backgroundImage = src ? 'url(' + src + ')' : '';
}

// TODO can we remove this crap
export function extend(target: any, source: any): any {
    for (const i in source) {
        target[i] = source[i];
    }
    return target;
}

export function parseISO8601Date(date: string): Date {
    return new Date(date);
}

export function getDisplayRunningTime(ticks: number): string {
    const ticksPerHour = 36000000000;
    const ticksPerMinute = 600000000;
    const ticksPerSecond = 10000000;

    const parts: string[] = [];

    const hours: number = Math.floor(ticks / ticksPerHour);

    if (hours) {
        parts.push(hours.toString());
    }

    ticks -= hours * ticksPerHour;

    const minutes: number = Math.floor(ticks / ticksPerMinute);

    ticks -= minutes * ticksPerMinute;

    if (minutes < 10 && hours) {
        parts.push('0' + minutes.toString());
    } else {
        parts.push(minutes.toString());
    }

    const seconds: number = Math.floor(ticks / ticksPerSecond);

    if (seconds < 10) {
        parts.push('0' + seconds.toString());
    } else {
        parts.push(seconds.toString());
    }

    return parts.join(':');
}

export function broadcastToMessageBus(message: BusMessage): void {
    window.castReceiverContext.sendCustomMessage(
        'urn:x-cast:com.connectsdk',
        window.senderId,
        message
    );
}

export function broadcastConnectionErrorMessage(): void {
    broadcastToMessageBus({ type: 'connectionerror', message: '' });
}

export function cleanName(name: string): string {
    return name.replace(/[^\w\s]/gi, '');
}
