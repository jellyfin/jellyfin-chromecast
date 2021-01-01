import { JellyfinApi } from './components/jellyfinApi';
import { PlaybackManager } from './components/playbackManager';

import { BaseItemDtoQueryResult } from './api/generated/models/base-item-dto-query-result';
import { PlaybackProgressInfo } from './api/generated/models/playback-progress-info';
import { MediaSourceInfo } from './api/generated/models/media-source-info';
import { BaseItemDto } from './api/generated/models/base-item-dto';
import { BaseItemPerson } from './api/generated/models/base-item-person';
import { UserDto } from './api/generated/models/user-dto';
import { GlobalScope, BusMessage, ItemQuery } from './types/global';

/**
 * Get current playback position in ticks, adjusted for server seeking
 *
 * @param $scope global context variable
 * @returns position in ticks
 */
export function getCurrentPositionTicks($scope: GlobalScope): number {
    let positionTicks = window.mediaManager.getCurrentTimeSec() * 10000000;
    const mediaInformation = window.mediaManager.getMediaInformation();
    if (mediaInformation && !mediaInformation.customData.canClientSeek) {
        positionTicks += $scope.startPositionTicks || 0;
    }

    return positionTicks;
}

/**
 * Get parameters used for playback reporting
 *
 * @param $scope global context variable
 * @returns progress information for use with the reporting APIs
 */
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

/**
 * This is used in playback reporting to find out information
 * about the item that is currently playing. This is sent over the cast protocol over to
 * the connected client (or clients?).
 *
 * @param $scope global context
 * @param reportingData object full of random information
 * @returns lots of data for the connected client
 */
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
            const nextItemInfo = PlaybackManager.getNextPlaybackItemInfo();

            if (nextItemInfo) {
                state.NextMediaType = nextItemInfo.item.MediaType;
            }
        }
    }

    return state;
}

/**
 * Attempt to clean the receiver state.
 *
 * @param $scope global context variable
 */
