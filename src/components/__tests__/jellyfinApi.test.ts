import { describe, beforeAll, beforeEach, test, expect } from 'vitest';
import { JellyfinApi } from '../jellyfinApi';
import { version } from '../../../package.json';

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

describe('creating user urls', () => {
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
        const result = JellyfinApi.createUserUrl('somePath');
        const correct = 'thisIsServerAddress/Users/thisIsUserId/somePath';

        expect(result).toEqual(correct);
    });

    test('should remove leading slashes', () => {
        const result = JellyfinApi.createUserUrl('////////somePath');
        const correct = 'thisIsServerAddress/Users/thisIsUserId/somePath';

        expect(result).toEqual(correct);
    });

    test('should return empty string on undefined serverAddress', () => {
        JellyfinApi.setServerInfo();

        const result = JellyfinApi.createUserUrl('somePath');
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

describe('getting security headers', () => {
    beforeAll(() => {
        setupMockCastSenders();
    });

    test('should return correct auth header with all server details set', () => {
        JellyfinApi.setServerInfo(
            'thisIsUserId',
            'thisIsAccessToken',
            'thisIsServerAddress',
            'thisIsReceiverName'
        );

        // @ts-expect-error Since the method is private.
        const result = JellyfinApi.getSecurityHeaders();
        const correctAuth = `MediaBrowser Client="Chromecast",  Version="${version}",  Token="thisIsAccessToken",  DeviceId="${btoa(
            'thisIsReceiverName'
        )}",  Device="thisIsReceiverName"`;

        expect(result).toHaveProperty('Authorization');
        expect(result.Authorization).toMatch(correctAuth);
    });

    test('should return correct auth header with minimal server details set', () => {
        JellyfinApi.setServerInfo(
            undefined,
            'thisIsAccessToken',
            'thisIsServerAddress'
        );

        // @ts-expect-error Since the method is private.
        const result = JellyfinApi.getSecurityHeaders();
        const correct = {
            Authorization: `MediaBrowser Client="Chromecast",  Version="${version}",  Token="thisIsAccessToken",  DeviceId="thisIsSenderId",  Device="Google%20Cast"`
        };

        expect(result).toMatchObject(correct);
    });
});
