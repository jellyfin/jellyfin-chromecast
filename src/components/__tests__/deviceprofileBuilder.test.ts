import { describe, beforeEach, test, expect, vi } from 'vitest';
import type {
    CodecProfile,
    DeviceProfile,
    ProfileCondition,
    TranscodingProfile
} from '@jellyfin/sdk/lib/generated-client';

// Codecs that a Cast device demuxes natively from a complete file, but which
// its MSE pipeline rejects inside fMP4 segments.
const NOT_PLAYABLE_IN_FMP4 = ['mp3', 'opus'];
// MPEG-TS has no packet type for these, and Dolby passthrough in MPEG-TS was
// reported broken in 2020 and never re-verified.
const NOT_PLAYABLE_IN_TS = ['opus', 'flac', 'alac', 'vorbis', 'ac3', 'eac3'];

interface DeviceOptions {
    ac3?: boolean;
    av1?: boolean;
    dovi?: boolean;
    eac3?: boolean;
    hdr?: boolean;
    hevc?: boolean;
}

const mockCastContext = (options: DeviceOptions): void => {
    const canDisplayType = (mimeType: string, codec: string): boolean => {
        if (mimeType === 'audio/mp4') {
            if (codec === 'ac-3') {
                return options.ac3 ?? false;
            }

            if (codec === 'ec-3') {
                return options.eac3 ?? false;
            }

            return false;
        }

        if (mimeType === 'video/mp4') {
            if (codec.startsWith('avc1')) {
                return true;
            }

            if (codec.startsWith('hev1')) {
                return options.hevc ?? false;
            }

            if (codec.startsWith('av01')) {
                return options.av1 ?? false;
            }

            if (
                codec.startsWith('dvhe') ||
                codec.startsWith('dvav') ||
                codec.startsWith('dav1')
            ) {
                return options.dovi ?? false;
            }

            return false;
        }

        if (mimeType === 'video/webm') {
            return (
                codec.startsWith('vp08') ||
                codec.startsWith('vp09') ||
                codec.startsWith('av01')
            );
        }

        return false;
    };

    const getDeviceCapabilities = (): Record<string, boolean> => ({
        display_supported: true,
        is_hdr_supported: options.hdr ?? false
    });

    // @ts-expect-error cast is already defined globally, however since we're mocking it we need to redefine it.
    global.cast = {
        framework: {
            CastReceiverContext: {
                getInstance: (): unknown => ({
                    canDisplayType,
                    getDeviceCapabilities
                })
            },
            system: {
                DeviceCapabilities: {
                    DISPLAY_SUPPORTED: 'display_supported',
                    IS_HDR_SUPPORTED: 'is_hdr_supported'
                }
            }
        }
    };
};

const buildProfile = async (options: DeviceOptions): Promise<DeviceProfile> => {
    mockCastContext(options);

    // The module resolves the cast context on load, so it has to be re-imported
    // for every device we mock.
    vi.resetModules();

    const { getDeviceProfile } = await import('../deviceprofileBuilder');

    return getDeviceProfile(120000000);
};

const videoHlsProfiles = (profile: DeviceProfile): TranscodingProfile[] =>
    (profile.TranscodingProfiles ?? []).filter(
        (p) => p.Protocol === 'hls' && p.Type === 'Video'
    );

const codecsOf = (profile: TranscodingProfile): string[] =>
    (profile.AudioCodec ?? '').split(',').filter(Boolean);

// The ranges announced for a codec, one entry per codec profile that speaks
// about them at all. A codec split over several entries also carries one that
// only names the video profiles it supports, which says nothing about range.
const rangesFor = (profile: DeviceProfile, codec: string): string[][] =>
    (profile.CodecProfiles ?? [])
        .filter((p) => p.Type === 'Video' && p.Codec === codec)
        .map((p) =>
            (p.Conditions ?? []).find((c) => c.Property === 'VideoRangeType')
        )
        .filter((c) => c !== undefined)
        .map((c) => c.Value?.split('|') ?? []);

