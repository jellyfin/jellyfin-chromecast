const castContext = cast.framework.CastReceiverContext.getInstance();

/**
 * Converts a codec string to the appropriate MIME type to use for testing support.
 * @param codec - The codec in question.
 * @returns The MIME type to use for testing support.
 */
function videoCodecToMimeType(codec: VideoCodec): string {
    switch (codec) {
        case VideoCodec.H264:
        case VideoCodec.H265:
            return 'video/mp4';
        case VideoCodec.VP8:
        case VideoCodec.VP9:
        case VideoCodec.AV1:
            return 'video/webm';
    }
}

/**
 * Get the string to use for testing support of a codec.
 * @param codec - The codec in question.
 * @returns The string to use for testing support of the codec.
 */
function getAudioCodecString(codec: AudioCodec): string | undefined {
    switch (codec) {
        case AudioCodec.EAC3:
            return 'ec-3';
        case AudioCodec.AC3:
            return 'ac-3';
        case AudioCodec.AAC:
            // Use HE-AAC as the test codec, LC-AAC should be supported if HE-AAC is too.
            return 'mp4a.40.5';
        case AudioCodec.WAV:
            return undefined;
        default:
            return codec.toString();
    }
}

/**
 * Get the string to use for testing support of a codec.
 * @param codec - The codec in question.
 * @param profile - The profile for the codec.
 * @param level - The level for the codec.
 * @param bitDepth - The bit depth of the video.
 * @returns The string to use for testing support of the codec.
 */
function getVideoCodecString(
    codec: VideoCodec,
    profile?: string,
    level?: number,
    bitDepth?: number
): string {
    switch (codec) {
        case VideoCodec.H264: {
            // Default to the oldest baseline profile.
            profile = profile ?? 'baseline';

            let profileFlag: string;

            switch (profile) {
                case 'high 10':
                    profileFlag = '6e00';
                    break;
                case 'high':
                    profileFlag = '6400';
                    break;
                case 'main':
                    profileFlag = '4d00';
                    break;
                case 'constrained baseline':
                    profileFlag = '4240';
                    break;
                case 'baseline':
                default:
                    profileFlag = '4200';
                    break;
            }

            // Levels are bound by max frame size (macroblocks) and decoding
            // speed (macroblocks/s).
            // A macroblock is 16x16 pixels.
            //
            // See:
            //   * https://en.wikipedia.org/wiki/Advanced_Video_Coding#Levels
            level = level ?? 10;

            return `avc1.${profileFlag}${level.toString(16)}`;
        }
        case VideoCodec.H265: {
            let profileFlag: string;
            let constraintFlag: number;

            switch (profile) {
                case 'main 10':
                    profileFlag = 'L';
                    constraintFlag = 4;
                    break;
                case 'high':
                    profileFlag = 'H';
                    constraintFlag = 4;
                    break;
                case 'high 10':
                    profileFlag = 'H';
                    constraintFlag = 4;
                    break;
                case 'main':
                default:
                    profileFlag = 'L';
                    constraintFlag = 0;
                    break;
            }

            // Levels are bound by the luma picture size (total pixels) and
            // luma sample rate (samples/s).
            level = level ?? 10;

            return `hev1.1.${constraintFlag}.${profileFlag}${level * 3}.B0`;
        }
        case VideoCodec.VP8:
            return 'vp8';
        case VideoCodec.VP9: {
            let profileFlag: string;

            switch (profile?.toLowerCase()) {
                case 'profile 1':
                    profileFlag = '01';
                    break;
                case 'profile 2':
                    profileFlag = '02';
                    break;
                case 'profile 3':
                    profileFlag = '03';
                    break;
                case 'profile 0':
                default:
                    profileFlag = '00';
                    break;
            }

            level = level ?? 10;
            bitDepth = bitDepth ?? 8;

            const bitDepthFlag = bitDepth.toString().padStart(2, '0');

            return `vp9.${profileFlag}.${level}.${bitDepthFlag}`;
        }
        case VideoCodec.AV1: {
            let profileFlag: string;

            switch (profile?.toLowerCase()) {
                case 'high':
                    profileFlag = '1';
                    break;
                case 'professional':
                    profileFlag = '2';
                    break;
                case 'main':
                default:
                    profileFlag = '0';
                    break;
            }

            // This level should correspond to the `seq_level_idx`.
            level = level ?? 0;
            bitDepth = bitDepth ?? 8;

            const levelFlag = level.toString().padStart(2, '0');
            const bitDepthFlag = bitDepth.toString().padStart(2, '0');

            // Assume main tier, since the condition language has no way to
            // express that.
            return `av01.${profileFlag}.${levelFlag}M.${bitDepthFlag}`;
        }
    }
}

