const castContext = cast.framework.CastReceiverContext.getInstance();

// Device Ids
export const deviceIds = {
    GEN1n2: 1,
    AUDIO: 2,
    GEN3: 3,
    ULTRA: 4,
    NESTHUB: 5
}


/**
 * Get device id of the active Cast device.
 * Tries to identify the active Cast device by testing support for different codecs.
 * @returns {number} Active Cast device Id.
 */
export function getActiveDeviceId() {
    if (castContext.canDisplayType("video/mp4", "hev1.1.6.L153.B0") &&
        castContext.canDisplayType("video/webm", "vp9")) {
        return deviceIds.ULTRA;
    } else if (castContext.canDisplayType("video/webm", "vp9")) {
        return deviceIds.NESTHUB;
    } else if (castContext.canDisplayType("video/mp4", "avc1.64002A")) {
        return deviceIds.GEN3;
    } else if (castContext.canDisplayType("video/mp4", "avc1.640029")) {
        return deviceIds.GEN1n2;
    } else {
        return deviceIds.AUDIO;
    }
}