export function resetPlaybackScope($scope: GlobalScope): void {
    setAppStatus('waiting');

    $scope.startPositionTicks = 0;
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

/**
 * Create CAF-native metadata for a given item
 *
 * @param item item to look up
 * @returns one of the metadata classes in cast.framework.messages.*Metadata
 */
export function getMetadata(item: BaseItemDto): any {
    let metadata: any;
    let posterUrl = '';

    if (item.SeriesPrimaryImageTag)
        posterUrl = JellyfinApi.createUrl(
            `Items/${item.SeriesId}/Images/Primary?tag=${item.SeriesPrimaryImageTag}`
        );
    else if (item.AlbumPrimaryImageTag)
        posterUrl = JellyfinApi.createUrl(
            `Items/${item.AlbumId}/Images/Primary?tag=${item.AlbumPrimaryImageTag}`
        );
    else if (item.ImageTags?.Primary)
        posterUrl = JellyfinApi.createUrl(
            `Items/${item.Id}/Images/Primary?tag=${item.ImageTags.Primary}`
        );

    if (item.Type == 'Episode') {
        metadata = new cast.framework.messages.TvShowMediaMetadata();
        metadata.seriesTitle = item.SeriesName;

        if (item.PremiereDate)
            metadata.originalAirdate = parseISO8601Date(
                item.PremiereDate
            ).toISOString();
        if (item.IndexNumber != null) metadata.episode = item.IndexNumber;
        if (item.ParentIndexNumber != null)
            metadata.season = item.ParentIndexNumber;
    } else if (item.Type == 'Photo') {
        metadata = new cast.framework.messages.PhotoMediaMetadata();

        if (item.PremiereDate)
            metadata.creationDateTime = parseISO8601Date(
                item.PremiereDate
            ).toISOString();
        // TODO more metadata?
    } else if (item.Type == 'Audio') {
        metadata = new cast.framework.messages.MusicTrackMediaMetadata();
        metadata.songName = item.Name;
        metadata.artist =
            item.Artists && item.Artists.length ? item.Artists.join(', ') : '';
        metadata.albumArtist = item.AlbumArtist;
        metadata.albumName = item.Album;

        if (item.PremiereDate)
            metadata.releaseDate = parseISO8601Date(
                item.PremiereDate
            ).toISOString();
        if (item.IndexNumber != null) metadata.trackNumber = item.IndexNumber;
        if (item.ParentIndexNumber != null)
            metadata.discNumber = item.ParentIndexNumber;
        // previously: p.PersonType == 'Type'.. wtf?
        const composer = (item.People || []).filter(
            (p: BaseItemPerson) => p.Type == 'Composer'
        )[0];
        if (composer) metadata.composer = composer.Name;
    } else if (item.Type == 'Movie') {
        metadata = new cast.framework.messages.MovieMediaMetadata();
        if (item.PremiereDate)
            metadata.releaseDate = parseISO8601Date(
                item.PremiereDate
            ).toISOString();
    } else {
        metadata = new cast.framework.messages.GenericMediaMetadata();

        if (item.PremiereDate)
            metadata.releaseDate = parseISO8601Date(
                item.PremiereDate
            ).toISOString();
        if (item.Studios && item.Studios.length)
            metadata.studio = item.Studios[0];
    }

    metadata.title = item.Name ?? '????';
    metadata.images = [new cast.framework.messages.Image(posterUrl)];
    return metadata;
}

/**
 * Create the necessary information about an item
 * needed for playback
 *
 * @param item Item to play
 * @param mediaSource MediaSourceInfo for the item
 * @param startPosition Where to seek to (possibly server seeking)
 * @returns object with enough information to start playback
 */
export function createStreamInfo(
    item: BaseItemDto,
    mediaSource: MediaSourceInfo,
    startPosition: number | null
): any {
    let mediaUrl;
    let contentType;

    // server seeking
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
                `videos/${item.Id}/stream.${mediaSource.Container}?mediaSourceId=${mediaSource.Id}&api_key=${JellyfinApi.accessToken}&static=true${seekParam}`
            );
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
                    `Audio/${item.Id}/stream.${outputContainer}?mediaSourceId=${mediaSource.Id}&api_key=${JellyfinApi.accessToken}&static=true${seekParam}`
                );
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

/**
 * Get stream by its index while making a type assertion
 *
 * @param streams array streams to consider
 * @param type type of stream
 * @param index index of stream
 * @returns first first matching stream
 */
export function getStreamByIndex(
    streams: Array<any>,
    type: string,
    index: number
): any {
    return streams.filter(function (s) {
        return s.Type == type && s.Index == index;
    })[0];
}

/**
 * Get url for backdrop image for a given item
 *
 * @param item item to look up
 * @returns url to backdrop image or null
 */
export function getBackdropUrl(item: BaseItemDto): string | null {
    if (item.BackdropImageTags && item.BackdropImageTags.length) {
        return JellyfinApi.createUrl(
            `Items/${item.Id}/Images/Backdrop/0?tag=${item.BackdropImageTags[0]}`
        );
    } else if (
        item.ParentBackdropItemId &&
        item.ParentBackdropImageTags &&
        item.ParentBackdropImageTags.length
    ) {
        return JellyfinApi.createUrl(
            `Items/${item.ParentBackdropItemId}/Images/Backdrop/0?tag=${item.ParentBackdropImageTags[0]}`
        );
    }

    return null;
}

/**
 * Get url for logo image for a given item
 *
 * @param item item to look up
 * @returns url to logo image or null
 */
export function getLogoUrl(item: BaseItemDto): string | null {
    if (item.ImageTags && item.ImageTags.Logo) {
        return JellyfinApi.createUrl(
            `Items/${item.Id}/Images/Logo/0?tag=${item.ImageTags.Logo}`
        );
    } else if (item.ParentLogoItemId && item.ParentLogoImageTag) {
        return JellyfinApi.createUrl(
            `Items/${item.ParentLogoItemId}/Images/Logo/0?tag=${item.ParentLogoImageTag}`
        );
    }

    return null;
}