/**
 * Utility class representing a video resolution.
 */
export class Resolution {
    public width: number;
    public height: number;
    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
    }

    public equals(other: Resolution): boolean {
        return this.width === other.width && this.height === other.height;
    }
}

/**
 * Known video codecs
 */
export enum VideoCodec {
    H264 = 'h264',
    H265 = 'h265',
    VP8 = 'vp8',
    VP9 = 'vp9',
    AV1 = 'av1'
}

export enum AudioCodec {
    EAC3 = 'eac3',
    AC3 = 'ac3',
    MP3 = 'mp3',
    AAC = 'aac',
    FLAC = 'flac',
    WAV = 'wav',
    Vorbis = 'vorbis',
    Opus = 'opus'
}

/**
 * Checks whether a given audio codec is supported.
 * @param codec - The codec in question
 * @returns `true` if the codec is supported.
 */
export function hasAudioCodecSupport(codec: AudioCodec): boolean {
    return getAudioCodecContainerSupport(codec).length > 0;
}

/**
 * Returns the containers supported for a given audio codec.
 *
 * Returns an empty array if the codec is not supported.
 * @param codec - The codec in question
 * @returns An array of strings representing the supported container formats.
 */
export function getAudioCodecContainerSupport(codec: AudioCodec): string[] {
    const supportedContainers = [];
    const codecString = getAudioCodecString(codec);

    switch (codec) {
        case AudioCodec.EAC3:
        case AudioCodec.AC3:
        case AudioCodec.AAC:
            if (castContext.canDisplayType('audio/mp4', codecString)) {
                supportedContainers.push('mp4');
            }

            break;
        case AudioCodec.MP3:
            if (castContext.canDisplayType('audio/mp4', codecString)) {
                supportedContainers.push('mp4');
                supportedContainers.push('m4a');
            }

            if (castContext.canDisplayType('audio/mpeg', codecString)) {
                supportedContainers.push('mp3');
            }

            break;
        case AudioCodec.FLAC:
            if (castContext.canDisplayType('audio/mp4', codecString)) {
                supportedContainers.push('mp4');
            }

            if (castContext.canDisplayType('audio/flac', codecString)) {
                supportedContainers.push('flac');
            }

            break;
        case AudioCodec.WAV:
            if (castContext.canDisplayType('audio/wav', codecString)) {
                supportedContainers.push('wav');
            }

            break;
        case AudioCodec.Vorbis:
        case AudioCodec.Opus:
            if (castContext.canDisplayType('audio/webm', codecString)) {
                supportedContainers.push('webm');
            }

            if (castContext.canDisplayType('audio/ogg', codecString)) {
                supportedContainers.push('ogg');
            }

            // Usually, only Opus is supported in MP4.
            if (castContext.canDisplayType('audio/mp4', codecString)) {
                supportedContainers.push('mp4');
            }

            break;
    }

    return supportedContainers;
}

/**
 * Checks whether Dolby Atmos is supported on the device.
 * @returns `true` if Dolby Atmos is supported.
 */
export function hasDolbyAtmosSupport(): boolean {
    const deviceCaps = castContext.getDeviceCapabilities();

    return deviceCaps?.[
        cast.framework.system.DeviceCapabilities.IS_DOLBY_ATMOS_SUPPORTED
    ];
}

/**
 * Checks for the number of audio channels supported on the device.
 * @returns The maximum number of audio channels supported.
 */
export function getMaxAudioChannels(): number {
    const audioCtx = new window.AudioContext();

    // Make sure we allow at least 1 channel, in case of some bad output.
    return Math.max(audioCtx.destination.maxChannelCount, 1);
}

/**
 * Checks for every supported video codec.
 * @returns An array of supported video codecs
 */
