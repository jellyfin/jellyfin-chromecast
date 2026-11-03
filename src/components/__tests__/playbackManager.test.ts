import { beforeEach, expect, test, vi } from 'vitest';
import { PlaybackManager } from '../playbackManager';

const mocks = vi.hoisted(() => ({
    connectionError: vi.fn(),
    getPlaybackInfo: vi.fn(),
    playbackInfoError: vi.fn()
}));

// vi.mock is hoisted above the imports. The real maincontroller starts the
// receiver on import; the load only needs what these modules export.
vi.mock('../../helpers', () => ({
    broadcastConnectionErrorMessage: mocks.connectionError,
    createStreamInfo: vi.fn(),
    ticksToSeconds: (ticks: number): number => ticks / 10000000
}));
vi.mock('../jellyfinActions', () => ({
    getLiveStream: vi.fn(),
    getPlaybackInfo: mocks.getPlaybackInfo,
    load: vi.fn(),
    stopPingInterval: vi.fn()
}));
vi.mock('../maincontroller', () => ({
    checkDirectPlay: vi.fn(),
    createMediaInformation: vi.fn(),
    getMaxBitrate: (): Promise<number> => Promise.resolve(8000000),
    getOptimalMediaSource: (): null => null,
    onStopPlayerBeforePlaybackDone: vi.fn(),
    showPlaybackInfoErrorMessage: mocks.playbackInfoError
}));
vi.mock('../documentManager', () => ({
    DocumentManager: { setAppStatus: vi.fn() }
}));
vi.mock('../deviceprofileBuilder', () => ({
    getDeviceProfile: (): object => ({})
}));

beforeEach(() => {
    vi.clearAllMocks();
});

test('a PlaybackInfo request that fails is reported once, as a connection error', async () => {
    mocks.getPlaybackInfo.mockRejectedValue(new Error('Network Error'));

    await PlaybackManager.playItemInternal({ Id: 'itemId' }, { items: [] });

    expect(mocks.connectionError).toHaveBeenCalledTimes(1);
    expect(mocks.playbackInfoError).not.toHaveBeenCalled();
});