/**
 * Get url for primary image for a given item
 *
 * @param item item to look up
 * @returns url to primary image or null
 */
export function getPrimaryImageUrl(item: BaseItemDto): string | null {
    if (item.AlbumPrimaryImageTag) {
        return JellyfinApi.createUrl(
            `Items/${item.AlbumId}/Images/Primary?tag=${item.AlbumPrimaryImageTag}`
        );
    } else if (item.ImageTags?.Primary) {
        return JellyfinApi.createUrl(
            `Items/${item.Id}/Images/Primary?tag=${item.ImageTags?.Primary}`
        );
    }

    return null;
}

/**
 * Get human readable name for an item
 *
 * @param item item to get displayname for
 * @returns displayname
 */
export function getDisplayName(item: BaseItemDto): string | null {
    const name = (item.EpisodeTitle || item.Name) ?? null;

    if (name === null) return null;

    if (item.Type == 'TvChannel') {
        if (item.Number) return `${item.Number} ${name}`;
        else return name;
    }

    if (
        item.Type == 'Episode' &&
        item.IndexNumber != null &&
        item.ParentIndexNumber != null
    ) {
        let episode = `S${item.ParentIndexNumber}, E${item.IndexNumber}`;

        if (item.IndexNumberEnd) {
            episode += '-' + item.IndexNumberEnd;
        }

        return `${episode} - ${name}`;
    }

    return name;
}

/**
 * Get HTML content used to display the rating of an item
 *
 * @param item to look up
 * @returns html string to put in document
 */
export function getRatingHtml(item: BaseItemDto): string {
    let html = '';

    if (item.CommunityRating) {
        html =
            `<div class="starRating" title="${item.CommunityRating}"></div>` +
            '<div class="starRatingValue">' +
            item.CommunityRating.toFixed(1) +
            '</div>';
    }

    if (item.CriticRating != null) {
        const verdict = item.CriticRating >= 60 ? 'fresh' : 'rotten';

        html +=
            `<div class="${verdict} rottentomatoesicon" title="${verdict}"></div>` +
            `<div class="criticRating">${item.CriticRating}%</div>`;
    }

    return html;
}

// defined for use in the 3 next functions
const requiredItemFields = 'MediaSources,Chapters';

/**
 * Get a random selection of items given one item,
 * this item can be a music artist item, or a music genre item,
 * or something else. If something else it searches for child items
 * of the provided one.
 *
 * It's used only in maincomponents.shuffle.
 *
 * TODO: JellyfinApi.userId should be fine for this.
 *
 * @param userId User ID to look up items with
 * @param item Parent item of shuffle search
 * @returns items for the queue
 */