export function getSupportedVideoCodecs(): VideoCodec[] {
    const supportedVideoCodecs: VideoCodec[] = [];

    for (const videoCodec of Object.values(VideoCodec)) {
        if (hasVideoCodecSupport(videoCodec as VideoCodec)) {
            supportedVideoCodecs.push(videoCodec as VideoCodec);
        }
    }

    return supportedVideoCodecs;
}

/**
 * Check if the device has any video support.
 * @returns `true` if the device can display video.
 */
export function hasVideoSupport(): boolean {
    const deviceCaps = castContext.getDeviceCapabilities();

    return deviceCaps?.[
        cast.framework.system.DeviceCapabilities.DISPLAY_SUPPORTED
    ];
}

/**
 * Gets whether the particular codec is supported.
 * @param codec - The codec in question
 * @returns `true` if the codec is supported.
 */
export function hasVideoCodecSupport(codec: VideoCodec): boolean {
    const mimeType = videoCodecToMimeType(codec);
    const codecString = getVideoCodecString(codec);

    return castContext.canDisplayType(mimeType, codecString);
}

/**
 * Check if this device can play text tracks.
 * This is not supported on Chromecast Audio,
 * but otherwise is.
 * @returns `true` if text tracks are supported
 */
export function hasTextTrackSupport(): boolean {
    return hasVideoSupport();
}

/**
 * Get the max supported media bitrate for the active Cast device.
 * @returns `number` representing the max supported bitrate.
 */
export function getMaxBitrateSupport(): number {
    // FIXME: We should get this dynamically or hardcode this to values
    // we see fit for each Cast device. More testing is needed.
    // 120Mb/s ?
    return 120000000;
}

/**
 * Tests the max resolution supported by the device of a particular codec.
 * @param codec - The codec in question.
 * @param profile - The profile for the codec.
 * @param level - The level for the codec.
 * @param bitDepth - The bit depth of the video.
 * @returns `number` representing the maximum resolution supported.
 */
export function getMaxResolutionSupported(
    codec: VideoCodec,
    profile: string,
    level: number,
    bitDepth: number
): Resolution {
    // This function iteratively tests the maximum resolution assuming a 16:9
    // resolution ratio. This should be a good enough approximation for most
    // devices.
    //
    // In reality, some encoders may be limited by pixel count instead of
    // resolution, but other devices may arbitrarily limit the resolution.

    let maxRes = new Resolution(0, 0);
    const mimeType = videoCodecToMimeType(codec);
    const codecString = getVideoCodecString(codec, profile, level, bitDepth);

    // Limit the upper bound to 32K, which is more than enough.
    while (maxRes.width < 30720) {
        const newRes = ((): Resolution => {
            // Progressively increase steps as resolution increases.
            if (maxRes.width >= 2160) {
                return new Resolution(maxRes.width + 1280, maxRes.height + 720);
            } else if (maxRes.width >= 1080) {
                return new Resolution(maxRes.width + 640, maxRes.height + 360);
            } else {
                return new Resolution(maxRes.width + 320, maxRes.height + 180);
            }
        })();

        if (
            !castContext.canDisplayType(
                mimeType,
                codecString,
                newRes.width,
                newRes.height
            )
        ) {
            break;
        }

        maxRes = newRes;
    }

    // As a compromise, after we've found the maximum 16:9 resolution, try
    // checking other resolutions. These resolutions are ordered descending by
    // the scaling factor of the expanding dimension -- in the sense that we
    // check 2.40:1 before 1.85:1. We also prioritize wider resolutions over
    // taller resolutions.
    //
    // In these checks, we hold one resolution constant and expand the other to
    // test.
    const otherResolutions = [
        // Wider resolutions

        // 32:9 is a super ultrawide resolution typically used by monitors.
        new Resolution(Math.floor(maxRes.height * 3.555), maxRes.height),

        // 2.40:1 is used by some cinema shot on 35mm film.
        new Resolution(Math.floor(maxRes.height * 2.4), maxRes.height),

        // "21:9" is the marketing term for multiple ultrawide resolutions.
        // The real aspect ratio is somewhere between 2.37:1 and 2.38:1.
        new Resolution(Math.floor(maxRes.height * 2.37037), maxRes.height),

        // 1.90:1 is a common IMAX resolution.
        new Resolution(Math.floor(maxRes.height * 1.9), maxRes.height),

        // 1.85:1 is sometimes used in Hollywood cinema.
        new Resolution(Math.floor(maxRes.height * 1.85), maxRes.height),

        // Taller resolutions.

        // 9:19.5 is a common resolution for a horizontal modern phone.
        new Resolution(maxRes.width, Math.floor(maxRes.width / 9) * 19.5),

        // 9:16 is the vertical version of 16:9.
        new Resolution(maxRes.width, Math.floor(maxRes.width / 9) * 16),

        // 1:1 resolution
        new Resolution(maxRes.width, maxRes.width),

        // 4:3 is an older but still common resolution found on old TVs.
        new Resolution(maxRes.width, Math.floor((maxRes.width / 4) * 3)),

        // 16:10 is a common resolution for computer displays.
        new Resolution(maxRes.width, Math.floor((maxRes.width / 16) * 10))
    ];

    for (const newRes of otherResolutions) {
        if (
            castContext.canDisplayType(
                mimeType,
                codecString,
                newRes.width,
                newRes.height
            )
        ) {
            // Return early, since it'll be the best we'll find.
            return newRes;
        }
    }

    return maxRes;
}

