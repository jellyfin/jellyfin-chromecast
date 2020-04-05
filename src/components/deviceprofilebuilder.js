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

let profileOptions;
let currentDeviceId;

/**
 * @param {string} Property What property the condition should test.
 * @param {string} Condition The condition to test the values for.
 * @param {(string|number)} Value The value to compare against.
 * @param {boolean} [IsRequired=false]
 * @returns {Object} A profile condition created from the parameters.
 */
function createProfileCondition(Property, Condition, Value, IsRequired = false) {
    return {
        Condition,
        Property,
        Value,
        IsRequired
    }
}

/**
 * @returns {Object} Container profiles.
 */
function getContainerProfiles() {
    return [];
}

/**
 * @returns {Object} Response profiles.
 */
function getResponseProfiles() {
    // This seems related to DLNA, it might not be needed?
    return [{
        Type: "Video",
        Container: "m4v",
        MimeType: "video/mp4"
    }];
}

/**
 * @returns {Object} Direct play profiles.
 */
function getDirectPlayProfiles() {
    let DirectPlayProfiles = [];

    if (currentDeviceId !== deviceIds.AUDIO) {
        const mp4VideoCodecs = getSupportedMP4VideoCodecs();
        const mp4AudioCodecs = getSupportedMP4AudioCodecs();
        const vpxVideoCodecs = getSupportedVPXVideoCodecs();
        const webmAudioCodecs = getSupportedWebMAudioCodecs();

        for (const codec of vpxVideoCodecs) {
            DirectPlayProfiles.push({
                Container: "webm",
                Type: "Video",
                AudioCodec: webmAudioCodecs.join(","),
                VideoCodec: codec
            });
        }

        DirectPlayProfiles.push({
            Container: "mp4,m4v",
            Type: "Video",
            VideoCodec: mp4VideoCodecs.join(","),
            AudioCodec: mp4AudioCodecs.join(",")
        });
    }

    const supportedAudio = getSupportedAudioCodecs();

    for (const audioFormat of supportedAudio) {
        if (audioFormat === "mp3") {
            DirectPlayProfiles.push({
                Container: audioFormat,
                Type: "Audio",
                AudioCodec: audioFormat
            });
        } else if (audioFormat === "webma") {
            DirectPlayProfiles.push({
                Container: "webma,webm",
                Type: "Audio"
            });
        } else {
            DirectPlayProfiles.push({
                Container: audioFormat,
                Type: "Audio"
            });
        }

        // aac also appears in the m4a and m4b container
        if (audioFormat === "aac") {
            DirectPlayProfiles.push({
                Container: "m4a,m4b",
                AudioCodec: audioFormat,
                Type: "Audio"
            });
        }
    }

    return DirectPlayProfiles;
}

/**
 * @returns {Object} Codec profiles.
 */
function getCodecProfiles() {
    let CodecProfiles = [];

    if (currentDeviceId !== deviceIds.AUDIO) {
        CodecProfiles.push({
            Type: "VideoAudio",
            Codec: "aac",
            Conditions: [
                // Not sure what secondary audio means in this context. Multiple audio tracks?
                createProfileCondition("IsSecondaryAudio", "Equals", false),
                createProfileCondition("AudioChannels", "LessThanEqual", "2")
            ]
        });

        const maxWidth = getMaxWidthSupport(currentDeviceId);
        const h26xLevel = getH26xLevelSupport(currentDeviceId);
        const h26xProfile = getH26xProfileSupport(currentDeviceId);

        let h26xConditions = {
            Type: "Video",
            Codec: "h264",
            Conditions: [
                createProfileCondition("IsAnamorphic", "NotEquals", true),
                createProfileCondition("VideoProfile", "EqualsAny", h26xProfile),
                createProfileCondition("VideoLevel", "LessThanEqual", h26xLevel),
                createProfileCondition("Width", "LessThanEqual", maxWidth, true)
            ]
        }

        CodecProfiles.push(h26xConditions);

        CodecProfiles.push({
            Type: "Video",
            Conditions: [
                createProfileCondition("Width", "LessThanEqual", maxWidth, true)
            ]
        })

        CodecProfiles.push({
            Type: "VideoAudio",
            Conditions: [
                createProfileCondition("IsSecondaryAudio", "Equals", false)
            ]
        });
    }

    return CodecProfiles;
}

