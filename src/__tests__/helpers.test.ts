import { describe, beforeEach, test, expect, vi } from 'vitest';
import type {
    BaseItemDto,
    MediaSourceInfo
} from '@jellyfin/sdk/lib/generated-client';

class MockTrack {
    constructor(
        public trackId: number,
        public type: string
    ) {}
}

// The modules resolve the cast context on load, so the mock has to be in
// place before they are imported.
// Importing it for real boots the whole receiver, which needs a DOM. Nothing
// it exports is reachable from createStreamInfo.
vi.mock('../components/playbackManager', () => ({
    PlaybackManager: {}
}));

const importHelpers = async (): Promise<typeof import('../helpers')> => {
    // @ts-expect-error cast is already defined globally, however since we're mocking it we need to redefine it.
    global.cast = {
        framework: {
            CastReceiverContext: {
                getInstance: (): unknown => ({
                    canDisplayType: (): boolean => false,
                    getDeviceCapabilities: (): Record<string, boolean> => ({
                        display_supported: true
                    }),
                    getSenders: (): unknown[] => [{ id: 'senderId' }]
                })
            },
            messages: {
                TextTrackType: { SUBTITLES: 'SUBTITLES' },
                Track: MockTrack,
                TrackType: { TEXT: 'TEXT' }
            },
            system: {
                DeviceCapabilities: {
                    DISPLAY_SUPPORTED: 'display_supported',
                    IS_HDR_SUPPORTED: 'is_hdr_supported'
                }
            }
        }
    };

    vi.resetModules();

    const { JellyfinApi } = await import('../components/jellyfinApi');

    JellyfinApi.setServerInfo('accessToken', 'serverAddress');

    return import('../helpers');
};

const item: BaseItemDto = { Id: 'itemId', MediaType: 'Video' };

// A source the server hands back as an HLS transcode, packaged as fMP4.
const hlsMediaSource: MediaSourceInfo = {
    Container: 'mkv',
    Id: 'mediaSourceId',
    RunTimeTicks: 1000,
    SupportsDirectPlay: false,
    SupportsDirectStream: false,
    TranscodingContainer: 'mp4',
    TranscodingSubProtocol: 'hls',
    TranscodingUrl: '/videos/itemId/master.m3u8'
};

// The server lists external subtitles ahead of the embedded streams, so an
// external file gets index 0 and the embedded streams follow.
const mediaSource = (defaultSubtitleStreamIndex?: number): MediaSourceInfo => ({
    Container: 'mkv',
    DefaultSubtitleStreamIndex: defaultSubtitleStreamIndex,
    Id: 'mediaSourceId',
    MediaStreams: [
        {
            DeliveryUrl: '/subs/external.vtt',
            Index: 0,
            IsExternal: true,
            Language: 'eng',
            Type: 'Subtitle'
        },
        { Index: 1, Type: 'Video' },
        { Index: 2, Type: 'Audio' },
        {
            DeliveryUrl: '/subs/embedded.vtt',
            Index: 3,
            IsExternal: false,
            Language: 'fra',
            Type: 'Subtitle'
        }
    ],
    RunTimeTicks: 1000,
    SupportsDirectPlay: false,
    SupportsDirectStream: true
});

describe('subtitle tracks', () => {
    let createStreamInfo: typeof import('../helpers').createStreamInfo;

    beforeEach(async () => {
        ({ createStreamInfo } = await importHelpers());
    });

    test('are announced when the external subtitle at index 0 is selected', () => {
        const info = createStreamInfo(item, mediaSource(0), null);

        expect(info.subtitleStreamIndex).toBe(0);
        expect(info.tracks?.map((track) => track.trackId)).toStrictEqual([
            0, 3
        ]);
    });

    // The player looks a track up by its stream index when activating it, so
    // each one has to carry its own index rather than the selected one.
    test('are identified by their own index, not the selected one', () => {
        const info = createStreamInfo(item, mediaSource(3), null);

        expect(info.tracks?.map((track) => track.trackId)).toStrictEqual([
            0, 3
        ]);
    });

    test('are left out when no subtitle is selected', () => {
        expect(
            createStreamInfo(item, mediaSource(), null).tracks
        ).toStrictEqual([]);
    });
});

describe('HLS streams', () => {
    let createStreamInfo: typeof import('../helpers').createStreamInfo;

    beforeEach(async () => {
        ({ createStreamInfo } = await importHelpers());
    });

    // Those two describe the segments to MPL, and HLS is handed to Shaka
    // (`useShakaForHls`), which reads the packaging off the playlist. Sending
    // them anyway stopped every HLS stream from starting.
    // See: https://github.com/jellyfin/jellyfin-chromecast/issues/949
    test('do not carry the MPL segment format hints', () => {
        const info = createStreamInfo(item, hlsMediaSource, null);

        expect(info.contentType).toBe('application/x-mpegURL');
        expect(info).not.toHaveProperty('hlsSegmentFormat');
        expect(info).not.toHaveProperty('hlsVideoSegmentFormat');
    });
});
