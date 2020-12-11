import { deviceIds } from './castDevices';

const castContext = cast.framework.CastReceiverContext.getInstance();

export function hasEAC3Support(): boolean {
    // Some error causes this not to work at all
    //return castContext.canDisplayType('audio/mp4', 'ec-3');
    return false;
}

export function hasAC3Support(): boolean {
    // Some error causes this not to work at all
    //return castContext.canDisplayType('audio/mp4', 'ac-3');
    return false;
}

export function hasSurroundSupport(deviceId: number): boolean {
    // AC-3 in this client is broken. The cause is not known yet.
    // However, the device does report correctly in this check.
    // We can use that to estimate if we can send AAC 6ch.

    // From my testing:
    // GEN1+GEN2+GEN3 can only do 2.0 when AC3 is lacking.
    // AUDIO has toslink at most, which doesn't do pcm 6ch.
    // Forums indicate that they only support the passthrough option across the lineup.
    // See https://support.google.com/chromecast/thread/362511

    // This will turn on surround support if passthrough is available.
    return hasAC3Support();

    // If there are cast devices that can decode 6ch audio:
    // We cannot check if the connected system supports pcm 6ch, but we can check for ac-3.
    // Sadly there are some situations (toslink) that supports ac-3 but not pcm 6ch.
    // In those cases we will rely on chromecast downmixing.
    //return castContext.canDisplayType('audio/mp4', 'ac-3');
}

export function hasH265Support(): boolean {
    return castContext.canDisplayType('video/mp4', 'hev1.1.6.L150.B0');
}

export function hasTextTrackSupport(deviceId: number): boolean {
    return deviceId !== deviceIds.AUDIO;
}

export function hasVP8Support(): boolean {
    return castContext.canDisplayType('video/webm', 'vp8');
}

export function hasVP9Support(): boolean {
    return castContext.canDisplayType('video/webm', 'vp9');
}

/**
 * Get the max supported media bitrate for the active Cast device.
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
 * @param deviceId Cast device id.
 * @returns Max supported width.
 */
export function getMaxWidthSupport(deviceId: number): number {
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

    return 0;
}

/**
 * Get all H.26x profiles supported by the active Cast device.
 * @param {number} deviceId Cast device id.
 * @returns {string} All supported H.26x profiles.
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
 * @param deviceId Cast device id.
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
 * @returns Supported HLS video codecs.
 */
export function getSupportedHLSVideoCodecs(): Array<string> {
    // Currently the server does not support fmp4 which is required
    // by the HLS spec for streaming H.265 video.
    return ['h264'];
}

/**
 * Get supported audio codecs suitable for use with HLS.
 * @returns All supported HLS audio codecs.
 */
export function getSupportedHLSAudioCodecs(): Array<string> {
    // HLS basically supports whatever MP4 supports.
    return getSupportedMP4AudioCodecs();
}

/**
 * Get supported audio codecs suitable for use in a WebM container.
 * @returns All supported WebM audio codecs.
 */
export function getSupportedWebMAudioCodecs(): Array<string> {
    return ['vorbis', 'opus'];
}

/**
 * Get supported audio codecs suitable for use in a WebM container.
 * @returns All supported WebM audio codecs.
 */
export function getSupportedAudioCodecs(): Array<string> {
    return ['opus', 'mp3', 'aac', 'flac', 'webma', 'wav'];
}
