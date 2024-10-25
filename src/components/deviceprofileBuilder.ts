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
import { DeviceIds, getActiveDeviceId } from './castDevices';
import {
    hasSurroundSupport,
    hasTextTrackSupport,
    hasVP8Support,
    hasVP9Support,
    getMaxWidthSupport,
    getH264ProfileSupport,
    getH264LevelSupport,
    getH265ProfileSupport,
    getH265LevelSupport,
    getSupportedVPXVideoCodecs,
    getSupportedMP4VideoCodecs,
    getSupportedMP4AudioCodecs,
    getSupportedHLSVideoCodecs,
    getSupportedHLSAudioCodecs,
    getSupportedWebMAudioCodecs,
    getSupportedAudioCodecs
} from './codecSupportHelper';

interface ProfileOptions {
    enableHls: boolean;
    bitrateSetting: number;
}

let profileOptions: ProfileOptions;
let currentDeviceId: DeviceIds;

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
function getContainerProfiles(): Array<ContainerProfile> {
    return [];
}

/**
 * Get direct play profiles
 * @returns Direct play profiles.
 */
function getDirectPlayProfiles(): Array<DirectPlayProfile> {
    const DirectPlayProfiles: Array<DirectPlayProfile> = [];

    if (currentDeviceId !== DeviceIds.AUDIO) {
        const mp4VideoCodecs = getSupportedMP4VideoCodecs();
        const mp4AudioCodecs = getSupportedMP4AudioCodecs();
        const vpxVideoCodecs = getSupportedVPXVideoCodecs();
        const webmAudioCodecs = getSupportedWebMAudioCodecs();

        for (const codec of vpxVideoCodecs) {
            DirectPlayProfiles.push({
                AudioCodec: webmAudioCodecs.join(','),
                Container: 'webm',
                Type: DlnaProfileType.Video,
                VideoCodec: codec
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
function getCodecProfiles(): Array<CodecProfile> {
    const CodecProfiles: Array<CodecProfile> = [];

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

    CodecProfiles.push(audioConditions);

    // If device is audio only, don't add all the video related stuff
    if (currentDeviceId == DeviceIds.AUDIO) {
        return CodecProfiles;
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

    CodecProfiles.push(aacConditions);

    const maxWidth: number = getMaxWidthSupport(currentDeviceId);
    const h264Level: number = getH264LevelSupport(currentDeviceId);
    const h264Profile: string = getH264ProfileSupport(currentDeviceId);

    const h264Conditions: CodecProfile = {
        Codec: 'h264',
        Conditions: [
            createProfileCondition(
                ProfileConditionValue.IsAnamorphic,
                ProfileConditionType.NotEquals,
                'true'
            ),
            createProfileCondition(
                ProfileConditionValue.VideoProfile,
                ProfileConditionType.EqualsAny,
                h264Profile
            ),
            createProfileCondition(
                ProfileConditionValue.VideoLevel,
                ProfileConditionType.LessThanEqual,
                h264Level.toString()
            ),
            createProfileCondition(
                ProfileConditionValue.Width,
                ProfileConditionType.LessThanEqual,
                getMaxWidthSupport(currentDeviceId, 'h264').toString(),
                true
            )
        ],
        Type: CodecType.Video
    };

    CodecProfiles.push(h264Conditions);

    const h265Level: number = getH265LevelSupport(currentDeviceId);
    const h265Profile: string = getH265ProfileSupport(currentDeviceId);

    const h265Conditions: CodecProfile = {
        Codec: 'h265',
        Conditions: [
            createProfileCondition(
                ProfileConditionValue.IsAnamorphic,
                ProfileConditionType.NotEquals,
                'true'
            ),
            createProfileCondition(
                ProfileConditionValue.VideoProfile,
                ProfileConditionType.EqualsAny,
                h265Profile
            ),
            createProfileCondition(
                ProfileConditionValue.VideoLevel,
                ProfileConditionType.LessThanEqual,
                h265Level.toString()
            ),
            createProfileCondition(
                ProfileConditionValue.Width,
                ProfileConditionType.LessThanEqual,
                maxWidth.toString(),
                true
            )
        ],
        Type: CodecType.Video
    };

    CodecProfiles.push(h265Conditions);

    // the following are codec independent conditions so hold for all codecs
    const videoConditions: CodecProfile = {
        Conditions: [
            createProfileCondition(
                ProfileConditionValue.Width,
                ProfileConditionType.LessThanEqual,
                getMaxWidthSupport(currentDeviceId).toString(),
                true
            )
        ],
        Type: CodecType.Video
    };

    CodecProfiles.push(videoConditions);

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

    CodecProfiles.push(videoAudioConditions);

    return CodecProfiles;
}

/**
 * Get transcoding profiles
 * @returns Transcoding profiles.
 */
function getTranscodingProfiles(): Array<TranscodingProfile> {
    const TranscodingProfiles: Array<TranscodingProfile> = [];

    const hlsAudioCodecs = getSupportedHLSAudioCodecs();
    const audioChannels: number = hasSurroundSupport() ? 6 : 2;

    if (profileOptions.enableHls !== false) {
        TranscodingProfiles.push({
            AudioCodec: hlsAudioCodecs.join(','),
            BreakOnNonKeyFrames: false,
            Container: 'ts',
            Context: EncodingContext.Streaming,
            MaxAudioChannels: audioChannels.toString(),
            MinSegments: 1,
            Protocol: 'hls',
            Type: DlnaProfileType.Audio
        });
    }

    const supportedAudio = getSupportedAudioCodecs();

    // audio only profiles here
    for (const audioFormat of supportedAudio) {
        TranscodingProfiles.push({
            AudioCodec: audioFormat,
            Container: audioFormat,
            Context: EncodingContext.Streaming,
            MaxAudioChannels: audioChannels.toString(),
            Protocol: 'http',
            Type: DlnaProfileType.Audio
        });
    }

    // If device is audio only, don't add all the video related stuff
    if (currentDeviceId == DeviceIds.AUDIO) {
        return TranscodingProfiles;
    }

    const hlsVideoCodecs = getSupportedHLSVideoCodecs();

    if (
        hlsVideoCodecs.length &&
        hlsAudioCodecs.length &&
        profileOptions.enableHls !== false
    ) {
        TranscodingProfiles.push({
            AudioCodec: hlsAudioCodecs.join(','),
            BreakOnNonKeyFrames: false,
            Container: 'ts',
            Context: EncodingContext.Streaming,
            MaxAudioChannels: audioChannels.toString(),
            MinSegments: 1,
            Protocol: 'hls',
            Type: DlnaProfileType.Video,
            VideoCodec: hlsVideoCodecs.join(',')
        });
    }

    if (hasVP8Support() || hasVP9Support()) {
        TranscodingProfiles.push({
            AudioCodec: 'vorbis',
            Container: 'webm',
            Context: EncodingContext.Streaming,
            // If audio transcoding is needed, limit channels to number of physical audio channels
            // Trying to transcode to 5 channels when there are only 2 speakers generally does not sound good
            MaxAudioChannels: audioChannels.toString(),
            Protocol: 'http',
            Type: DlnaProfileType.Video,
            VideoCodec: 'vpx'
        });
    }

    return TranscodingProfiles;
}

/**
 * Get subtitle profiles
 * @returns Subtitle profiles.
 */
function getSubtitleProfiles(): Array<SubtitleProfile> {
    const subProfiles: Array<SubtitleProfile> = [];

    if (hasTextTrackSupport(currentDeviceId)) {
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
    profileOptions = options;
    currentDeviceId = getActiveDeviceId();

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

export default getDeviceProfile;