describe('HLS transcoding profiles', () => {
    let profile: DeviceProfile;

    beforeEach(async () => {
        profile = await buildProfile({ av1: true, hevc: true });
    });

    test('announces both an fMP4 and an MPEG-TS HLS video profile', () => {
        const containers = videoHlsProfiles(profile).map((p) => p.Container);

        // fMP4 must come first so the server prefers it.
        expect(containers).toEqual(['mp4', 'ts']);
    });

    test('never announces an audio codec its HLS container cannot carry', () => {
        for (const hlsProfile of videoHlsProfiles(profile)) {
            const forbidden =
                hlsProfile.Container === 'mp4'
                    ? NOT_PLAYABLE_IN_FMP4
                    : NOT_PLAYABLE_IN_TS;

            for (const codec of codecsOf(hlsProfile)) {
                expect(forbidden).not.toContain(codec);
            }
        }
    });

    test('every HLS profile can still carry audio and video', () => {
        for (const hlsProfile of videoHlsProfiles(profile)) {
            expect(codecsOf(hlsProfile).length).toBeGreaterThan(0);
            expect(hlsProfile.VideoCodec).toBeTruthy();
        }
    });

    test('only H.264 is muxed into MPEG-TS', () => {
        const tsProfile = videoHlsProfiles(profile).find(
            (p) => p.Container === 'ts'
        );

        expect(tsProfile?.VideoCodec).toBe('h264');
    });

    test('audio-only HLS uses the MPEG-TS codec list', () => {
        const audioHls = (profile.TranscodingProfiles ?? []).find(
            (p) => p.Protocol === 'hls' && p.Type === 'Audio'
        );

        expect(audioHls?.Container).toBe('ts');

        for (const codec of codecsOf(audioHls ?? {})) {
            expect(NOT_PLAYABLE_IN_TS).not.toContain(codec);
        }
    });

    test('sends BreakOnNonKeyFrames as a boolean for pre-12.0 servers', () => {
        // 10.10 and 10.11 deserialize this into a non-nullable bool, so it must
        // never be announced as null.
        for (const hlsProfile of videoHlsProfiles(profile)) {
            expect(hlsProfile.BreakOnNonKeyFrames).toBe(false);
        }
    });
});

describe('Dolby passthrough', () => {
    test('is offered in fMP4, but never in MPEG-TS', async () => {
        const profile = await buildProfile({
            ac3: true,
            eac3: true,
            hevc: true
        });

        const [fmp4, ts] = videoHlsProfiles(profile);

        expect(codecsOf(fmp4)).toEqual(['aac', 'eac3', 'ac3']);
        expect(codecsOf(ts)).toEqual(['aac', 'mp3']);
    });

    test('is absent when the setup cannot pass it through', async () => {
        const profile = await buildProfile({ hevc: true });

        for (const hlsProfile of videoHlsProfiles(profile)) {
            expect(codecsOf(hlsProfile)).not.toContain('ac3');
            expect(codecsOf(hlsProfile)).not.toContain('eac3');
        }
    });
});

describe('HEVC video ranges', () => {
    test('announces HDR10, HDR10+ and HLG when the setup supports HDR', async () => {
        const profile = await buildProfile({ hdr: true, hevc: true });
        const tenBitRanges = rangesFor(profile, 'hevc').filter((r) =>
            r.includes('HDR10')
        );

        // main 10 and high 10.
        expect(tenBitRanges.length).toBe(2);

        for (const ranges of tenBitRanges) {
            expect(ranges).toEqual(
                expect.arrayContaining(['SDR', 'HDR10', 'HDR10Plus', 'HLG'])
            );
        }
    });

    test('announces SDR only when the setup cannot show HDR', async () => {
        const profile = await buildProfile({ hevc: true });

        for (const ranges of rangesFor(profile, 'hevc')) {
            expect(ranges).toEqual(['SDR']);
        }
    });

    test('keeps Dolby Vision independent of the HDR capability', async () => {
        const profile = await buildProfile({ dovi: true, hevc: true });
        const doviRanges = rangesFor(profile, 'hevc').filter((r) =>
            r.includes('DOVI')
        );

        expect(doviRanges.length).toBe(2);

        for (const ranges of doviRanges) {
            expect(ranges).not.toContain('HDR10');
        }
    });
});

