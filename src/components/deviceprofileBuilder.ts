import { CodecProfile } from "../api/generated/models/codec-profile";
import { ContainerProfile } from "../api/generated/models/container-profile";
import { DeviceProfile } from "../api/generated/models/device-profile";
import { DirectPlayProfile } from "../api/generated/models/direct-play-profile";
import { DlnaProfileType } from "../api/generated/models/dlna-profile-type";
import { EncodingContext } from "../api/generated/models/encoding-context";
import { ProfileCondition } from "../api/generated/models/profile-condition";
import { ProfileConditionType } from "../api/generated/models/profile-condition-type";
import { ResponseProfile } from "../api/generated/models/response-profile";
import { SubtitleDeliveryMethod } from "../api/generated/models/subtitle-delivery-method";
import { SubtitleProfile } from "../api/generated/models/subtitle-profile";
import { TranscodingProfile } from "../api/generated/models/transcoding-profile";
import { CodecType } from "../api/generated/models/codec-type";
import {ProfileConditionValue} from "../api/generated/models/profile-condition-value";

import {
    deviceIds,
    getActiveDeviceId
} from "./castDevices";

import {
    hasTextTrackSupport,
    hasVP8Support,
    hasVP9Support,
    getMaxBitrateSupport,
    getMaxWidthSupport,
    getH26xProfileSupport,
    getH26xLevelSupport,
    getSupportedVPXVideoCodecs,
    getSupportedMP4VideoCodecs,
    getSupportedMP4AudioCodecs,
    getSupportedHLSVideoCodecs,
    getSupportedHLSAudioCodecs,
    getSupportedWebMAudioCodecs,
    getSupportedAudioCodecs
} from "./codecsupporthelper";

interface ProfileOptions {
    audioChannels?: number,
    enableHls?: boolean,
    bitrateSetting?: number
}

let profileOptions: ProfileOptions;
let currentDeviceId: number;

/**
 * @param Property What property the condition should test.
 * @param Condition The condition to test the values for.
 * @param Value The value to compare against.
 * @param [IsRequired=false]
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
        Property,
        Value,
        IsRequired
    };
}

/**
 * @returns Container profiles.
 */
function getContainerProfiles(): Array<ContainerProfile> {
    return [];
}

/**
 * @returns Response profiles.
 */
function getResponseProfiles(): Array<ResponseProfile> {
    // This seems related to DLNA, it might not be needed?
    return [{
        Type: DlnaProfileType.Video,
        Container: "m4v",
        MimeType: "video/mp4"
    }];
}

/**
 * @returns Direct play profiles.
 */
function getDirectPlayProfiles(): Array<DirectPlayProfile> {
    const DirectPlayProfiles: Array<DirectPlayProfile> = [];

    if (currentDeviceId !== deviceIds.AUDIO) {
        const mp4VideoCodecs = getSupportedMP4VideoCodecs();
        const mp4AudioCodecs = getSupportedMP4AudioCodecs();
        const vpxVideoCodecs = getSupportedVPXVideoCodecs();
        const webmAudioCodecs = getSupportedWebMAudioCodecs();

        for (const codec of vpxVideoCodecs) {
            DirectPlayProfiles.push({
                Container: "webm",
                Type: DlnaProfileType.Video,
                AudioCodec: webmAudioCodecs.join(","),
                VideoCodec: codec
            });
        }

        DirectPlayProfiles.push({
            Container: "mp4,m4v",
            Type: DlnaProfileType.Video,
            VideoCodec: mp4VideoCodecs.join(","),
            AudioCodec: mp4AudioCodecs.join(",")
        });
    }

    const supportedAudio = getSupportedAudioCodecs();

    for (const audioFormat of supportedAudio) {
        if (audioFormat === "mp3") {
            DirectPlayProfiles.push({
                Container: audioFormat,
                Type: DlnaProfileType.Audio,
                AudioCodec: audioFormat
            });
        } else if (audioFormat === "webma") {
            DirectPlayProfiles.push({
                Container: "webma,webm",
                Type: DlnaProfileType.Audio
            });
        } else {
            DirectPlayProfiles.push({
                Container: audioFormat,
                Type: DlnaProfileType.Audio
            });
        }

        // aac also appears in the m4a and m4b container
        if (audioFormat === "aac") {
            DirectPlayProfiles.push({
                Container: "m4a,m4b",
                AudioCodec: audioFormat,
                Type: DlnaProfileType.Audio
            });
        }
    }

    return DirectPlayProfiles;
}

