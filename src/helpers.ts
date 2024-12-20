import type {
    BaseItemDtoQueryResult,
    PlaybackProgressInfo,
    MediaSourceInfo,
    MediaStream,
    BaseItemDto,
    BaseItemPerson,
    TvShowsApiGetEpisodesRequest,
    UserDto,
    InstantMixApiGetInstantMixFromAlbumRequest,
    InstantMixApiGetInstantMixFromPlaylistRequest,
    InstantMixApiGetInstantMixFromArtistsRequest,
    InstantMixApiGetInstantMixFromSongRequest,
    ItemFields,
    ItemsApiGetItemsRequest
} from '@jellyfin/sdk/lib/generated-client';
import {
    getInstantMixApi,
    getItemsApi,
    getTvShowsApi,
    getUserApi
} from '@jellyfin/sdk/lib/utils/api';
import type {
    GenericMediaMetadata,
    MovieMediaMetadata,
    MusicTrackMediaMetadata,
    PhotoMediaMetadata,
    TvShowMediaMetadata
} from 'chromecast-caf-receiver/cast.framework.messages';
import { JellyfinApi } from './components/jellyfinApi';
import {
    PlaybackManager,
    type PlaybackState
} from './components/playbackManager';
import type { BusMessage, StreamInfo } from './types/global';

