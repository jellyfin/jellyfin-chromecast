define(["castdevices"], function (castDevices) {
    "use strict";

    const castContext = cast.framework.CastReceiverContext.getInstance();

    function hasH265Support() {
        return castContext.canDisplayType("video/mp4", "hev1.1.6.L150.B0");
    }

    function hasTextTrackSupport(deviceId) {
        return deviceId !== castDevices.AUDIO;
    }

    function hasVP8Support() {
        return castContext.canDisplayType("video/webm", "vp8");
    }

    function hasVP9Support() {
        return castContext.canDisplayType("video/webm", "vp9");
    }

    /**
     * Get the max supported media bitrate for the active Cast device.
     * @returns {number} Max supported bitrate.
     */
    function getMaxBitrateSupport() {
        // FIXME: We should get this dynamically or hardcode this to values
        // we see fit for each Cast device. More testing is needed.
        return 120000000;
    }

    /**
     * Get the max supported video width the active Cast device supports.
     * @param {number} deviceId Cast device id.
     * @returns {number} Max supported width.
     */
    function getMaxWidthSupport(deviceId) {
        switch (deviceId) {
            case castDevices.ULTRA:
                return 3840;
                break;
            case castDevices.GEN1n2:
            case castDevices.GEN3:
                return 1920;
                break;
            case castDevices.NESTHUB:
                return 1280;
                break;
        }
    }

    /**
     * Get all H.26x profiles supported by the active Cast device.
     * @param {number} deviceId Cast device id.
     * @returns {string} All supported H.26x profiles.
     */
    function getH26xProfileSupport(deviceId) {
        // These are supported by all Cast devices, excluding audio only devices.
        let h26xProfiles = "high|main|baseline|constrained baseline";

        if (deviceId === castDevices.ULTRA) {
            h264Profiles += "|high 10"
        }

        return h26xProfiles;
    }

    /**
     * Get the highest H.26x level supported by the active Cast device.
     * @param {number} deviceId Cast device id.
     * @returns {number} The highest supported H.26x level.
     */
    function getH26xLevelSupport(deviceId) {
        switch (deviceId) {
            case castDevices.NESTHUB:
            case castDevices.GEN1n2:
                return 41;
            case castDevices.GEN3:
                return 42;
            case castDevices.ULTRA:
                return 52;
        }
    }

    /**
     * Get VPX (VP8, VP9) codecs supported by the active Cast device.
     * @returns {Array} Supported VPX codecs.
     */
    function getSupportedVPXVideoCodecs() {
        let codecs = [];
        if (hasVP8Support()) {
            codecs.push("VP8");
        }

        if (hasVP9Support()) {
            codecs.push("VP9");
        }

        return codecs;
    }

    /**
     * Get supported video codecs suitable for use in an MP4 container.
     * @returns {Array} Supported MP4 video codecs.
     */
    function getSupportedMP4VideoCodecs() {
        var codecs = ["h264"];

        if (hasH265Support()) {
            codecs.push("h265");
            codecs.push("hevc");
        }

        return codecs;
    }

    /**
     * Get supported audio codecs suitable for use in an MP4 container.
     * @returns {Array} Supported MP4 audio codecs.
     */
    function getSupportedMP4AudioCodecs() {
        return ["aac", "mp3"];
    }

    /**
     * Get supported video codecs suitable for use with HLS.
     * @returns {Array} Supported HLS video codecs.
     */
    function getSupportedHLSVideoCodecs() {
        // Currently the server does not support fmp4 which is required
        // by the HLS spec for streaming H.265 video.
        return ["h264"];
    }

    /**
     * Get supported audio codecs suitable for use with HLS.
     * @returns {Array} All supported HLS audio codecs.
     */
    function getSupportedHLSAudioCodecs() {
        // HLS basically supports whatever MP4 supports.
        return getSupportedMP4AudioCodecs();
    }

    /**
     * Get supported audio codecs suitable for use in a WebM container.
     * @returns {Array} All supported WebM audio codecs.
     */
    function getSupportedWebMAudioCodecs() {
        return ["vorbis", "opus"];
    }

    /**
     * Get supported audio codecs suitable for use in a WebM container.
     * @returns {Array} All supported WebM audio codecs.
     */
    function getSupportedAudioCodecs() {
        return ["opus", "mp3", "aac", "flac", "webma", "wav"];
    }

    return {
        hasH265Support,
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
    }
});