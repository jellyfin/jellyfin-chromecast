import { deviceIds } from './castDevices';

const castContext = cast.framework.CastReceiverContext.getInstance();

/**
 * Checks if there is E-AC-3 support.
 * This check returns in line with the cast settings made in Google Home.
 * If the device is in auto, EDID information will be used, otherwise it
 * depends on the manual setting.
 *
 * Currently it's disabled because of problems getting it to work with HLS.
 *
 * @returns true if E-AC-3 can be played
 */
export function hasEAC3Support(): boolean {
    //return castContext.canDisplayType('audio/mp4', 'ec-3');
    return false;
}

/**
 * Checks if there is AC-3 support.
 * This check returns in line with the cast settings made in Google Home.
 * If the device is in auto, EDID information will be used, otherwise it
 * depends on the manual setting.
 *
 * Currently it's disabled because of problems getting it to work with HLS.
 *
 * @returns true if AC-3 can be played
 *
 */
export function hasAC3Support(): boolean {
    //return castContext.canDisplayType('audio/mp4', 'ac-3');
    return false;
}

/**
 * Checks if the device can play any surround codecs.
 *
 * Potentially, we could guess that systems with E-AC-3 or AC-3
 * will mostly support 6ch pcm, and if any generation of cast devices
 * is actually capable of decoding e.g. aac 6ch, we can return true here
 * and give it a shot.
 *
 * @returns true if surround codecs can be played
 */
export function hasSurroundSupport(): boolean {
    // This will turn on surround support if passthrough is available.
    return hasAC3Support();
}

/**
 * Check if this device can play HEVC content.
 *
 * @returns true if HEVC is supported
 */
export function hasH265Support(): boolean {
    return castContext.canDisplayType('video/mp4', 'hev1.1.6.L150.B0');
}

/**
 * Check if this device can play text tracks.
 * This is not supported on Chromecast Audio,
 * but otherwise is.
 *
 * @param deviceId - the device id
 * @returns true if text tracks are supported
 */
export function hasTextTrackSupport(deviceId: number): boolean {
    return deviceId !== deviceIds.AUDIO;
}

/**
 * Check if this device can play VP-8 content.
 *
 * @returns true if VP-8 is supported
 */
export function hasVP8Support(): boolean {
    return castContext.canDisplayType('video/webm', 'vp8');
}

/**
 * Check if this device can play VP-9 content.
 *
 * @returns true if VP-9 is supported
 */
export function hasVP9Support(): boolean {
    return castContext.canDisplayType('video/webm', 'vp9');
}

/**
 * Get the max supported media bitrate for the active Cast device.
 *
 * @returns Max supported bitrate.
 */
export function getMaxBitrateSupport(): number {
    // FIXME: We should get this dynamically or hardcode this to values
    // we see fit for each Cast device. More testing is needed.
    // 120Mb/s ?
    return 120000000;
}

/**
 * Get the max supported video width the active Cast device supports.
 *
 * @returns Max supported width.
 */
export function getMaxWidthSupport(): number {
    // with HLS, it will produce a manifest error if we
    // send any stream larger than the screen size...
    return window.innerWidth;

    // mkv playback can use the device limitations.
    // The devices are capable of decoding and downscaling,
    // they just refuse to do it with HLS. This increases
    // the rate of direct playback.
    //switch (deviceId) {
    //    case deviceIds.ULTRA:
    //    case deviceIds.CCGTV:
    //        return 3840;
    //    case deviceIds.GEN1AND2:
    //    case deviceIds.GEN3:
    //        return 1920;
    //    case deviceIds.NESTHUBANDMAX:
    //        return 1280;
    //}
    //return 0;
}

/**
 * Get all H.26x profiles supported by the active Cast device.
 *
 * @param deviceId - Cast device id.
 * @returns All supported H.26x profiles.
 */
export function getH26xProfileSupport(deviceId: number): string {
    // These are supported by all Cast devices, excluding audio only devices.
    let h26xProfiles = 'high|main|baseline|constrained baseline';

    if (deviceId === deviceIds.ULTRA || deviceId === deviceIds.CCGTV) {
        h26xProfiles += '|high 10';
    }

    return h26xProfiles;
}

/**
 * Get the highest H.26x level supported by the active Cast device.
 *
 * @param deviceId - Cast device id.
 * @returns The highest supported H.26x level.
 */
export function getH26xLevelSupport(deviceId: number): number {
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

    return 0;
}

/**
 * Get VPX (VP8, VP9) codecs supported by the active Cast device.
 *
 * @returns Supported VPX codecs.
 */
export function getSupportedVPXVideoCodecs(): Array<string> {
    const codecs = [];

    if (hasVP8Support()) {
        codecs.push('VP8');
    }

    if (hasVP9Support()) {
        codecs.push('VP9');
    }

    return codecs;
}

/**
 * Get supported video codecs suitable for use in an MP4 container.
 *
 * @returns Supported MP4 video codecs.
 */
export function getSupportedMP4VideoCodecs(): Array<string> {
    const codecs = ['h264'];

    if (hasH265Support()) {
        codecs.push('h265');
        codecs.push('hevc');
    }

    return codecs;
}

/**
 * Get supported audio codecs suitable for use in an MP4 container.
 *
 * @returns Supported MP4 audio codecs.
 */
export function getSupportedMP4AudioCodecs(): Array<string> {
    const codecs = [];

    if (hasEAC3Support()) {
        codecs.push('eac3');
    }

    if (hasAC3Support()) {
        codecs.push('ac3');
    }

    codecs.push('aac');
    codecs.push('mp3');

    return codecs;
}

/**
 * Get supported video codecs suitable for use with HLS.
 *
 * @returns Supported HLS video codecs.
 */
export function getSupportedHLSVideoCodecs(): Array<string> {
    // Currently the server does not support fmp4 which is required
    // by the HLS spec for streaming H.265 video.
    return ['h264'];
}

/**
 * Get supported audio codecs suitable for use with HLS.
 *
 * @returns All supported HLS audio codecs.
 */
export function getSupportedHLSAudioCodecs(): Array<string> {
    // HLS basically supports whatever MP4 supports.
    return getSupportedMP4AudioCodecs();
}

/**
 * Get supported audio codecs suitable for use in a WebM container.
 *
 * @returns All supported WebM audio codecs.
 */
export function getSupportedWebMAudioCodecs(): Array<string> {
    return ['vorbis', 'opus'];
}

/**
 * Get supported audio codecs suitable for use in a WebM container.
 *
 * @returns All supported WebM audio codecs.
 */
export function getSupportedAudioCodecs(): Array<string> {
    return ['opus', 'mp3', 'aac', 'flac', 'webma', 'wav'];
}