type InstantMixApiRequest =
    | InstantMixApiGetInstantMixFromAlbumRequest
    | InstantMixApiGetInstantMixFromArtistsRequest
    | InstantMixApiGetInstantMixFromSongRequest
    | InstantMixApiGetInstantMixFromPlaylistRequest;

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
        PlayState: reportingData
    };

    state.NowPlayingItem = {
        Id: reportingData.ItemId,
        RunTimeTicks: playbackState.runtimeTicks
    };

    const item = playbackState.item;

    if (item) {
        const nowPlayingItem = state.NowPlayingItem;

        nowPlayingItem.ServerId = item.ServerId;
        nowPlayingItem.Chapters = item.Chapters ?? [];

        const mediaSource = item.MediaSources?.find((m: MediaSourceInfo) => {
            return m.Id == reportingData.MediaSourceId;
        });

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

        const imageTags = item.ImageTags ?? {};

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

        if (item.BackdropImageTags?.length) {
            nowPlayingItem.BackdropItemId = item.Id;
            nowPlayingItem.BackdropImageTag = item.BackdropImageTags[0];
        } else if (item.ParentBackdropImageTags?.length) {
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
export function getMetadata(
    item: BaseItemDto
):
    | GenericMediaMetadata
    | MovieMediaMetadata
    | MusicTrackMediaMetadata
    | PhotoMediaMetadata
    | TvShowMediaMetadata {
    let metadata:
        | GenericMediaMetadata
        | MovieMediaMetadata
        | MusicTrackMediaMetadata
        | PhotoMediaMetadata
        | TvShowMediaMetadata;
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
        const tvShowMedata = new cast.framework.messages.TvShowMediaMetadata();

        tvShowMedata.seriesTitle = item.SeriesName ?? undefined;

        if (item.PremiereDate) {
            tvShowMedata.originalAirdate = parseISO8601Date(
                item.PremiereDate
            ).toISOString();
        }

        if (item.IndexNumber != null) {
            tvShowMedata.episode = item.IndexNumber;
        }

        if (item.ParentIndexNumber != null) {
            tvShowMedata.season = item.ParentIndexNumber;
        }

        metadata = tvShowMedata;
    } else if (item.Type == 'Photo') {
        const photoMetadata = new cast.framework.messages.PhotoMediaMetadata();

        if (item.PremiereDate) {
            photoMetadata.creationDateTime = parseISO8601Date(
                item.PremiereDate
            ).toISOString();
        }
        // TODO more metadata?

        metadata = photoMetadata;
    } else if (item.Type == 'Audio') {
        const musicTrackMetadata =
            new cast.framework.messages.MusicTrackMediaMetadata();

        musicTrackMetadata.songName = item.Name ?? undefined;
        musicTrackMetadata.artist = item.Artists?.length
            ? item.Artists.join(', ')
            : '';
        musicTrackMetadata.albumArtist = item.AlbumArtist ?? undefined;
        musicTrackMetadata.albumName = item.Album ?? undefined;

        if (item.PremiereDate) {
            musicTrackMetadata.releaseDate = parseISO8601Date(
                item.PremiereDate
            ).toISOString();
        }

        if (item.IndexNumber != null) {
            musicTrackMetadata.trackNumber = item.IndexNumber;
        }

        if (item.ParentIndexNumber != null) {
            musicTrackMetadata.discNumber = item.ParentIndexNumber;
        }

        // previously: p.PersonType == 'Type'.. wtf?
        const composer = (item.People ?? []).find(
            (p: BaseItemPerson) => p.Type == 'Composer'
        );

        if (composer?.Name) {
            musicTrackMetadata.composer = composer.Name;
        }

        metadata = musicTrackMetadata;
    } else if (item.Type == 'Movie') {
        const movieMetadata = new cast.framework.messages.MovieMediaMetadata();

        if (item.PremiereDate) {
            movieMetadata.releaseDate = parseISO8601Date(
                item.PremiereDate
            ).toISOString();
        }

        if (item.Studios?.length && item.Studios[0].Name) {
            movieMetadata.studio = item.Studios[0].Name;
        }

        metadata = movieMetadata;
    } else {
        const genericMetadata =
            new cast.framework.messages.GenericMediaMetadata();

        if (item.PremiereDate) {
            genericMetadata.releaseDate = parseISO8601Date(
                item.PremiereDate
            ).toISOString();
        }

        metadata = genericMetadata;
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
): StreamInfo {
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

        if (mediaSource.SupportsDirectPlay && mediaSource.Path) {
            mediaUrl = mediaSource.Path;
            isStatic = true;
        } else if (mediaSource.SupportsDirectStream) {
            mediaUrl = JellyfinApi.createUrl(
                `videos/${item.Id}/stream.${mediaSource.Container}?mediaSourceId=${mediaSource.Id}&api_key=${JellyfinApi.accessToken}&static=true${seekParam}`
            );
            isStatic = true;
            playerStartPositionTicks = startPosition ?? 0;
        } else {
            // TODO deal with !TranscodingUrl
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            mediaUrl = JellyfinApi.createUrl(mediaSource.TranscodingUrl!);

            if (isHlsStream(mediaSource)) {
                mediaUrl += seekParam;
                playerStartPositionTicks = startPosition ?? 0;
                contentType = 'application/x-mpegURL';
                streamContainer = 'm3u8';
            } else {
                contentType = `video/${mediaSource.TranscodingContainer}`;
                streamContainer = mediaSource.TranscodingContainer;

                if (mediaUrl.toLowerCase().includes('copytimestamps=true')) {
                    startPosition = 0;
                }
            }
        }
    } else {
        contentType = `audio/${mediaSource.Container}`;

        if (mediaSource.SupportsDirectPlay && mediaSource.Path) {
            mediaUrl = mediaSource.Path;
            isStatic = true;
            playerStartPositionTicks = startPosition ?? 0;
        } else {
            const isDirectStream = mediaSource.SupportsDirectStream;

            if (isDirectStream) {
                const outputContainer = (
                    mediaSource.Container ?? ''
                ).toLowerCase();

                mediaUrl = JellyfinApi.createUrl(
                    `Audio/${item.Id}/stream.${outputContainer}?mediaSourceId=${mediaSource.Id}&api_key=${JellyfinApi.accessToken}&static=true${seekParam}`
                );
                isStatic = true;
            } else {
                streamContainer = mediaSource.TranscodingContainer;
                contentType = `audio/${mediaSource.TranscodingContainer}`;

                // TODO deal with !TranscodingUrl
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                mediaUrl = JellyfinApi.createUrl(mediaSource.TranscodingUrl!);
            }
        }
    }

    // TODO: Remove the second half of the expression by supporting changing the mediaElement src dynamically.
    // It is a pain and will require unbinding all event handlers during the operation
    const canSeek = (mediaSource.RunTimeTicks ?? 0) > 0;

    const info: StreamInfo = {
        audioStreamIndex: mediaSource.DefaultAudioStreamIndex ?? null,
        canClientSeek: isStatic || (canSeek && streamContainer == 'm3u8'),
        canSeek: canSeek,
        contentType: contentType,
        isStatic: isStatic,
        mediaSource: mediaSource,
        playerStartPositionTicks: playerStartPositionTicks,
        startPositionTicks: startPosition,
        streamContainer: streamContainer,
        subtitleStreamIndex: mediaSource.DefaultSubtitleStreamIndex ?? null,
        url: mediaUrl
    };

    const subtitleStreams =
        mediaSource.MediaStreams?.filter((stream: MediaStream) => {
            return stream.Type === 'Subtitle';
        }) ?? [];
    const subtitleTracks: framework.messages.Track[] = [];

    subtitleStreams.forEach((subtitleStream) => {
        if (subtitleStream.DeliveryUrl === undefined) {
            /* The CAF v3 player only supports vtt currently,
             * SRT subs can be "transcoded" to vtt by jellyfin.
             * The server will do that in accordance with the device profiles and
             * give us a DeliveryUrl if that is the case.
             * Support for more could be added with a custom implementation
             */
            return;
        }

        if (!info.subtitleStreamIndex) {
            return;
        }

        const track = new cast.framework.messages.Track(
            info.subtitleStreamIndex,
            cast.framework.messages.TrackType.TEXT
        );

        if (subtitleStream.IsExternal && subtitleStream.DeliveryUrl) {
            track.trackContentId = subtitleStream.DeliveryUrl;
        } else if (subtitleStream.DeliveryUrl) {
            track.trackContentId = JellyfinApi.createUrl(
                subtitleStream.DeliveryUrl
            );
        }

        if (subtitleStream.Index) {
            track.trackId = subtitleStream.Index;
        }

        if (subtitleStream.Language) {
            track.language = subtitleStream.Language;
        }

        if (subtitleStream.DisplayTitle) {
            track.name = subtitleStream.DisplayTitle;
        }

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
 * @returns first matching stream
 */
export function getStreamByIndex(
    streams: MediaStream[],
    type: string,
    index: number
): MediaStream {
    return (
        streams.find((s) => {
            return s.Type == type && s.Index == index;
        }) ?? {}
    );
}

// defined for use in the 3 next functions
const requiredItemFields: ItemFields[] = ['MediaSources', 'Chapters'];

/**
 * Get a random selection of items given one item,
 * this item can be a music artist item, or a music genre item,
 * or something else. If something else it searches for child items
 * of the provided one.
 *
 * It's used only in maincomponents.shuffle.
 * @param item - Parent item of shuffle search
 * @returns items for the queue
 */
export function getShuffleItems(
    item: BaseItemDto
): Promise<BaseItemDtoQueryResult> {
    let query: ItemsApiGetItemsRequest = {
        fields: requiredItemFields,
        filters: ['IsNotFolder'],
        limit: 50,
        recursive: true,
        sortBy: ['Random']
    };

    if (item.Type == 'MusicArtist') {
        query = {
            ...query,
            artistIds: item.Id ? [item.Id] : undefined,
            mediaTypes: ['Audio']
        };
    } else if (item.Type == 'MusicGenre') {
        query = {
            ...query,
            genres: item.Name ? [item.Name] : undefined,
            mediaTypes: ['Audio']
        };
    } else {
        query = {
            ...query,
            parentId: item.Id
        };
    }

    return getItemsForPlayback(query);
}

/**
 * Get an "Instant Mix" given an item, which can be a
 * music artist, genre, album, playlist
 * @param item - Parent item of the search
 * @returns items for the queue
 */
export async function getInstantMixItems(
    item: BaseItemDto
): Promise<BaseItemDtoQueryResult> {
    if (item.Id === undefined) {
        throw new Error('Item ID not provided');
    }

    const query: InstantMixApiRequest = {
        fields: ['MediaSources', 'Chapters'],
        itemId: item.Id,
        limit: 50
    };

    const instantMixApi = getInstantMixApi(JellyfinApi.jellyfinApi);

    if (item.Type == 'MusicArtist') {
        return (await instantMixApi.getInstantMixFromArtists(query)).data;
    } else if (item.Type == 'MusicGenre') {
        return (
            await instantMixApi.getInstantMixFromMusicGenreById({
                ...query,
                id: item.Id
            })
        ).data;
    } else if (item.Type == 'MusicAlbum') {
        return (await instantMixApi.getInstantMixFromAlbum(query)).data;
    } else if (item.Type == 'Audio') {
        return (await instantMixApi.getInstantMixFromSong(query)).data;
    } else if (item.Type == 'Playlist') {
        return (await instantMixApi.getInstantMixFromPlaylist(query)).data;
    }

    throw new Error(`InstantMix: Unknown item type: ${item.Type}`);
}

/**
 * Get items to be played back
 * @param query - specification on what to search for
 * @returns items to be played back
 */
export async function getItemsForPlayback(
    query: ItemsApiGetItemsRequest
): Promise<BaseItemDtoQueryResult> {
    const response = await getItemsApi(JellyfinApi.jellyfinApi).getItems({
        ...query,
        excludeLocationTypes: ['Virtual'],
        fields: requiredItemFields,
        limit: query.limit ?? 100
    });

    return response.data;
}

/**
 * Get episodes for a show given by seriesId
 * @param query - query parameters to build on
 * @returns episode items
 */
export async function getEpisodesForPlayback(
    query: TvShowsApiGetEpisodesRequest
): Promise<BaseItemDtoQueryResult> {
    const response = await getTvShowsApi(JellyfinApi.jellyfinApi).getEpisodes(
        query
    );

    return response.data;
}

/**
 * Get user object for the current user
 * @returns user object
 */
export async function getUser(): Promise<UserDto> {
    const response = await getUserApi(JellyfinApi.jellyfinApi).getCurrentUser();

    return response.data;
}

/**
 * Process a list of items for playback
 * by resolving things like folders to playable items.
 * @param items - items to resolve
 * @param smart - If enabled it will try to find the next episode given the current one,
 * if the connected user has enabled that in their settings
 * @returns Promise for search result containing items to play
 */
export async function translateRequestedItems(
    items: BaseItemDto[],
    smart = false
): Promise<BaseItemDtoQueryResult> {
    const firstItem = items[0];

    if (firstItem.Type == 'Playlist') {
        return await getItemsForPlayback({
            parentId: firstItem.Id
        });
    } else if (firstItem.Type == 'MusicArtist') {
        return await getItemsForPlayback({
            artistIds: firstItem.Id ? [firstItem.Id] : undefined,
            filters: ['IsNotFolder'],
            mediaTypes: ['Audio'],
            recursive: true,
            sortBy: ['SortName']
        });
    } else if (firstItem.Type == 'MusicGenre') {
        return await getItemsForPlayback({
            filters: ['IsNotFolder'],
            genres: firstItem.Name ? [firstItem.Name] : undefined,
            mediaTypes: ['Audio'],
            recursive: true,
            sortBy: ['SortName']
        });
    } else if (firstItem.IsFolder) {
        return await getItemsForPlayback({
            filters: ['IsNotFolder'],
            mediaTypes: ['Audio', 'Video'],
            parentId: firstItem.Id,
            recursive: true,
            sortBy: ['SortName']
        });
    } else if (smart && firstItem.Type == 'Episode' && items.length == 1) {
        const user = await getUser();

        if (!user.Configuration?.EnableNextEpisodeAutoPlay) {
            return {
                Items: items
            };
        }

        const result = await getItemsForPlayback({
            ids: firstItem.Id ? [firstItem.Id] : undefined
        });

        if (!result.Items || result.Items.length < 1) {
            return result;
        }

        const episode = result.Items[0];

        if (!episode.SeriesId) {
            return result;
        }

        const episodesResult = await getEpisodesForPlayback({
            isMissing: false,
            seriesId: episode.SeriesId
        });

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

        episodesResult.TotalRecordCount = episodesResult.Items?.length ?? 0;

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
