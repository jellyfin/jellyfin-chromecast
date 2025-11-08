import {
    VideoRangeType,
    type CodecProfile,
    type ContainerProfile,
    type DeviceProfile,
    type DirectPlayProfile,
    type ProfileCondition,
    type SubtitleProfile,
    type TranscodingProfile
} from '@jellyfin/sdk/lib/generated-client';
import { CodecType } from '@jellyfin/sdk/lib/generated-client/models/codec-type';
import { DlnaProfileType } from '@jellyfin/sdk/lib/generated-client/models/dlna-profile-type';
import { EncodingContext } from '@jellyfin/sdk/lib/generated-client/models/encoding-context';
import { ProfileConditionType } from '@jellyfin/sdk/lib/generated-client/models/profile-condition-type';
import { ProfileConditionValue } from '@jellyfin/sdk/lib/generated-client/models/profile-condition-value';
import { SubtitleDeliveryMethod } from '@jellyfin/sdk/lib/generated-client/models/subtitle-delivery-method';
import {
    hasTextTrackSupport,
    getSupportedWebMVideoCodecs,
    getSupportedMP4VideoCodecs,
    getSupportedMP4AudioCodecs,
    getSupportedHLSVideoCodecs,
    getSupportedHLSAudioCodecs,
    getSupportedWebMAudioCodecs,
    getSupportedAudioCodecs,
    hasVideoSupport,
    getSupportedVideoCodecs,
    getVideoProfileSupport,
    getVideoCodecHighestLevelSupport,
    getVideoCodecHighestBitDepthSupport,
    type Resolution,
    getMaxResolutionSupported,
    getVideoCodecMinimumBitDepth,
    getVideoRangeSupport
} from './codecSupportHelper';

/**
 * Create and return a new ProfileCondition
 * @param Property - What property the condition should test.
 * @param Condition - The condition to test the values for.
 * @param Value - The value to compare against.
 * @param [IsRequired] - Don't permit unknown values
 * @returns A profile condition created from the parameters.
 */
function createProfileCondition(
    Property: ProfileConditionValue,
    Condition: ProfileConditionType,
    Value: string,
    IsRequired = false
): ProfileCondition {
    return {
        Condition,
        IsRequired,
        Property,
        Value
    };
}

/**
 * Get container profiles
 * @todo Why does this always return an empty array?
 * @returns Container profiles.
 */
function getContainerProfiles(): ContainerProfile[] {
    return [];
}

/**
 * Get direct play profiles
 * @returns Direct play profiles.
 */
function getDirectPlayProfiles(): DirectPlayProfile[] {
    const DirectPlayProfiles: DirectPlayProfile[] = [];

    if (hasVideoSupport()) {
        const mp4VideoCodecs = getSupportedMP4VideoCodecs();
        const mp4AudioCodecs = getSupportedMP4AudioCodecs();
        const webmVideoCodecs = getSupportedWebMVideoCodecs();
        const webmAudioCodecs = getSupportedWebMAudioCodecs();

        for (const codec of webmVideoCodecs) {
            DirectPlayProfiles.push({
                AudioCodec: webmAudioCodecs.join(','),
                Container: 'webm',
                Type: DlnaProfileType.Video,
                VideoCodec: codec as string
            });
        }

        DirectPlayProfiles.push({
            AudioCodec: mp4AudioCodecs.join(','),
            Container: 'mp4,m4v',
            Type: DlnaProfileType.Video,
            VideoCodec: mp4VideoCodecs.join(',')
        });
    }

    const supportedAudio = getSupportedAudioCodecs();

    // N.B. Supported audio formats and containers can be found here:
    // https://developers.google.com/cast/docs/media#mp4_audio_only
    for (const audioFormat of supportedAudio) {
        switch (audioFormat.toLowerCase()) {
            case 'mp3':
                DirectPlayProfiles.push({
                    AudioCodec: audioFormat,
                    Container: 'mp3,mp4',
                    Type: DlnaProfileType.Audio
                });
                break;
            case 'opus':
            case 'vorbis':
                DirectPlayProfiles.push({
                    AudioCodec: audioFormat,
                    Container: 'ogg,webm',
                    Type: DlnaProfileType.Audio
                });
                break;
            case 'aac':
                DirectPlayProfiles.push({
                    AudioCodec: audioFormat,
                    Container: 'm4a',
                    Type: DlnaProfileType.Audio
                });
                break;
            case 'flac':
            case 'wav':
            default:
                DirectPlayProfiles.push({
                    AudioCodec: audioFormat,
                    Container: audioFormat,
                    Type: DlnaProfileType.Audio
                });
                break;
        }
    }

    return DirectPlayProfiles;
}

