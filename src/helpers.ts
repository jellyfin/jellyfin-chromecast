import type {
    BaseItemDtoQueryResult,
    PlaybackProgressInfo,
    MediaSourceInfo,
    BaseItemDto,
    BaseItemPerson,
    UserDto
} from '@jellyfin/sdk/lib/generated-client';
import { JellyfinApi } from './components/jellyfinApi';
import { PlaybackManager, PlaybackState } from './components/playbackManager';
import { BusMessage, ItemQuery } from './types/global';

export const TicksPerSecond = 10000000;

/**
 * Get current playback position in ticks, adjusted for server seeking
 * @param state - playback state.
 * @returns position in ticks
 */
export function getCurrentPositionTicks(state: PlaybackState): number {
    let positionTicks =
        window.playerManager.getCurrentTimeSec() * TicksPerSecond;
    const mediaInformation = window.playerManager.getMediaInformation();

    if (mediaInformation && !mediaInformation.customData?.canClientSeek) {
        positionTicks += state.startPositionTicks || 0;
    }

    return positionTicks;
}

/**
 * Get parameters used for playback reporting
 * @param state - playback state.
 * @returns progress information for use with the reporting APIs
 */
export function getReportingParams(state: PlaybackState): PlaybackProgressInfo {
    /* Math.round() calls:
     * on 10.7, any floating point will give an API error,
     * so it's actually really important to make sure that
     * those fields are always rounded.
     */
    return {
        AudioStreamIndex: state.audioStreamIndex,
        CanSeek: state.canSeek,
        IsMuted: window.volume?.muted ?? false,
        IsPaused:
            window.playerManager.getPlayerState() ===
            cast.framework.messages.PlayerState.PAUSED,
        ItemId: state.itemId,
        LiveStreamId: state.liveStreamId,
        MediaSourceId: state.mediaSourceId,
        PlayMethod: state.playMethod,
        PlaySessionId: state.playSessionId,
        PositionTicks: Math.round(getCurrentPositionTicks(state)),
        RepeatMode: window.repeatMode,
        SubtitleStreamIndex: state.subtitleStreamIndex,
        VolumeLevel: Math.round((window.volume?.level ?? 0) * 100)
    };
}

/**
 * getSenderReportingData
 * This is used in playback reporting to find out information
 * about the item that is currently playing. This is sent over the cast protocol over to
 * the connected client (or clients?).
 * @param playbackState - playback state.
 * @param reportingData - object full of random information
 * @returns lots of data for the connected client
 */