/**
 * Gets the supported profiles for a given video codec.
 * @param codec - The video codec in question.
 * @returns An array of the supported profiles.
 */
export function getVideoProfileSupport(codec: VideoCodec): string[] {
    const possibleProfiles = ((): string[] => {
        switch (codec) {
            case VideoCodec.H264:
                return [
                    'constrained baseline',
                    'baseline',
                    'main',
                    'high',
                    'high 10'
                ];
            case VideoCodec.H265:
                return ['main', 'main 10', 'high', 'high 10'];
            case VideoCodec.AV1:
                return ['main', 'high', 'professional'];
            case VideoCodec.VP8:
                return [''];
            case VideoCodec.VP9:
                return ['Profile 0', 'Profile 1', 'Profile 2', 'Profile 3'];
        }
    })();

    const supportedProfiles = possibleProfiles.filter((profile) => {
        const codecString = getVideoCodecString(codec, profile);
        const mimeType = videoCodecToMimeType(codec);

        return castContext.canDisplayType(mimeType, codecString);
    });

    return supportedProfiles;
}

/**
 * Gets the highest level supported by the given codec profile.
 * @param codec - The codec in question.
 * @param profile - The profile for the codec.
 * @param bitDepth - The bit depth of the video.
 * @returns `number` representing the  highest level supported.
 */
export function getVideoCodecHighestLevelSupport(
    codec: VideoCodec,
    profile?: string,
    bitDepth?: number
): number | undefined {
    const possibleLevels = ((): number[] => {
        switch (codec) {
            case VideoCodec.H264:
                return [
                    10, 11, 12, 13, 20, 21, 22, 30, 31, 32, 40, 41, 42, 50, 51,
                    52, 60, 61, 62
                ];
            case VideoCodec.H265:
                return [10, 20, 21, 30, 31, 40, 41, 50, 51, 52, 60, 61, 62];
            case VideoCodec.AV1:
                // This level should correspond to the `seq_level_idx`, which is
                // different from other codecs, which just use the
                // human-readable level multiplied by 10.
                return [0, 1, 4, 5, 8, 9, 12, 13, 14, 15, 16, 17, 18, 19];
            case VideoCodec.VP8:
                return [];
            case VideoCodec.VP9:
                return [10, 11, 20, 21, 30, 31, 40, 41, 50, 51, 52, 60, 61, 62];
        }
    })();

    const supportedLevels = possibleLevels.filter((level) => {
        const mimeType = videoCodecToMimeType(codec);
        const codecString = getVideoCodecString(
            codec,
            profile,
            level,
            bitDepth
        );

        return castContext.canDisplayType(mimeType, codecString);
    });

    return supportedLevels.length > 0
        ? supportedLevels[supportedLevels.length - 1]
        : undefined;
}

/**
 * Gets the highest bit depth supported by the given codec profile.
 * @param codec - The codec in question.
 * @param profile - The profile for the codec.
 * @param level - The level for the codec.
 * @returns The highest bit depth supported by the given codec profile.
 */
