const castContext = cast.framework.CastReceiverContext.getInstance();

// Device Ids
export enum deviceIds {
    GEN1AND2,
    AUDIO,
    GEN3,
    ULTRA,
    NESTHUBANDMAX, //Nest hub and Nest hub max
    CCGTV //Chromecast Google TV
}

/**
 * Get device id of the active Cast device.
 * Tries to identify the active Cast device by testing support for different codecs.
 *
 * @returns Active Cast device Id.
 */
export function getActiveDeviceId(): number {
    if (
        castContext.canDisplayType('video/mp4', 'hev1.1.6.L153.B0') &&
        castContext.canDisplayType('video/webm', 'vp9')
    ) {
        return deviceIds.ULTRA;
    } else if (castContext.canDisplayType('video/webm', 'vp9')) {
        return deviceIds.NESTHUBANDMAX;
    } else if (castContext.canDisplayType('video/mp4', 'avc1.64002A')) {
        return deviceIds.GEN3;
    } else if (castContext.canDisplayType('video/mp4', 'avc1.640029')) {
        return deviceIds.GEN1AND2;
    } else {
        return deviceIds.AUDIO;
    }
}
