import type {
    CodecProfile,
    ContainerProfile,
    DeviceProfile,
    DirectPlayProfile,
    ProfileCondition,
    SubtitleProfile,
    TranscodingProfile
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
    getMaxAudioChannels
} from './codecSupportHelper';

interface ProfileOptions {
    bitrateSetting: number;
}

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

    for (const audioFormat of supportedAudio) {
        if (audioFormat === 'mp3') {
            DirectPlayProfiles.push({
                AudioCodec: audioFormat,
                Container: audioFormat,
                Type: DlnaProfileType.Audio
            });
        } else if (audioFormat === 'webma') {
            DirectPlayProfiles.push({
                Container: 'webma,webm',
                Type: DlnaProfileType.Audio
            });
        } else {
            DirectPlayProfiles.push({
                Container: audioFormat,
                Type: DlnaProfileType.Audio
            });
        }

        // aac also appears in the m4a and m4b container
        if (audioFormat === 'aac') {
            DirectPlayProfiles.push({
                AudioCodec: audioFormat,
                Container: 'm4a,m4b',
                Type: DlnaProfileType.Audio
            });
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

    // If device is audio only, don't add all the video related stuff
    if (!hasVideoSupport()) {
        return codecProfiles;
    }

    const aacConditions: CodecProfile = {
        Codec: 'aac',
        Conditions: [
            createProfileCondition(
                ProfileConditionValue.AudioChannels,
                ProfileConditionType.LessThanEqual,
                '2'
            )
        ],
        Type: CodecType.VideoAudio
    };

    codecProfiles.push(aacConditions);

    for (const videoCodec of getSupportedVideoCodecs()) {
        const videoProfiles = getVideoProfileSupport(videoCodec);

        if (videoProfiles.length === 0) {
            continue;
        }

        const maxLevels: number[] = [];
        const maxBitDepths: number[] = [];
        const maxResolutions: Resolution[] = [];

        for (const videoProfile of videoProfiles) {
            const maxVideoLevel =
                getVideoCodecHighestLevelSupport(videoCodec, videoProfile) ?? 0;

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

            maxLevels.push(maxVideoLevel);
            maxBitDepths.push(maxBitDepth);
            maxResolutions.push(maxResolution);
        }

        // If all other constraints are equal, merge into one condition. This
        // is pretty common.
        if (
            maxLevels.every((l) => l === maxLevels[0]) &&
            maxBitDepths.every((b) => b === maxBitDepths[0]) &&
            maxResolutions.every((r) => r.equals(maxResolutions[0]))
        ) {
            const maxLevel = maxLevels[0];
            const maxBitDepth = maxBitDepths[0];
            const maxResolution = maxResolutions[0];

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
                const maxBitDepth = maxBitDepths[i];
                const maxResolution = maxResolutions[i];

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
    const audioChannels: number = getMaxAudioChannels();

    transcodingProfiles.push({
        AudioCodec: hlsAudioCodecs.join(','),
        BreakOnNonKeyFrames: false,
        Container: 'ts',
        Context: EncodingContext.Streaming,
        MaxAudioChannels: audioChannels.toString(),
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
            MaxAudioChannels: audioChannels.toString(),
            Protocol: 'http',
            Type: DlnaProfileType.Audio
        });
    }

    // If device is audio only, don't add all the video related stuff
    if (!hasVideoSupport()) {
        return transcodingProfiles;
    }

    const hlsVideoCodecs = getSupportedHLSVideoCodecs();

    if (hlsVideoCodecs.length && hlsAudioCodecs.length) {
        transcodingProfiles.push({
            AudioCodec: hlsAudioCodecs.join(','),
            BreakOnNonKeyFrames: false,
            Container: 'mp4',
            Context: EncodingContext.Streaming,
            MaxAudioChannels: audioChannels.toString(),
            MinSegments: 1,
            Protocol: 'hls',
            Type: DlnaProfileType.Video,
            VideoCodec: hlsVideoCodecs.map((codec) => codec as string).join(',')
        });
    }

    const webmAudioCodecs = getSupportedWebMAudioCodecs();
    const webmVideoCodecs = getSupportedWebMVideoCodecs();

    if (webmAudioCodecs.length > 0 && hlsVideoCodecs.length > 0) {
        transcodingProfiles.push({
            AudioCodec: webmAudioCodecs.join(','),
            Container: 'webm',
            Context: EncodingContext.Streaming,
            // If audio transcoding is needed, limit channels to number of physical audio channels
            // Trying to transcode to 5 channels when there are only 2 speakers generally does not sound good
            MaxAudioChannels: audioChannels.toString(),
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
 * @param options - Profile options
 * @returns Device profile.
 */
export function getDeviceProfile(options: ProfileOptions): DeviceProfile {
    // MaxStaticBitrate seems to be for offline sync only
    const profile: DeviceProfile = {
        MaxStaticBitrate: options.bitrateSetting,
        MaxStreamingBitrate: options.bitrateSetting,
        MusicStreamingTranscodingBitrate: Math.min(
            options.bitrateSetting,
            192000
        )
    };

    profile.DirectPlayProfiles = getDirectPlayProfiles();
    profile.TranscodingProfiles = getTranscodingProfiles();
    profile.ContainerProfiles = getContainerProfiles();
    profile.CodecProfiles = getCodecProfiles();
    profile.SubtitleProfiles = getSubtitleProfiles();

    return profile;
}
