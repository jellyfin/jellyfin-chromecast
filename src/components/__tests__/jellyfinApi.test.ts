import { JellyfinApi } from '../jellyfinApi';

const setupMockCastSenders = (): void => {
    const getSenders = (): Array<any> => [{ id: 'thisIsSenderId' }]; // eslint-disable-line no-explicit-any
    const getInstance = (): any => ({ getSenders }); // eslint-disable-line no-explicit-any

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

describe('test authenticated ajax', () => {
    beforeAll(() => {
        setupMockCastSenders();
    });

    test('should return rejected promise when server info is undefined', async () => {
        // Linting requires this weird spacing.
        JellyfinApi.setServerInfo(undefined, '', '');

        const resultUserIdIsNull = JellyfinApi.authAjax('', {});

        JellyfinApi.setServerInfo('', undefined, '');

        const resultAccessTokenIsNull = JellyfinApi.authAjax('', {});

        JellyfinApi.setServerInfo('', '', undefined);

        const resultServerAddressIsNull = JellyfinApi.authAjax('', {});

        await expect(resultUserIdIsNull).rejects.toEqual(
            'no server info present'
        );
        await expect(resultAccessTokenIsNull).rejects.toEqual(
            'no server info present'
        );
        await expect(resultServerAddressIsNull).rejects.toEqual(
            'no server info present'
        );
    });
});

describe('test authenticated user ajax', () => {
    test('should return rejected promise when server info is undefined', async () => {
        // Linting requires this weird spacing.
        JellyfinApi.setServerInfo(undefined, '', '');

        const resultUserIdIsNull = JellyfinApi.authAjaxUser('', {});

        JellyfinApi.setServerInfo('', undefined, '');

        const resultAccessTokenIsNull = JellyfinApi.authAjaxUser('', {});

        JellyfinApi.setServerInfo('', '');

        const resultServerAddressIsNull = JellyfinApi.authAjaxUser('', {});

        await expect(resultUserIdIsNull).rejects.toEqual(
            'no server info present'
        );
        await expect(resultAccessTokenIsNull).rejects.toEqual(
            'no server info present'
        );
        await expect(resultServerAddressIsNull).rejects.toEqual(
            'no server info present'
        );
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
        const correctAuth = `Jellyfin Client="Chromecast", Device="thisIsReceiverName", DeviceId="${btoa(
            'thisIsReceiverName'
        )}", Version="thisIsVersionNumber", UserId="thisIsUserId"`;

        expect(result).toHaveProperty('X-MediaBrowser-Token');
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
            Authorization: `Jellyfin Client="Chromecast", Device="Google Cast", DeviceId="thisIsSenderId", Version="thisIsVersionNumber"`
        };

        expect(result).toMatchObject(correct);
    });
});