export function getSenderReportingData(
    playbackState: PlaybackState,
    reportingData: PlaybackProgressInfo
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state: any = {
        ItemId: reportingData.ItemId,
        PlayState: reportingData,
        QueueableMediaTypes: ['Audio', 'Video']
    };

    state.NowPlayingItem = {
        Id: reportingData.ItemId,
        RunTimeTicks: playbackState.runtimeTicks
    };

    const item = playbackState.item;

    if (item) {
        const nowPlayingItem = state.NowPlayingItem;

        nowPlayingItem.ServerId = item.ServerId;
        nowPlayingItem.Chapters = item.Chapters || [];

        // TODO: Fill these
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mediaSource = item.MediaSources?.filter((m: any) => {
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

        if (playbackState.playNextItemBool) {
            const nextItemInfo = PlaybackManager.getNextPlaybackItemInfo();

            if (nextItemInfo) {
                state.NextMediaType = nextItemInfo.item.MediaType;
            }
        }
    }

    return state;
}

/**
 * Create CAF-native metadata for a given item
 * @param item - item to look up
 * @returns one of the metadata classes in cast.framework.messages.*Metadata
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getMetadata(item: BaseItemDto): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let metadata: any;
    let posterUrl = '';

    if (item.SeriesPrimaryImageTag) {
        posterUrl = JellyfinApi.createUrl(
            `Items/${item.SeriesId}/Images/Primary?tag=${item.SeriesPrimaryImageTag}`
        );
    } else if (item.AlbumPrimaryImageTag) {
        posterUrl = JellyfinApi.createUrl(
            `Items/${item.AlbumId}/Images/Primary?tag=${item.AlbumPrimaryImageTag}`
        );
    } else if (item.ImageTags?.Primary) {
        posterUrl = JellyfinApi.createUrl(
            `Items/${item.Id}/Images/Primary?tag=${item.ImageTags.Primary}`
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

        // previously: p.PersonType == 'Type'.. wtf?
        const composer = (item.People || []).filter(
            (p: BaseItemPerson) => p.Type == 'Composer'
        )[0];

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

/**
 * Check if a media source is an HLS stream
 * @param mediaSource - mediaSource
 * @returns boolean
 */
export function isHlsStream(mediaSource: MediaSourceInfo): boolean {
    return mediaSource.TranscodingSubProtocol == 'hls';
}

/**
 * Create the necessary information about an item
 * needed for playback
 * @param item - Item to play
 * @param mediaSource - MediaSourceInfo for the item
 * @param startPosition - Where to seek to (possibly server seeking)
 * @returns object with enough information to start playback
 */
export function createStreamInfo(
    item: BaseItemDto,
    mediaSource: MediaSourceInfo,
    startPosition: number | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    let mediaUrl;
    let contentType;

    // server seeking
    const startPositionInSeekParam = startPosition
        ? ticksToSeconds(startPosition)
        : 0;
    const seekParam = startPositionInSeekParam
        ? `#t=${startPositionInSeekParam}`
        : '';

    let isStatic = false;
    let streamContainer = mediaSource.Container;

    let playerStartPositionTicks = 0;

    const type = item.MediaType?.toLowerCase();

    if (type == 'video') {
        contentType = `video/${mediaSource.Container}`;

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

            if (isHlsStream(mediaSource)) {
                mediaUrl += seekParam;
                playerStartPositionTicks = startPosition || 0;
                contentType = 'application/x-mpegURL';
                streamContainer = 'm3u8';
            } else {
                contentType = `video/${mediaSource.TranscodingContainer}`;
                streamContainer = mediaSource.TranscodingContainer;

                if (
                    mediaUrl.toLowerCase().indexOf('copytimestamps=true') != -1
                ) {
                    startPosition = 0;
                }
            }
        }
    } else {
        contentType = `audio/${mediaSource.Container}`;

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
                contentType = `audio/${mediaSource.TranscodingContainer}`;

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const info: any = {
        audioStreamIndex: mediaSource.DefaultAudioStreamIndex,
        canClientSeek: isStatic || (canSeek && streamContainer == 'm3u8'),
        canSeek: canSeek,
        contentType: contentType,
        isStatic: isStatic,
        mediaSource: mediaSource,
        playerStartPositionTicks: playerStartPositionTicks,
        startPositionTicks: startPosition,
        streamContainer: streamContainer,
        subtitleStreamIndex: mediaSource.DefaultSubtitleStreamIndex,
        url: mediaUrl
    };

    const subtitleStreams =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mediaSource.MediaStreams?.filter((stream: any) => {
            return stream.Type === 'Subtitle';
        }) ?? [];
    const subtitleTracks: Array<framework.messages.Track> = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subtitleStreams.forEach((subtitleStream: any) => {
        if (subtitleStream.DeliveryUrl === undefined) {
            /* The CAF v3 player only supports vtt currently,
             * SRT subs can be "transcoded" to vtt by jellyfin.
             * The server will do that in accordance with the device profiles and
             * give us a DeliveryUrl if that is the case.
             * Support for more could be added with a custom implementation
             */
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
        console.log(`Subtitle url: ${info.subtitleStreamUrl}`);
    });

    info.tracks = subtitleTracks;

    return info;
}

/**
 * Get stream by its index while making a type assertion
 * @param streams - array streams to consider
 * @param type - type of stream
 * @param index - index of stream
 * @returns first first matching stream
 */
export function getStreamByIndex(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    streams: Array<any>,
    type: string,
    index: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
    return streams.filter((s) => {
        return s.Type == type && s.Index == index;
    })[0];
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
 * @param userId - User ID to look up items with
 * @param item - Parent item of shuffle search
 * @returns items for the queue
 */
export function getShuffleItems(
    userId: string,
    item: BaseItemDto
): Promise<BaseItemDtoQueryResult> {
    const query: ItemQuery = {
        Fields: requiredItemFields,
        Filters: 'IsNotFolder',
        Limit: 50,
        Recursive: true,
        SortBy: 'Random',
        UserId: userId
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
 * @param userId - User ID to look up items with
 * @param item - Parent item of the search
 * @returns items for the queue
 */
export async function getInstantMixItems(
    userId: string,
    item: BaseItemDto
): Promise<BaseItemDtoQueryResult> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: any = {
        Fields: requiredItemFields,
        Limit: 50,
        UserId: userId
    };

    let url: string | null = null;

    if (item.Type == 'MusicArtist') {
        url = 'Artists/InstantMix';
        query.Id = item.Id;
    } else if (item.Type == 'MusicGenre') {
        url = 'MusicGenres/InstantMix';
        query.Id = item.Id;
    } else if (item.Type == 'MusicAlbum') {
        url = `Albums/${item.Id}/InstantMix`;
    } else if (item.Type == 'Audio') {
        url = `Songs/${item.Id}/InstantMix`;
    } else if (item.Type == 'Playlist') {
        url = `Playlists/${item.Id}/InstantMix`;
    }

    if (url) {
        return JellyfinApi.authAjax(url, {
            dataType: 'json',
            query: query,
            type: 'GET'
        });
    } else {
        throw new Error(`InstantMix: Unknown item type: ${item.Type}`);
    }
}

/**
 * Get items to be played back
 * @param userId - user for the search
 * @param query - specification on what to search for
 * @returns items to be played back
 */
export async function getItemsForPlayback(
    userId: string,
    query: ItemQuery
): Promise<BaseItemDtoQueryResult> {
    query.UserId = userId;
    query.Limit = query.Limit || 100;
    query.Fields = requiredItemFields;
    query.ExcludeLocationTypes = 'Virtual';

    if (query.Ids && query.Ids.split(',').length == 1) {
        const item = await JellyfinApi.authAjaxUser(
            `Items/${query.Ids.split(',')[0]}`,
            {
                dataType: 'json',
                type: 'GET'
            }
        );

        return {
            Items: [item],
            TotalRecordCount: 1
        };
    } else {
        return JellyfinApi.authAjaxUser('Items', {
            dataType: 'json',
            query: query,
            type: 'GET'
        });
    }
}

/**
 * Get episodes for a show given by seriesId
 * @param userId - userid to use
 * @param seriesId - series to look up
 * @param query - query parameters to build on
 * @returns episode items
 */
export function getEpisodesForPlayback(
    userId: string,
    seriesId: string,
    query: ItemQuery
): Promise<BaseItemDtoQueryResult> {
    query.UserId = userId;
    query.Fields = requiredItemFields;
    query.ExcludeLocationTypes = 'Virtual';

    return JellyfinApi.authAjax(`Shows/${seriesId}/Episodes`, {
        dataType: 'json',
        query: query,
        type: 'GET'
    });
}

/**
 * Get intros for a given item. This item should be a video
 * type for this to make sense
 * @param firstItem - item to get intros for
 * @returns intro items
 */
export function getIntros(
    firstItem: BaseItemDto
): Promise<BaseItemDtoQueryResult> {
    return JellyfinApi.authAjaxUser(`Items/${firstItem.Id}/Intros`, {
        dataType: 'json',
        type: 'GET'
    });
}

/**
 * Get user object for the current user
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
 * @param userId - userId to use
 * @param items - items to resolve
 * @param smart - If enabled it will try to find the next episode given the current one,
 * if the connected user has enabled that in their settings
 * @returns Promise for search result containing items to play
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
            MediaTypes: 'Audio',
            Recursive: true,
            SortBy: 'SortName'
        });
    } else if (firstItem.Type == 'MusicGenre') {
        return await getItemsForPlayback(userId, {
            Filters: 'IsNotFolder',
            Genres: firstItem.Name ?? undefined,
            MediaTypes: 'Audio',
            Recursive: true,
            SortBy: 'SortName'
        });
    } else if (firstItem.IsFolder) {
        return await getItemsForPlayback(userId, {
            Filters: 'IsNotFolder',
            MediaTypes: 'Audio,Video',
            ParentId: firstItem.Id,
            Recursive: true,
            SortBy: 'SortName'
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

        if (!result.Items || result.Items.length < 1) {
            return result;
        }

        const episode = result.Items[0];

        if (!episode.SeriesId) {
            return result;
        }

        const episodesResult = await getEpisodesForPlayback(
            userId,
            episode.SeriesId,
            {
                IsMissing: false,
                IsVirtualUnaired: false,
                UserId: userId
            }
        );

        let foundItem = false;

        episodesResult.Items = episodesResult.Items?.filter(
            (e: BaseItemDto) => {
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

        episodesResult.TotalRecordCount = episodesResult.Items?.length || 0;

        return episodesResult;
    }

    return {
        Items: items
    };
}

/**
 * Parse a date.. Just a wrapper around new Date,
 * but could be useful to deal with weird date strings
 * in the future.
 * @param date - string date to parse
 * @returns date object
 */
export function parseISO8601Date(date: string): Date {
    return new Date(date);
}

/**
 * Convert ticks to seconds
 * @param ticks - number of ticks to convert
 * @returns number of seconds
 */
export function ticksToSeconds(ticks: number): number {
    return ticks / TicksPerSecond;
}

/**
 * Send a message over the custom message transport
 * @param message - to send
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
    broadcastToMessageBus({ message: '', type: 'connectionerror' });
}
