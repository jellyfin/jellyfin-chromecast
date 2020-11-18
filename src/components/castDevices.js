/* eslint-disable */

const castContext = cast.framework.CastReceiverContext.getInstance();

// Device Ids
export const deviceIds = {
    GEN1AND2: 1,
    AUDIO: 2,
    GEN3: 3,
    ULTRA: 4,
    NESTHUBANDMAX: 5, //Nest hub and Nest hub max
    CCGTV: 6 //Chromecast Google TV
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
        return deviceIds.NESTHUBANDMAX;
    } else if (castContext.canDisplayType("video/mp4", "avc1.64002A")) {
        return deviceIds.GEN3;
    } else if (castContext.canDisplayType("video/mp4", "avc1.640029")) {
        return deviceIds.GEN1AND2;
    } else {
        return deviceIds.AUDIO;
    }
}