describe('direct play profiles', () => {
    test('does not claim Opus playback from an MP4 container', async () => {
        const profile = await buildProfile({ av1: true, hevc: true });
        const mp4Profiles = (profile.DirectPlayProfiles ?? []).filter((p) =>
            (p.Container ?? '').split(',').includes('mp4')
        );

        expect(mp4Profiles.length).toBeGreaterThan(0);

        for (const mp4Profile of mp4Profiles) {
            expect((mp4Profile.AudioCodec ?? '').split(',')).not.toContain(
                'opus'
            );
        }
    });
});

describe('video profile conditions', () => {
    // Capability order as the server ranks it, least capable first.
    const H264_RANK = [
        'constrained baseline',
        'baseline',
        'main',
        'high',
        'high 10'
    ];

    // The announced profiles, in the order the server reads them. A codec may
    // be split over several codec profiles when their other constraints
    // differ, so flatten them back into one list.
    const profilesFor = (profile: DeviceProfile, codec: string): string[] =>
        (profile.CodecProfiles ?? [])
            .filter((p) => p.Type === 'Video' && p.Codec === codec)
            .flatMap(
                (p) =>
                    (p.Conditions ?? [])
                        .find((c) => c.Property === 'VideoProfile')
                        ?.Value?.split('|') ?? []
            );

    // The server transcodes to the first profile it reads and treats it as the
    // ceiling for stream copy, so the most capable one has to lead. Getting
    // this backwards makes every transcode come back as baseline.
    test('announces H.264 profiles most capable first', async () => {
        const announced = profilesFor(await buildProfile({}), 'h264');
        const ranks = announced.map((p) => H264_RANK.indexOf(p));

        expect(announced).toContain('high');
        expect(ranks).not.toContain(-1);
        expect(ranks).toStrictEqual([...ranks].sort((a, b) => b - a));
    });

    // 'high' and 'high 10' name the tier rather than the profile, and the
    // server cannot rank them: leading with one makes it reject every HEVC
    // stream copy.
    test('leads H.265 with a profile the server can rank', async () => {
        const announced = profilesFor(
            await buildProfile({ hevc: true }),
            'hevc'
        );

        expect(['main', 'main 10']).toContain(announced[0]);
    });
});