/**
 * @returns Codec profiles.
 */
function getCodecProfiles(): Array<CodecProfile> {
    const CodecProfiles: Array<CodecProfile> = [];

    const audioConditions: CodecProfile = {
        Type: CodecType.Audio,
        Codec: "flac",
        Conditions: [
            createProfileCondition(
                ProfileConditionValue.AudioSampleRate,
                ProfileConditionType.LessThanEqual,
                "96000"
            ),
            createProfileCondition(
                ProfileConditionValue.AudioBitDepth,
                ProfileConditionType.LessThanEqual,
                "24"
            )
        ]
    };

    CodecProfiles.push(audioConditions);

    // If device is audio only, don't add all the video related stuff
    if (currentDeviceId == deviceIds.AUDIO) {
        return CodecProfiles;
    }

    const aacConditions: CodecProfile = {
        Type: CodecType.VideoAudio,
        Codec: "aac",
        Conditions: [
            // Not sure what secondary audio means in this context. Multiple audio tracks?
            createProfileCondition(
                ProfileConditionValue.IsSecondaryAudio,
                ProfileConditionType.Equals,
                "false"
            ),
            createProfileCondition(
                ProfileConditionValue.IsSecondaryAudio,
                ProfileConditionType.LessThanEqual,
                "2"
            )
        ]
    };

    CodecProfiles.push(aacConditions);

    const maxWidth: number = getMaxWidthSupport(currentDeviceId);
    const h26xLevel: number = getH26xLevelSupport(currentDeviceId);
    const h26xProfile: string = getH26xProfileSupport(currentDeviceId);

    const h26xConditions: CodecProfile = {
        Type: CodecType.Video,
        Codec: "h264",
        Conditions: [
            createProfileCondition(
                ProfileConditionValue.IsAnamorphic,
                ProfileConditionType.NotEquals,
                "true"
            ),
            createProfileCondition(
                ProfileConditionValue.VideoProfile,
                ProfileConditionType.EqualsAny,
                h26xProfile
            ),
            createProfileCondition(
                ProfileConditionValue.VideoLevel,
                ProfileConditionType.LessThanEqual,
                h26xLevel.toString()
            ),
            createProfileCondition(
                ProfileConditionValue.Width,
                ProfileConditionType.LessThanEqual,
                maxWidth.toString(),
                true
            )
        ]
    };

    CodecProfiles.push(h26xConditions);

    const videoConditions: CodecProfile = {
        Type: CodecType.Video,
        Conditions: [
            createProfileCondition(
                ProfileConditionValue.Width,
                ProfileConditionType.LessThanEqual,
                maxWidth.toString(),
                true
            )
        ]
    };

    CodecProfiles.push(videoConditions);

    const videoAudioConditions: CodecProfile = {
        Type: CodecType.VideoAudio,
        Conditions: [
            createProfileCondition(
                ProfileConditionValue.IsSecondaryAudio,
                ProfileConditionType.Equals,
                "false"
            )
        ]
    };

    CodecProfiles.push(videoAudioConditions);

    return CodecProfiles;
}

/**
 * @returns Transcoding profiles.
 */
