import { describe, beforeAll, beforeEach, test, expect, vi } from 'vitest';
import type { BaseItemDto } from '@jellyfin/sdk/lib/generated-client';
import { RepeatMode } from '@jellyfin/sdk/lib/generated-client';

// Importing these for real boots the whole receiver, which needs a DOM and
// the cast framework. The playlist logic under test doesn't use them.
vi.mock('../../helpers', () => ({}));
vi.mock('../documentManager', () => ({ DocumentManager: {} }));
vi.mock('../deviceprofileBuilder', () => ({}));
vi.mock('../jellyfinActions', () => ({}));
vi.mock('../maincontroller', () => ({
    onStopPlayerBeforePlaybackDone: (): Promise<void> => Promise.resolve()
}));

let PlaybackManager: typeof import('../playbackManager').PlaybackManager;

beforeAll(async () => {
    // @ts-expect-error only the parts of window the playlist reads are needed.
    global.window = { repeatMode: RepeatMode.RepeatNone };

    ({ PlaybackManager } = await import('../playbackManager'));
});

const item = (id: string): BaseItemDto => ({ Id: id, MediaType: 'Audio' });

// Walks the playlist from the current item to the end and returns the ids
// in play order.
const remainingIds = (): (string | undefined)[] => {
    const ids: (string | undefined)[] = [];
    let next = PlaybackManager.getNextPlaybackItemInfo();

    while (next) {
        ids.push(next.item.Id);
        PlaybackManager.playNextItem();
        next = PlaybackManager.getNextPlaybackItemInfo();
    }

    return ids;
};

describe('enqueueNext', () => {
    beforeEach(() => {
        PlaybackManager.setPlayerManager({
            stop: vi.fn()
        } as unknown as framework.PlayerManager);
    });

    test('inserts the items right after the current item, in order', async () => {
        await PlaybackManager.playFromOptions({
            items: [item('a'), item('b'), item('c')],
            startIndex: 0
        });

        PlaybackManager.enqueueNext([item('x'), item('y')]);

        expect(remainingIds()).toStrictEqual(['x', 'y', 'b', 'c']);
    });

    test('inserts after the current item when it is not the first one', async () => {
        await PlaybackManager.playFromOptions({
            items: [item('a'), item('b'), item('c')],
            startIndex: 1
        });

        PlaybackManager.enqueueNext([item('x')]);

        expect(remainingIds()).toStrictEqual(['x', 'c']);
    });

    test('appends when the current item is the last one', async () => {
        await PlaybackManager.playFromOptions({
            items: [item('a'), item('b')],
            startIndex: 1
        });

        PlaybackManager.enqueueNext([item('x')]);

        expect(remainingIds()).toStrictEqual(['x']);
    });

    test('starts an empty playlist with the items', () => {
        PlaybackManager.enqueueNext([item('x'), item('y')]);

        expect(remainingIds()).toStrictEqual(['x', 'y']);
    });
});

describe('enqueue', () => {
    beforeEach(() => {
        PlaybackManager.setPlayerManager({
            stop: vi.fn()
        } as unknown as framework.PlayerManager);
    });

    test('still appends to the end of the playlist', async () => {
        await PlaybackManager.playFromOptions({
            items: [item('a'), item('b')],
            startIndex: 0
        });

        PlaybackManager.enqueue(item('x'));

        expect(remainingIds()).toStrictEqual(['b', 'x']);
    });
});