/**
 * Get codec profiles
 * @returns Codec profiles.
 */
function getCodecProfiles(): CodecProfile[] {
    const codecProfiles: CodecProfile[] = [];
    const deviceHasVideo = hasVideoSupport();

    const audioConditions: CodecProfile = {
        Codec: 'flac',
        Conditions: [
            createProfileCondition(
                ProfileConditionValue.AudioSampleRate,
                ProfileConditionType.LessThanEqual,
                '96000'
            ),
            createProfileCondition(
                ProfileConditionValue.AudioBitDepth,
                ProfileConditionType.LessThanEqual,
                '24'
            )
        ],
        Type: CodecType.Audio
    };

    codecProfiles.push(audioConditions);

    // Google Cast does not support AAC 5.1, as officially stated by the Google team.
    // Additionally, the Cast SDK seems to silently downmix anything that isn't Opus or Dolby codecs
    // to stereo.
    //
    // Let the server decide how to handle the downmixing vs. transcoding trade-off instead by
    // transmitting these limitations.
    //
    // See: https://issuetracker.google.com/issues/69112577#comment20
    // See: https://issuetracker.google.com/issues/330548743
    for (const audioCodec of getSupportedAudioCodecs()) {
        switch (audioCodec) {
            case 'opus':
            case 'eac3':
            case 'ac3':
                continue;
        }

        const profileConditions: ProfileCondition[] = [
            createProfileCondition(
                ProfileConditionValue.AudioChannels,
                ProfileConditionType.LessThanEqual,
                '2'
            )
        ];

        codecProfiles.push({
            Codec: audioCodec,
            Conditions: profileConditions,
            Type: CodecType.Audio
        });

        if (deviceHasVideo) {
            codecProfiles.push({
                Codec: audioCodec,
                Conditions: profileConditions,
                Type: CodecType.VideoAudio
            });
        }
    }

    // If device is audio only, don't add all the video related stuff
    if (!deviceHasVideo) {
        return codecProfiles;
    }

    for (const videoCodec of getSupportedVideoCodecs()) {
        const videoProfiles = getVideoProfileSupport(videoCodec);

        if (videoProfiles.length === 0) {
            continue;
        }

        const maxLevels: number[] = [];
        const minBitDepths: number[] = [];
        const maxBitDepths: number[] = [];
        const maxResolutions: Resolution[] = [];
        const videoRangeSets: Set<VideoRangeType>[] = [];

        for (const videoProfile of videoProfiles) {
            const maxVideoLevel =
                getVideoCodecHighestLevelSupport(videoCodec, videoProfile) ?? 0;

            const minBitDepth = getVideoCodecMinimumBitDepth(
                videoCodec,
                videoProfile
            );

            const maxBitDepth =
                getVideoCodecHighestBitDepthSupport(
                    videoCodec,
                    videoProfile,
                    maxVideoLevel
                ) ?? 0;

            const maxResolution = getMaxResolutionSupported(
                videoCodec,
                videoProfile,
                maxVideoLevel,
                maxBitDepth
            );

            const videoRangeSupport = getVideoRangeSupport(
                videoCodec,
                videoProfile,
                maxVideoLevel
            );

            maxLevels.push(maxVideoLevel);
            minBitDepths.push(minBitDepth);
            maxBitDepths.push(maxBitDepth);
            maxResolutions.push(maxResolution);
            videoRangeSets.push(videoRangeSupport);
        }

        // If all other constraints are equal, merge into one condition. This
        // is pretty common.
        if (
            maxLevels.every((l) => l === maxLevels[0]) &&
            minBitDepths.every((b) => b === minBitDepths[0]) &&
            maxBitDepths.every((b) => b === maxBitDepths[0]) &&
            maxResolutions.every((r) => r.equals(maxResolutions[0])) &&
            videoRangeSets.every(
                (r) =>
                    r.size === videoRangeSets[0].size &&
                    [...r].every((v) => videoRangeSets[0].has(v))
            )
        ) {
            const maxLevel = maxLevels[0];
            const minBitDepth = minBitDepths[0];
            const maxBitDepth = maxBitDepths[0];
            const maxResolution = maxResolutions[0];
            const videoRanges = videoRangeSets[0];

            const profileConditions = [
                createProfileCondition(
                    ProfileConditionValue.IsAnamorphic,
                    ProfileConditionType.NotEquals,
                    'true'
                ),
                createProfileCondition(
                    ProfileConditionValue.VideoProfile,
                    ProfileConditionType.EqualsAny,
                    videoProfiles.join('|')
                ),
                createProfileCondition(
                    ProfileConditionValue.VideoLevel,
                    ProfileConditionType.LessThanEqual,
                    maxLevel.toString()
                ),
                createProfileCondition(
                    ProfileConditionValue.VideoBitDepth,
                    ProfileConditionType.GreaterThanEqual,
                    minBitDepth.toString()
                ),
                createProfileCondition(
                    ProfileConditionValue.VideoBitDepth,
                    ProfileConditionType.LessThanEqual,
                    maxBitDepth.toString()
                ),
                createProfileCondition(
                    ProfileConditionValue.Width,
                    ProfileConditionType.LessThanEqual,
                    maxResolution.width.toString()
                ),
                createProfileCondition(
                    ProfileConditionValue.Height,
                    ProfileConditionType.LessThanEqual,
                    maxResolution.height.toString()
                ),
                createProfileCondition(
                    ProfileConditionValue.VideoRangeType,
                    ProfileConditionType.EqualsAny,
                    [...videoRanges].join('|')
                )
            ];

            codecProfiles.push({
                Codec: videoCodec,
                Conditions: profileConditions,
                Type: CodecType.Video
            });
        } else {
            // Different profiles of the same codec have different video profile
            // constraints. Create a new codec profile for each.

            for (let i = 0; i < videoProfiles.length; i++) {
                const videoProfile = videoProfiles[i];
                const maxLevel = maxLevels[i];
                const minBitDepth = minBitDepths[i];
                const maxBitDepth = maxBitDepths[i];
                const maxResolution = maxResolutions[i];
                const videoRanges = videoRangeSets[i];

                const profileConditions = [
                    createProfileCondition(
                        ProfileConditionValue.IsAnamorphic,
                        ProfileConditionType.NotEquals,
                        'true'
                    ),
                    createProfileCondition(
                        ProfileConditionValue.VideoProfile,
                        ProfileConditionType.Equals,
                        videoProfile
                    ),
                    createProfileCondition(
                        ProfileConditionValue.VideoLevel,
                        ProfileConditionType.LessThanEqual,
                        maxLevel.toString()
                    ),
                    createProfileCondition(
                        ProfileConditionValue.VideoBitDepth,
                        ProfileConditionType.GreaterThanEqual,
                        minBitDepth.toString()
                    ),
                    createProfileCondition(
                        ProfileConditionValue.VideoBitDepth,
                        ProfileConditionType.LessThanEqual,
                        maxBitDepth.toString()
                    ),
                    createProfileCondition(
                        ProfileConditionValue.Width,
                        ProfileConditionType.LessThanEqual,
                        maxResolution.width.toString()
                    ),
                    createProfileCondition(
                        ProfileConditionValue.Height,
                        ProfileConditionType.LessThanEqual,
                        maxResolution.height.toString()
                    ),
                    createProfileCondition(
                        ProfileConditionValue.VideoRangeType,
                        ProfileConditionType.EqualsAny,
                        [...videoRanges].join('|')
                    )
                ];

                codecProfiles.push({
                    Codec: videoCodec,
                    Conditions: profileConditions,
                    Type: CodecType.Video
                });
            }
        }
    }

    const videoAudioConditions: CodecProfile = {
        Conditions: [
            // Apparently something like an audiotrack from a second source, not in the current mediasource.
            // Input from multiple sources is not supported, so this feature is not allowed.
            createProfileCondition(
                ProfileConditionValue.IsSecondaryAudio,
                ProfileConditionType.Equals,
                'false'
            )
        ],
        Type: CodecType.VideoAudio
    };

    codecProfiles.push(videoAudioConditions);

    return codecProfiles;
}

