import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
    onStopPlayerBeforePlaybackDone,
    translateItems
} from '../maincontroller';

const mocks = vi.hoisted(() => {
    /**
     * A function, so the stub below can be called and constructed; the traps
     * answer for it.
     */
    function stubTarget(): void {
        // Never runs.
    }

    // maincontroller wires the cast framework and the window at import. Any
    // property, call or construction of this stub gives the stub back, and
    // nothing on the paths under test reads what it got.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stub: any = new Proxy(stubTarget, {
        apply: (): unknown => stub,
        construct: (): object => stub,
        get: (_target, key): unknown => {
            if (typeof key === 'symbol' || key === 'then') {
                return undefined;
            }

            return stub;
        }
    });

    // @ts-expect-error cast is defined globally by the framework, replaced here.
    global.cast = stub;
    global.window = stub;

    return {
        connectionError: vi.fn(),
        getItem: vi.fn(),
        stub,
        translateRequestedItems: vi.fn()
    };
});

vi.mock('../../helpers', () => ({
    broadcastConnectionErrorMessage: mocks.connectionError,
    broadcastToMessageBus: vi.fn(),
    getCurrentPositionTicks: vi.fn(),
    getInstantMixItems: vi.fn(),
    getMetadata: vi.fn(),
    getReportingParams: vi.fn(),
    getShuffleItems: vi.fn(),
    getStreamByIndex: vi.fn(),
    TicksPerSecond: 10000000,
    ticksToSeconds: vi.fn(),
    translateRequestedItems: mocks.translateRequestedItems
}));
vi.mock('../jellyfinActions', () => ({
    detectBitrate: vi.fn(),
    play: vi.fn(),
    reportPlaybackProgress: vi.fn(),
    reportPlaybackStart: vi.fn(),
    reportPlaybackStopped: vi.fn()
}));
vi.mock('../deviceprofileBuilder', () => ({ getDeviceProfile: vi.fn() }));
vi.mock('../jellyfinApi', () => ({ JellyfinApi: { jellyfinApi: {} } }));
vi.mock('../playbackManager', () => ({ PlaybackManager: mocks.stub }));
vi.mock('../commandHandler', () => ({ CommandHandler: mocks.stub }));
vi.mock('../codecSupportHelper', () => ({
    getMaxBitrateSupport: (): number => 0
}));
vi.mock('@jellyfin/sdk/lib/utils/api', () => ({
    getSessionApi: (): unknown => mocks.stub,
    getUserLibraryApi: (): unknown => ({ getItem: mocks.getItem })
}));

beforeEach(() => {
    vi.clearAllMocks();
});

describe('a server the receiver cannot reach', () => {
    test('is reported when the items of a PlayNow are looked up', async () => {
        mocks.translateRequestedItems.mockRejectedValue(
            new Error('Network Error')
        );

        await translateItems({}, { items: [{ Id: 'itemId' }] }, 'PlayNow');

        expect(mocks.connectionError).toHaveBeenCalledTimes(1);
    });

    test('is reported when the item to play is fetched', async () => {
        mocks.getItem.mockRejectedValue(new Error('Network Error'));

        await onStopPlayerBeforePlaybackDone({ Id: 'itemId' }, { items: [] });

        expect(mocks.connectionError).toHaveBeenCalledTimes(1);
    });
});
