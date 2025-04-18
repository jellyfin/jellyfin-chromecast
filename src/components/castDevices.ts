const castContext = cast.framework.CastReceiverContext.getInstance();

// Device Ids
export enum DeviceIds {
    GEN1AND2,
    AUDIO,
    GEN3,
    ULTRA,
    NESTHUBANDMAX, //Nest hub and Nest hub max
    CCGTV //Chromecast Google TV
}

// cached device id, avoid looking it up again and again
let deviceId: number | null = null;

/**
 * Get device id of the active Cast device.
 * Tries to identify the active Cast device by testing support for different codecs.
 * @returns Active Cast device Id.
 */
export function getActiveDeviceId(): DeviceIds {
    if (deviceId !== null) {
        return deviceId;
    }

    if (
        castContext.canDisplayType('video/mp4', 'hev1.1.6.L153.B0') &&
        castContext.canDisplayType('video/webm', 'vp9')
    ) {
        deviceId = DeviceIds.ULTRA;
    } else if (castContext.canDisplayType('video/webm', 'vp9')) {
        deviceId = DeviceIds.NESTHUBANDMAX;
    } else if (castContext.canDisplayType('video/mp4', 'avc1.64002A')) {
        deviceId = DeviceIds.GEN3;
    } else if (castContext.canDisplayType('video/mp4', 'avc1.640029')) {
        deviceId = DeviceIds.GEN1AND2;
    } else {
        deviceId = DeviceIds.AUDIO;
    }

    return deviceId;
}