/**
 * Get transcoding profiles
 * @returns Transcoding profiles.
 */
function getTranscodingProfiles(): TranscodingProfile[] {
    const transcodingProfiles: TranscodingProfile[] = [];

    const hlsAudioCodecs = getSupportedHLSAudioCodecs();

    transcodingProfiles.push({
        AudioCodec: hlsAudioCodecs.join(','),
        BreakOnNonKeyFrames: false,
        Container: 'ts',
        Context: EncodingContext.Streaming,
        MinSegments: 1,
        Protocol: 'hls',
        Type: DlnaProfileType.Audio
    });

    const supportedAudio = getSupportedAudioCodecs();

    // audio only profiles here
    for (const audioFormat of supportedAudio) {
        transcodingProfiles.push({
            AudioCodec: audioFormat,
            Container: audioFormat,
            Context: EncodingContext.Streaming,
            Protocol: 'http',
            Type: DlnaProfileType.Audio
        });
    }

    // If device is audio only, don't add all the video related stuff
    if (!hasVideoSupport()) {
        return transcodingProfiles;
    }

    const hlsVideoCodecs = getSupportedHLSVideoCodecs();

    if (hlsVideoCodecs.length > 0 && hlsAudioCodecs.length > 0) {
        transcodingProfiles.push({
            AudioCodec: hlsAudioCodecs.join(','),
            BreakOnNonKeyFrames: false,
            Container: 'mp4',
            Context: EncodingContext.Streaming,
            MinSegments: 1,
            Protocol: 'hls',
            Type: DlnaProfileType.Video,
            VideoCodec: hlsVideoCodecs.map((codec) => codec as string).join(',')
        });

        // Currently, if there are any HLS codecs, stop early. This mimics the web client's
        // behavior and works around a bug where the server may pick other single-codec containers
        // because the audio codec needs less transcoding.
        //
        // In reality, we're only really losing out on the VPx codecs, which have middling compute
        // to efficiency ratios anyways.
        return transcodingProfiles;
    }

    const mp4VideoCodecs = getSupportedMP4VideoCodecs();
    const mp4AudioCodecs = getSupportedMP4AudioCodecs();

    if (mp4AudioCodecs.length > 0 && mp4VideoCodecs.length > 0) {
        transcodingProfiles.push({
            AudioCodec: mp4AudioCodecs.join(','),
            Container: 'mp4',
            Context: EncodingContext.Streaming,
            MinSegments: 1,
            Protocol: 'http',
            Type: DlnaProfileType.Video,
            VideoCodec: mp4VideoCodecs.join(',')
        });
    }

    const webmAudioCodecs = getSupportedWebMAudioCodecs();
    const webmVideoCodecs = getSupportedWebMVideoCodecs();

    if (webmAudioCodecs.length > 0 && hlsVideoCodecs.length > 0) {
        transcodingProfiles.push({
            AudioCodec: webmAudioCodecs.join(','),
            Container: 'webm',
            Context: EncodingContext.Streaming,
            Protocol: 'http',
            Type: DlnaProfileType.Video,
            VideoCodec: webmVideoCodecs.join(',')
        });
    }

    return transcodingProfiles;
}

