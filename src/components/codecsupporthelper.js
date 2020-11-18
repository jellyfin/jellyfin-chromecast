/* eslint-disable */

import { deviceIds } from "./castDevices";

const castContext = cast.framework.CastReceiverContext.getInstance();

export function hasH265Support() {
    return castContext.canDisplayType("video/mp4", "hev1.1.6.L150.B0");
}

export function hasTextTrackSupport(deviceId) {
    return deviceId !== deviceIds.AUDIO;
}

export function hasVP8Support() {
    return castContext.canDisplayType("video/webm", "vp8");
}

export function hasVP9Support() {
    return castContext.canDisplayType("video/webm", "vp9");
}

/**
 * Get the max supported media bitrate for the active Cast device.
 * @returns {number} Max supported bitrate.
 */
export function getMaxBitrateSupport() {
    // FIXME: We should get this dynamically or hardcode this to values
    // we see fit for each Cast device. More testing is needed.
    return 120000000;
}

/**
 * Get the max supported video width the active Cast device supports.
 * @param {number} deviceId Cast device id.
 * @returns {number} Max supported width.
 */
export function getMaxWidthSupport(deviceId) {
    switch (deviceId) {
        case deviceIds.ULTRA:
        case deviceIds.CCGTV:
            return 3840;
        case deviceIds.GEN1AND2:
        case deviceIds.GEN3:
            return 1920;
        case deviceIds.NESTHUBANDMAX:
            return 1280;
    }
}

/**
 * Get all H.26x profiles supported by the active Cast device.
 * @param {number} deviceId Cast device id.
 * @returns {string} All supported H.26x profiles.
 */
export function getH26xProfileSupport(deviceId) {
    // These are supported by all Cast devices, excluding audio only devices.
    let h26xProfiles = "high|main|baseline|constrained baseline";

    if (deviceId === deviceIds.ULTRA || deviceId === deviceIds.CCGTV) {
        h264Profiles += "|high 10"
    }

    return h26xProfiles;
}

/**
 * Get the highest H.26x level supported by the active Cast device.
 * @param {number} deviceId Cast device id.
 * @returns {number} The highest supported H.26x level.
 */
export function getH26xLevelSupport(deviceId) {
    switch (deviceId) {
        case deviceIds.NESTHUBANDMAX:
        case deviceIds.GEN1AND2:
            return 41;
        case deviceIds.GEN3:
            return 42;
        case deviceIds.ULTRA:
        case deviceIds.CCGTV:
            return 52;
    }
}

/**
 * Get VPX (VP8, VP9) codecs supported by the active Cast device.
 * @returns {Array} Supported VPX codecs.
 */
export function getSupportedVPXVideoCodecs() {
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
export function getSupportedMP4VideoCodecs() {
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
export function getSupportedMP4AudioCodecs() {
    return ["aac", "mp3"];
}

/**
 * Get supported video codecs suitable for use with HLS.
 * @returns {Array} Supported HLS video codecs.
 */
export function getSupportedHLSVideoCodecs() {
    // Currently the server does not support fmp4 which is required
    // by the HLS spec for streaming H.265 video.
    return ["h264"];
}

/**
 * Get supported audio codecs suitable for use with HLS.
 * @returns {Array} All supported HLS audio codecs.
 */
export function getSupportedHLSAudioCodecs() {
    // HLS basically supports whatever MP4 supports.
    return getSupportedMP4AudioCodecs();
}

/**
 * Get supported audio codecs suitable for use in a WebM container.
 * @returns {Array} All supported WebM audio codecs.
 */
export function getSupportedWebMAudioCodecs() {
    return ["vorbis", "opus"];
}

/**
 * Get supported audio codecs suitable for use in a WebM container.
 * @returns {Array} All supported WebM audio codecs.
 */
export function getSupportedAudioCodecs() {
    return ["opus", "mp3", "aac", "flac", "webma", "wav"];
}