/**
 * @returns {Array} Transcoding profiles.
 */
function getTranscodingProfiles() {
    let TranscodingProfiles = [];

    let physicalAudioChannels = profileOptions.audioChannels ? 6 : 2;

    if (profileOptions.enableHls !== false) {
        TranscodingProfiles.push({
            Container: "ts",
            Type: "Audio",
            AudioCodec: "aac",
            Context: "Streaming",
            Protocol: "hls",
            MaxAudioChannels: physicalAudioChannels.toString(),
            MinSegments: "1",
            BreakOnNonKeyFrames: false
        });
    };

    const supportedAudio = getSupportedAudioCodecs();

    for (const audioFormat of supportedAudio) {
        TranscodingProfiles.push({
            Container: audioFormat,
            Type: "Audio",
            AudioCodec: audioFormat,
            Context: "Streaming",
            Protocol: "http",
            MaxAudioChannels: physicalAudioChannels.toString()
        });
    }

    if (currentDeviceId !== deviceIds.AUDIO) {
        const hlsVideoAudioCodecs = getSupportedHLSAudioCodecs();
        const hlsVideoCodecs = getSupportedHLSVideoCodecs();
        if (hlsVideoCodecs.length &&
            hlsVideoAudioCodecs.length &&
            profileOptions.enableHls !== false) {
            TranscodingProfiles.push({
                Container: "ts",
                Type: "Video",
                AudioCodec: hlsVideoAudioCodecs.join(","),
                VideoCodec: hlsVideoCodecs.join(","),
                Context: "Streaming",
                Protocol: "hls",
                MaxAudioChannels: physicalAudioChannels.toString(),
                MinSegments: "1",
                BreakOnNonKeyFrames: false
            });
        }

        if (hasVP8Support() || hasVP9Support()) {
            TranscodingProfiles.push({
                Container: "webm",
                Type: "Video",
                AudioCodec: "vorbis",
                VideoCodec: "vpx",
                Context: "Streaming",
                Protocol: "http",
                // If audio transcoding is needed, limit channels to number of physical audio channels
                // Trying to transcode to 5 channels when there are only 2 speakers generally does not sound good
                MaxAudioChannels: physicalAudioChannels.toString()
            });
        }
    }

    return TranscodingProfiles;
}

/**
 * @returns {Array} Subtitle profiles.
 */
function getSubtitleProfiles() {
    // TODO: Add TTML support
    let subProfiles = [];

    if (hasTextTrackSupport(currentDeviceId)) {
        subProfiles.push({
            Format: "vtt",
            Method: "External"
        });

        subProfiles.push({
            Format: "vtt",
            Method: "Hls"
        });
    }

    return subProfiles;
}

/**
 * Creates a device profile containing supported codecs for the active Cast device.
 * @param {Object} [options=Object]
 * @returns {Object} Device profile.
 */
export function getDeviceProfile(options = {}) {
    profileOptions = options;
    currentDeviceId = getActiveDeviceId();

    const bitrateSetting = options.bitrateSetting || getMaxBitrateSupport();

    // MaxStaticBitrate seems to be for offline sync only
    let profile = {
        MaxStreamingBitrate: bitrateSetting,
        MaxStaticBitrate: 0,
        MusicStreamingTranscodingBitrate: Math.min(bitrateSetting, 192000)
    };

    profile.DirectPlayProfiles = getDirectPlayProfiles();
    profile.TranscodingProfiles = getTranscodingProfiles();
    profile.ContainerProfile = getContainerProfiles();
    profile.CodecProfiles = getCodecProfiles();
    profile.SubtitleProfiles = getSubtitleProfiles();
    profile.ResponseProfiles = getResponseProfiles();

    return profile;
}

export default getDeviceProfile;