/**
 * Get subtitle profiles
 * @returns Subtitle profiles.
 */
function getSubtitleProfiles(): SubtitleProfile[] {
    const subProfiles: SubtitleProfile[] = [];

    if (hasTextTrackSupport()) {
        subProfiles.push({
            Format: 'vtt',
            Method: SubtitleDeliveryMethod.External
        });

        subProfiles.push({
            Format: 'vtt',
            Method: SubtitleDeliveryMethod.Hls
        });
    }

    return subProfiles;
}

/**
 * Creates a device profile containing supported codecs for the active Cast device.
 * @param maxBitrate - maximum bitrate to be used by the server when streaming data
 * @returns Device profile.
 */
export function getDeviceProfile(maxBitrate: number): DeviceProfile {
    // MaxStaticBitrate seems to be for offline sync only
    const profile: DeviceProfile = {
        MaxStaticBitrate: maxBitrate,
        MaxStreamingBitrate: maxBitrate,
        MusicStreamingTranscodingBitrate: Math.min(maxBitrate, 192000)
    };

    profile.DirectPlayProfiles = getDirectPlayProfiles();
    profile.TranscodingProfiles = getTranscodingProfiles();
    profile.ContainerProfiles = getContainerProfiles();
    profile.CodecProfiles = getCodecProfiles();
    profile.SubtitleProfiles = getSubtitleProfiles();

    return profile;
}
