define(["codecsupporthelper", "castdevices"], function (codecSupport, castDevices) {
    "use strict";

    let profileOptions;
    let deviceId;

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
        //This seems related to DLNA, it might not be needed?
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

        if (deviceId !== castDevices.AUDIO) {
            const mp4VideoCodecs = codecSupport.getSupportedMP4VideoCodecs();
            const mp4AudioCodecs = codecSupport.getSupportedMP4AudioCodecs();
            const vpxVideoCodecs = codecSupport.getSupportedVPXVideoCodecs();
            const webmAudioCodecs = codecSupport.getSupportedWebMAudioCodecs();

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

        const supportedAudio = codecSupport.getSupportedAudioCodecs();

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

        if (deviceId !== castDevices.AUDIO) {
            CodecProfiles.push({
                Type: "VideoAudio",
                Codec: "aac",
                Conditions: [
                    // Not sure what secondary audio means in this context. Multiple audio tracks?
                    createProfileCondition("IsSecondaryAudio", "Equals", false),
                    createProfileCondition("AudioChannels", "LessThanEqual", "2")
                ]
            });

            const maxWidth = codecSupport.getMaxWidthSupport(deviceId);
            const h26xLevel = codecSupport.getH26xLevelSupport(deviceId);
            const h26xProfile = codecSupport.getH26xProfileSupport(deviceId);

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

        const supportedAudio = codecSupport.getSupportedAudioCodecs();

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

        if (deviceId !== castDevices.AUDIO) {
            const hlsVideoAudioCodecs = codecSupport.getSupportedHLSAudioCodecs();
            const hlsVideoCodecs = codecSupport.getSupportedHLSVideoCodecs();
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

            if (codecSupport.hasVP8Support() || codecSupport.hasVP9Support()) {
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
        //TODO: Add TTML support
        let subProfiles = [];

        if (codecSupport.hasTextTrackSupport(deviceId)) {
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
    function getDeviceProfile(options = {}) {
        profileOptions = options;
        deviceId = castDevices.getActiveDeviceId();

        const bitrateSetting = options.bitrateSetting || codecSupport.getMaxBitrateSupport();

        //MaxStaticBitrate seems to be for offline sync only
        let profile = {
            MaxStreamingBitrate: 120000000, //bitrateSetting,
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

    return getDeviceProfile;
});