export function getShuffleItems(
    userId: string,
    item: BaseItemDto
): Promise<BaseItemDtoQueryResult> {
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

/**
 * Get an "Instant Mix" given an item, which can be a
 * music artist, genre, album, playlist
 *
 * TODO: JellyfinApi.userId should be fine for this.
 *
 * @param userId User ID to look up items with
 * @param item Parent item of the search
 * @returns items for the queue
 */
export function getInstantMixItems(
    userId: string,
    item: BaseItemDto
): Promise<BaseItemDtoQueryResult> {
    const query: any = {
        UserId: userId,
        Fields: requiredItemFields,
        Limit: 50
    };

    let url: string | null = null;

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

/**
 * Get items to be played back
 *
 * @param userId user for the search
 * @param query specification on what to search for
 * @returns items to be played back
 */
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

/**
 * Get episodes for a show given by seriesId
 *
 * @param userId userid to use
 * @param seriesId series to look up
 * @param query query parameters to build on
 * @returns episode items
 */
export function getEpisodesForPlayback(
    userId: string,
    seriesId: string,
    query: ItemQuery = {}
): Promise<BaseItemDtoQueryResult> {
    query.UserId = userId;
    query.Fields = requiredItemFields;
    query.ExcludeLocationTypes = 'Virtual';

    return JellyfinApi.authAjax('Shows/' + seriesId + '/Episodes', {
        query: query,
        type: 'GET',
        dataType: 'json'
    });
}

/**
 * Get intros for a given item. This item should be a video
 * type for this to make sense
 *
 * @param firstItem item to get intros for
 * @returns intro items
 */
export function getIntros(
    firstItem: BaseItemDto
): Promise<BaseItemDtoQueryResult> {
    return JellyfinApi.authAjaxUser('Items/' + firstItem.Id + '/Intros', {
        dataType: 'json',
        type: 'GET'
    });
}

/**
 * Get user object for the current user
 *
 * @returns user object
 */
export function getUser(): Promise<UserDto> {
    return JellyfinApi.authAjaxUser('', {
        dataType: 'json',
        type: 'GET'
    });
}

/**
 * Process a list of items for playback
 * by resolving things like folders to playable items.
 *
 *
 * @param userId userId to use
 * @param items items to resolve
 * @param smart If enabled it will try to find the next episode given the
 *              current one, if the connected user has enabled that in their settings
 */
export async function translateRequestedItems(
    userId: string,
    items: Array<BaseItemDto>,
    smart = false
): Promise<BaseItemDtoQueryResult> {
    const firstItem = items[0];

    if (firstItem.Type == 'Playlist') {
        return await getItemsForPlayback(userId, {
            ParentId: firstItem.Id
        });
    } else if (firstItem.Type == 'MusicArtist') {
        return await getItemsForPlayback(userId, {
            ArtistIds: firstItem.Id,
            Filters: 'IsNotFolder',
            Recursive: true,
            SortBy: 'SortName',
            MediaTypes: 'Audio'
        });
    } else if (firstItem.Type == 'MusicGenre') {
        return await getItemsForPlayback(userId, {
            Genres: firstItem.Name ?? undefined,
            Filters: 'IsNotFolder',
            Recursive: true,
            SortBy: 'SortName',
            MediaTypes: 'Audio'
        });
    } else if (firstItem.IsFolder) {
        return await getItemsForPlayback(userId, {
            ParentId: firstItem.Id,
            Filters: 'IsNotFolder',
            Recursive: true,
            SortBy: 'SortName',
            MediaTypes: 'Audio,Video'
        });
    } else if (smart && firstItem.Type == 'Episode' && items.length == 1) {
        const user = await getUser();

        if (!user.Configuration?.EnableNextEpisodeAutoPlay) {
            return {
                Items: items
            };
        }

        const result = await getItemsForPlayback(userId, {
            Ids: firstItem.Id
        });

        if (!result.Items || result.Items.length < 1) return result;

        const episode = result.Items[0];

        if (!episode.SeriesId) {
            return result;
        }

        const episodesResult = await getEpisodesForPlayback(
            userId,
            episode.SeriesId,
            {
                IsVirtualUnaired: false,
                IsMissing: false,
                UserId: userId
            }
        );

        let foundItem = false;
        episodesResult.Items = episodesResult.Items?.filter(function (
            e: BaseItemDto
        ) {
            if (foundItem) {
                return true;
            }
            if (e.Id == episode.Id) {
                foundItem = true;
                return true;
            }

            return false;
        });

        episodesResult.TotalRecordCount = episodesResult.Items?.length || 0;

        return episodesResult;
    }

    return {
        Items: items
    };
}

/**
 * Get information about mainly an episode or series
 * for the item details page
 *
 * @param item to look up
 * @returns html code to use
 */
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

/**
 * Set the status of the app, and switch the visible view by
 * modifying document.body.className
 *
 * @param status name of view to show
 */
export function setAppStatus(status: string): void {
    $scope.status = status;
    document.body.className = status;
}

/**
 * Set the displayname, part of the details page
 *
 * @param name name to set, if null then remove it
 */
export function setDisplayName(name: string | null = null): void {
    if (name === null) name = '';
    const element: HTMLElement = <HTMLElement>(
        document.querySelector('.displayName')
    );
    $scope.displayName = name;
    element.innerHTML = name;
}

/**
 * Set the html of the genres container
 *
 * @param name string or html to insert
 */
export function setGenres(name = ''): void {
    const element: HTMLElement = <HTMLElement>document.querySelector('.genres');
    $scope.genres = name;
    element.innerHTML = name;
}

/**
 * Set the html of the overview container
 *
 * @param name string or html to insert
 */
export function setOverview(name = ''): void {
    const element: HTMLElement = <HTMLElement>(
        document.querySelector('.overview')
    );
    $scope.overview = name;
    element.innerHTML = name;
}

/**
 * Set the progress of the progress bar in the
 * item details page. (Not the same as the playback ui)
 *
 * @param value percentage to set
 */
export function setPlayedPercentage(value = 0): void {
    const element: HTMLInputElement = <HTMLInputElement>(
        document.querySelector('.itemProgressBar')
    );

    $scope.playedPercentage = value;
    element.value = value.toString();
}

/**
 * Set the url of the idle screen backdrop
 *
 * @param src URL to image
 */
export function setWaitingBackdrop(src: string | null): void {
    const element: HTMLElement = <HTMLElement>(
        document.querySelector('#waiting-container-backdrop')
    );

    element.style.backgroundImage = src ? 'url(' + src + ')' : '';
}

/**
 * Set the visibility of the item progress bar in the
 * item details page
 *
 * @param value show it if true
 */
export function setHasPlayedPercentage(value: boolean): void {
    const element: HTMLElement = <HTMLElement>(
        document.querySelector('.detailImageProgressContainer')
    );
    if (value) element.classList.remove('hide');
    else element.classList.add('hide');
}

/**
 * Set the URL to the item logo, or null to remove it
 *
 * @param src url or null
 */
export function setLogo(src: string | null): void {
    const element: HTMLElement = <HTMLElement>(
        document.querySelector('.detailLogo')
    );
    element.style.backgroundImage = src ? 'url(' + src + ')' : '';
}

/**
 * Set the URL to the item banner image (I think?),
 * or null to remove it
 *
 * @param src url or null
 */
export function setDetailImage(src: string | null): void {
    const element: HTMLElement = <HTMLElement>(
        document.querySelector('.detailImage')
    );

    element.style.backgroundImage = src ? 'url(' + src + ')' : '';
}

/**
 * Take all properties of source and copy them over to target
 *
 * TODO can we remove this crap
 *
 * @param target object that gets populated with entries
 * @param source object that the entries are copied from
 */
export function extend(target: any, source: any): any {
    for (const i in source) {
        target[i] = source[i];
    }
    return target;
}

/**
 * Parse a date.. Just a wrapper around new Date,
 * but could be useful to deal with weird date strings
 * in the future.
 *
 * @param date string date to parse
 * @returns date object
 */
export function parseISO8601Date(date: string): Date {
    return new Date(date);
}

/**
 * Get a human readable representation of the current position
 * in ticks
 *
 * @param ticks tick position
 * @returns human readable position
 */
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

/**
 * Send a message over the custom message transport
 *
 * @param message to send
 */
export function broadcastToMessageBus(message: BusMessage): void {
    window.castReceiverContext.sendCustomMessage(
        'urn:x-cast:com.connectsdk',
        window.senderId,
        message
    );
}

/**
 * Inform the cast sender that we couldn't connect
 */
export function broadcastConnectionErrorMessage(): void {
    broadcastToMessageBus({ type: 'connectionerror', message: '' });
}

/**
 * Remove all special characters from a string
 *
 * @param name input string
 * @returns string with non-whitespace non-word characters removed
 */
export function cleanName(name: string): string {
    return name.replace(/[^\w\s]/gi, '');
}
