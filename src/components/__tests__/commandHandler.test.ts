import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { DataMessage } from '../../types/global';
import { CommandHandler } from '../commandHandler';

const mocks = vi.hoisted(() => ({
    broadcastToMessageBus: vi.fn(),
    isBuffering: vi.fn(() => false),
    isPlaying: vi.fn(() => false),
    reportPlaybackProgress: vi.fn(),
    translateItems: vi.fn()
}));

// vi.mock is hoisted above the imports. The real modules start the receiver
// on import, which needs a DOM and the cast framework; the handler only needs
// what they export.
vi.mock('../../helpers', () => ({
    broadcastToMessageBus: mocks.broadcastToMessageBus,
    getReportingParams: (): object => ({}),
    TicksPerSecond: 10000000
}));
vi.mock('../maincontroller', () => ({
    instantMix: vi.fn(),
    seek: vi.fn(),
    setAudioStreamIndex: vi.fn(),
    setSubtitleStreamIndex: vi.fn(),
    shuffle: vi.fn(),
    translateItems: mocks.translateItems
}));
vi.mock('../jellyfinActions', () => ({
    reportPlaybackProgress: mocks.reportPlaybackProgress
}));
vi.mock('../playbackManager', () => ({
    PlaybackManager: {
        isBuffering: mocks.isBuffering,
        isPlaying: mocks.isPlaying,
        playbackState: {}
    }
}));
vi.mock('../documentManager', () => ({
    DocumentManager: {
        setAppStatus: vi.fn(),
        startBackdropInterval: vi.fn()
    }
}));

const message = (command: string, options = {}): DataMessage =>
    ({ command, options }) as DataMessage;

beforeEach(() => {
    vi.clearAllMocks();
    mocks.isPlaying.mockReturnValue(false);
});

describe('an unknown command', () => {
    test('is answered with an error and plays nothing', () => {
        CommandHandler.processMessage(
            message('PlayNoww', { items: [{ Id: 'itemId' }] }),
            'PlayNoww'
        );

        expect(mocks.translateItems).not.toHaveBeenCalled();
        expect(mocks.broadcastToMessageBus).toHaveBeenCalledWith({
            message: 'Unknown command: PlayNoww',
            type: 'error'
        });
    });
});

describe('Identify', () => {
    test('reports what plays as started to a sender that connects during playback', () => {
        mocks.isPlaying.mockReturnValue(true);

        CommandHandler.processMessage(message('Identify'), 'Identify');

        expect(mocks.reportPlaybackProgress).toHaveBeenCalledWith(
            {},
            {},
            true,
            'playbackstart'
        );
    });
});
