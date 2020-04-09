define([], function () {
    "use strict";
    
    const castContext = cast.framework.CastReceiverContext.getInstance();

    //Device Ids
    const GEN1n2 = 1;
    const AUDIO = 2;
    const GEN3 = 3;
    const ULTRA = 4;
    const NESTHUB = 5;

    /**
     * Get device id of the active Cast device.
     * Tries to identify the active Cast device by testing different codec supports.
     * @returns {number} Active Cast device Id.
     */
    function getActiveDeviceId() {
        if (castContext.canDisplayType("video/mp4", "hev1.1.6.L153.B0") &&
        castContext.canDisplayType("video/webm", "vp9")) {
            return ULTRA;
        } else if (castContext.canDisplayType("video/webm", "vp9")) {
            return NESTHUB;
        } else if (castContext.canDisplayType("video/mp4", "avc1.64002A")) {
            return GEN3;
        } else if (castContext.canDisplayType("video/mp4", "avc1.640029")) {
            return GEN1n2;
        } else {
            return AUDIO;
        }
    }

    return {
        GEN1n2,
        AUDIO,
        GEN3,
        ULTRA,
        NESTHUB,
        getActiveDeviceId
    };
});