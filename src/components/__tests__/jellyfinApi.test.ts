import { describe, beforeAll, beforeEach, test, expect } from 'vitest';
import { JellyfinApi } from '../jellyfinApi';

const setupMockCastSenders = (): void => {
    const getSenders = (): any[] => [{ id: 'thisIsSenderId' }]; // eslint-disable-line @typescript-eslint/no-explicit-any
    const getInstance = (): any => ({ getSenders }); // eslint-disable-line @typescript-eslint/no-explicit-any

    // @ts-expect-error cast is already defined globally, however since we're mocking it we need to redefine it.
    global.cast = {
        framework: {
            CastReceiverContext: {
                getInstance
            }
        }
    };
};

describe('creating basic urls', () => {
    beforeAll(() => {
        setupMockCastSenders();
    });

    beforeEach(() => {
        JellyfinApi.setServerInfo(
            'thisIsUserId',
            'thisIsAccessToken',
            'thisIsServerAddress'
        );
    });

    test('should return correct url', () => {
        const result = JellyfinApi.createUrl('somePath');
        const correct = 'thisIsServerAddress/somePath';

        expect(result).toEqual(correct);
    });

    test('should remove leading slashes', () => {
        const result = JellyfinApi.createUrl('///////somePath');
        const correct = 'thisIsServerAddress/somePath';

        expect(result).toEqual(correct);
    });

    test('should return empty string on undefined serverAddress', () => {
        JellyfinApi.setServerInfo();

        const result = JellyfinApi.createUrl('somePath');
        const correct = '';

        expect(result).toEqual(correct);
    });
});

describe('creating image urls', () => {
    beforeAll(() => {
        setupMockCastSenders();
    });

    beforeEach(() => {
        JellyfinApi.setServerInfo(
            'thisIsUserId',
            'thisIsAccessToken',
            'thisIsServerAddress'
        );
    });

    test('should return correct url with all parameters provided', () => {
        const itemId = '1';
        const imageType = 'Primary';
        const imageTag = 'sampleTag';
        const imdIdx = 0;

        const result = JellyfinApi.createImageUrl(
            itemId,
            imageType,
            imageTag,
            imdIdx
        );
        const correct = `thisIsServerAddress/Items/${itemId}/Images/${imageType}/${imdIdx.toString()}?tag=${imageTag}`;

        expect(result).toEqual(correct);
    });

    test('should return correct url with minimal parameters provided', () => {
        const itemId = '1';
        const imageType = 'Primary';
        const imageTag = 'sampleTag';
        const imdIdx = 0;

        const result = JellyfinApi.createImageUrl(itemId, imageType, imageTag);
        const correct = `thisIsServerAddress/Items/${itemId}/Images/${imageType}/${imdIdx.toString()}?tag=${imageTag}`;

        expect(result).toEqual(correct);
    });

    test('should return empty string on undefined serverAddress', () => {
        JellyfinApi.setServerInfo();

        const result = JellyfinApi.createImageUrl('', '', '');
        const correct = '';

        expect(result).toEqual(correct);
    });
});
