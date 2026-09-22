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
        {
            DeliveryUrl: 'https://subs.example/ext.vtt',
            Index: 1,
            IsExternal: true,
            IsExternalUrl: true,
            Type: 'Subtitle'
        },
        { Index: 2, Type: 'Video' },
        { Index: 3, Type: 'Audio' },
        {
            DeliveryUrl: '/subs/embedded.vtt',
            Index: 4,
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
            0, 1, 4
        ]);
    });

    // The player looks a track up by its stream index when activating it, so
    // each one has to carry its own index rather than the selected one.
    test('are identified by their own index, not the selected one', () => {
        const info = createStreamInfo(item, mediaSource(4), null);

        expect(info.tracks?.map((track) => track.trackId)).toStrictEqual([
            0, 1, 4
        ]);
    });

    test('are resolved against the server address unless the subtitle is served by another host', () => {
        const info = createStreamInfo(item, mediaSource(0), null);

        expect(info.tracks?.map((track) => track.trackContentId)).toStrictEqual(
            [
                'serverAddress/subs/external.vtt',
                'https://subs.example/ext.vtt',
                'serverAddress/subs/embedded.vtt'
            ]
        );
    });

    test('are left out when no subtitle is selected', () => {
        expect(
            createStreamInfo(item, mediaSource(), null).tracks
        ).toStrictEqual([]);
    });
});