describe('video codec profile evaluation', () => {
    // The codec these are checked against: it is the one a device announces
    // several profiles for, with constraints that differ between them.
    const CODEC = 'hevc';
    const LESS_THAN_EQUAL = 'LessThanEqual';

    interface VideoStream {
        bitDepth: number;
        codec: string;
        height: number;
        level: number;
        profile: string;
        rangeType: string;
        width: number;
    }

    const streamValues: Record<string, (stream: VideoStream) => unknown> = {
        Height: (s) => s.height,
        IsAnamorphic: () => false,
        VideoBitDepth: (s) => s.bitDepth,
        VideoLevel: (s) => s.level,
        VideoProfile: (s) => s.profile,
        VideoRangeType: (s) => s.rangeType,
        Width: (s) => s.width
    };

    const holds = (
        condition: ProfileCondition,
        stream: VideoStream
    ): boolean => {
        const read = streamValues[condition.Property ?? ''];

        if (!read) {
            throw new Error(`unhandled property ${condition.Property}`);
        }

        const actual = String(read(stream));
        const expected = condition.Value ?? '';

        switch (condition.Condition) {
            case 'Equals':
                return actual === expected;
            case 'EqualsAny':
                return expected.split('|').includes(actual);
            case 'GreaterThanEqual':
                return Number(actual) >= Number(expected);
            case 'LessThanEqual':
                return Number(actual) <= Number(expected);
            case 'NotEquals':
                return actual !== expected;
            default:
                throw new Error(`unhandled condition ${condition.Condition}`);
        }
    };

    // An entry takes effect only when all of its ApplyConditions hold, which is
    // what lets several entries for one codec each describe a different slice
    // of it without contradicting each other.
    const appliesTo = (entry: CodecProfile, stream: VideoStream): boolean =>
        (entry.ApplyConditions ?? []).every((c) => holds(c, stream));

    const entriesFor = (
        profile: DeviceProfile,
        codec: string
    ): CodecProfile[] =>
        (profile.CodecProfiles ?? []).filter(
            (p) => p.Type === 'Video' && p.Codec === codec
        );

    // How the server reads these announcements: every entry that takes effect
    // has to be satisfied in full before a stream is played untouched.
    const playsUntouched = (
        profile: DeviceProfile,
        stream: VideoStream
    ): boolean =>
        entriesFor(profile, stream.codec)
            .filter((p) => appliesTo(p, stream))
            .every((p) => (p.Conditions ?? []).every((c) => holds(c, stream)));

    // A stream sitting exactly on the ceiling announced for one video profile.
    // The constraints may be spread over several entries, so gather them from
    // each entry that a stream of this profile would bring into effect.
    const streamAnnouncedFor = (
        profile: DeviceProfile,
        codec: string,
        videoProfile: string
    ): VideoStream => {
        const unconstrained: VideoStream = {
            bitDepth: 0,
            codec,
            height: 0,
            level: 0,
            profile: videoProfile,
            rangeType: '',
            width: 0
        };
        const conditions = entriesFor(profile, codec)
            .filter((p) => appliesTo(p, unconstrained))
            .flatMap((p) => p.Conditions ?? []);
        const valueOf = (property: string, type: string): string =>
            conditions.find(
                (c) => c.Property === property && c.Condition === type
            )?.Value ?? '';
        const ceiling = (property: string): string =>
            valueOf(property, LESS_THAN_EQUAL);

        return {
            ...unconstrained,
            bitDepth: Number(ceiling('VideoBitDepth')),
            height: Number(ceiling('Height')),
            level: Number(ceiling('VideoLevel')),
            rangeType: valueOf('VideoRangeType', 'EqualsAny').split('|')[0],
            width: Number(ceiling('Width'))
        };
    };

    const announcedProfiles = (
        profile: DeviceProfile,
        codec: string
    ): string[] =>
        entriesFor(profile, codec)
            .flatMap((p) => [
                ...(p.ApplyConditions ?? []),
                ...(p.Conditions ?? [])
            ])
            .filter((c) => c.Property === 'VideoProfile')
            .flatMap((c) => (c.Value ?? '').split('|'))
            .filter((p, i, all) => all.indexOf(p) === i);

    // Splitting a codec across several entries is how differing constraints get
    // announced, but a stream only ever has one video profile. Announcing each
    // of them as a flat requirement makes the entries contradict one another,
    // and the codec can then never be played untouched at all.
    test('accepts a stream matching any profile it announced', async () => {
        const profile = await buildProfile({ hevc: true });
        const announced = announcedProfiles(profile, CODEC);

        expect(announced.length).toBeGreaterThan(1);

        for (const videoProfile of announced) {
            const stream = streamAnnouncedFor(profile, CODEC, videoProfile);

            expect({
                plays: playsUntouched(profile, stream),
                profile: videoProfile
            }).toStrictEqual({ plays: true, profile: videoProfile });
        }
    });

    test('rejects a stream whose profile it never announced', async () => {
        const profile = await buildProfile({ hevc: true });
        const announced = announcedProfiles(profile, CODEC)[0];

        expect(
            playsUntouched(profile, {
                ...streamAnnouncedFor(profile, CODEC, announced),
                profile: 'rext'
            })
        ).toBe(false);
    });
});