export function getVideoCodecHighestBitDepthSupport(
    codec: VideoCodec,
    profile?: string,
    level?: number
): number | undefined {
    const possibleBitDepths = ((): number[] => {
        switch (codec) {
            case VideoCodec.H264:
                switch (profile) {
                    case 'high 10':
                        return [10, 8];
                    default:
                        return [8];
                }
            case VideoCodec.H265:
                switch (profile) {
                    case 'main 10':
                    case 'high 10':
                        return [10, 8];
                    default:
                        return [8];
                }
            case VideoCodec.AV1:
                switch (profile) {
                    case 'professional':
                        return [10, 8];
                    default:
                        return [8];
                }
            case VideoCodec.VP8:
                // VP8's bitstream officially only supports up to 8 bits.
                return [8];
            case VideoCodec.VP9:
                switch (profile) {
                    case 'Profile 2':
                    case 'Profile 3':
                        return [12, 10];
                    default:
                        return [8];
                }
        }
    })();

    return possibleBitDepths.find((bitDepth) => {
        const mimeType = videoCodecToMimeType(codec);
        const codecString = getVideoCodecString(
            codec,
            profile,
            level,
            bitDepth
        );

        return castContext.canDisplayType(mimeType, codecString);
    });
}

/**
 * Get VPX (VP8, VP9) codecs supported by the active Cast device.
 * @returns An array of the supported WebM codecs.
 */
export function getSupportedWebMVideoCodecs(): VideoCodec[] {
    const possibleCodecs = [VideoCodec.VP8, VideoCodec.VP9, VideoCodec.AV1];

    const supportedCodecs = possibleCodecs.filter((codec) => {
        return castContext.canDisplayType(
            'video/webm',
            getVideoCodecString(codec)
        );
    });

    return supportedCodecs;
}

/**
 * Get supported video codecs suitable for use in an MP4 container.
 * @returns An array of the supported MP4 video codecs.
 */
export function getSupportedMP4VideoCodecs(): VideoCodec[] {
    const possibleCodecs = [VideoCodec.H264, VideoCodec.H265, VideoCodec.AV1];

    const supportedCodecs = possibleCodecs.filter((codec) => {
        return castContext.canDisplayType(
            'video/mp4',
            getVideoCodecString(codec)
        );
    });

    return supportedCodecs;
}

/**
 * Get supported audio codecs suitable for use in an MP4 container.
 * @returns Supported MP4 audio codecs.
 */
export function getSupportedMP4AudioCodecs(): AudioCodec[] {
    const possibleCodecs = [
        AudioCodec.EAC3,
        AudioCodec.AC3,
        AudioCodec.AAC,
        AudioCodec.MP3
    ];
    const codecs = [];

    for (const codec of possibleCodecs) {
        const codecString = getAudioCodecString(codec);

        if (
            codecString &&
            castContext.canDisplayType('audio/mp4', codecString)
        ) {
            codecs.push(codec);
        }
    }

    return codecs;
}

/**
 * Get supported video codecs suitable for use with HLS.
 * @returns Supported HLS video codecs.
 */
export function getSupportedHLSVideoCodecs(): VideoCodec[] {
    // The server now supports fmp4, so return a list of all supported mp4
    // codecs.
    return getSupportedMP4VideoCodecs();
}

/**
 * Get supported audio codecs suitable for use with HLS.
 * @returns All supported HLS audio codecs.
 */
export function getSupportedHLSAudioCodecs(): AudioCodec[] {
    // HLS basically supports whatever MP4 supports.
    return getSupportedMP4AudioCodecs();
}

/**
 * Get supported audio codecs suitable for use in a WebM container.
 * @returns All supported WebM audio codecs.
 */
export function getSupportedWebMAudioCodecs(): AudioCodec[] {
    const possibleCodecs = [AudioCodec.Opus, AudioCodec.Vorbis];
    const codecs = [];

    for (const codec of possibleCodecs) {
        const codecString = getAudioCodecString(codec);

        if (
            codecString &&
            castContext.canDisplayType('audio/webm', codecString)
        ) {
            codecs.push(codec);
        }
    }

    return codecs;
}