function getTranscodingProfiles(): Array<TranscodingProfile> {
    const TranscodingProfiles: Array<TranscodingProfile> = [];

    const physicalAudioChannels: number = profileOptions.audioChannels ? 6 : 2;

    if (profileOptions.enableHls !== false) {
        TranscodingProfiles.push({
            Container: "ts",
            Type: DlnaProfileType.Audio,
            AudioCodec: "aac",
            Context: EncodingContext.Streaming,
            Protocol: "hls",
            MaxAudioChannels: physicalAudioChannels.toString(),
            MinSegments: 1,
            BreakOnNonKeyFrames: false
        });
    }

    const supportedAudio = getSupportedAudioCodecs();

    for (const audioFormat of supportedAudio) {
        TranscodingProfiles.push({
            Container: audioFormat,
            Type: DlnaProfileType.Audio,
            AudioCodec: audioFormat,
            Context: EncodingContext.Streaming,
            Protocol: "http",
            MaxAudioChannels: physicalAudioChannels.toString()
        });
    }

    // If device is audio only, don't add all the video related stuff
    if (currentDeviceId == deviceIds.AUDIO) {
        return TranscodingProfiles;
    }

    const hlsVideoAudioCodecs = getSupportedHLSAudioCodecs();
    const hlsVideoCodecs = getSupportedHLSVideoCodecs();
    if (hlsVideoCodecs.length &&
        hlsVideoAudioCodecs.length &&
            profileOptions.enableHls !== false) {
        TranscodingProfiles.push({
            Container: "ts",
            Type: DlnaProfileType.Video,
            AudioCodec: hlsVideoAudioCodecs.join(","),
            VideoCodec: hlsVideoCodecs.join(","),
            Context: EncodingContext.Streaming,
            Protocol: "hls",
            MaxAudioChannels: physicalAudioChannels.toString(),
            MinSegments: 1,
            BreakOnNonKeyFrames: false
        });
    }

    if (hasVP8Support() || hasVP9Support()) {
        TranscodingProfiles.push({
            Container: "webm",
            Type: DlnaProfileType.Video,
            AudioCodec: "vorbis",
            VideoCodec: "vpx",
            Context: EncodingContext.Streaming,
            Protocol: "http",
            // If audio transcoding is needed, limit channels to number of physical audio channels
            // Trying to transcode to 5 channels when there are only 2 speakers generally does not sound good
            MaxAudioChannels: physicalAudioChannels.toString()
        });
    }

    return TranscodingProfiles;
}

/**
 * @returns Subtitle profiles.
 */
function getSubtitleProfiles(): Array<SubtitleProfile> {
    const subProfiles: Array<SubtitleProfile> = [];

    if (hasTextTrackSupport(currentDeviceId)) {
        subProfiles.push({
            Format: "vtt",
            Method: SubtitleDeliveryMethod.External
        });

        subProfiles.push({
            Format: "vtt",
            Method: SubtitleDeliveryMethod.Hls
        });
    }

    return subProfiles;
}

/**
 * Creates a device profile containing supported codecs for the active Cast device.
 * @param Profile options
 * @returns Device profile.
 */
export function getDeviceProfile(options: ProfileOptions = {}): DeviceProfile {
    profileOptions = options;
    currentDeviceId = getActiveDeviceId();

    const bitrateSetting = options.bitrateSetting || getMaxBitrateSupport();

    // MaxStaticBitrate seems to be for offline sync only
    const profile: DeviceProfile = {
        MaxStreamingBitrate: bitrateSetting,
        MaxStaticBitrate: 0,
        MusicStreamingTranscodingBitrate: Math.min(bitrateSetting, 192000)
    };

    profile.DirectPlayProfiles = getDirectPlayProfiles();
    profile.TranscodingProfiles = getTranscodingProfiles();
    profile.ContainerProfiles = getContainerProfiles();
    profile.CodecProfiles = getCodecProfiles();
    profile.SubtitleProfiles = getSubtitleProfiles();
    profile.ResponseProfiles = getResponseProfiles();

    return profile;
}

export default getDeviceProfile;
