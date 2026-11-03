import { Api, Jellyfin } from '@jellyfin/sdk';
import { version as packageVersion } from '../../package.json';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export abstract class JellyfinApi {
    // Security token to prove authentication
    public static accessToken: string | undefined;

    // Address of server
    public static serverAddress: string | undefined;

    // device name
    public static deviceName = 'Google Cast';

    // unique id
    public static deviceId = '';

    // Jellyfin SDK
    private static jellyfinSdk: Jellyfin | undefined;

    // Jellyfin API
    public static jellyfinApi: Api;

    public static setServerInfo(
        accessToken?: string,
        serverAddress?: string,
        receiverName = ''
    ): void {
        const regenApi =
            this.accessToken !== accessToken ||
            this.serverAddress !== serverAddress;

        console.debug(
            `JellyfinApi.setServerInfo: server:${serverAddress}, name:${receiverName}`
        );
        this.accessToken = accessToken;
        this.serverAddress = serverAddress;

        if (receiverName) {
            // remove special characters from the receiver name
            receiverName = receiverName.replace(/[^\w\s]/gi, '');

            this.deviceName = receiverName;
            // deviceId just needs to be unique-ish
            this.deviceId = btoa(receiverName);
        } else if (!this.deviceId) {
            // A message without a name keeps the identity an earlier one gave.
            const senders =
                cast.framework.CastReceiverContext.getInstance().getSenders();

            this.deviceName = 'Google Cast';
            this.deviceId =
                senders.length !== 0 && senders[0].id
                    ? senders[0].id
                    : new Date().getTime().toString();
        }

        // The SDK carries the device into every request, so a new name needs a
        // new SDK and API.
        const deviceChanged =
            this.jellyfinSdk?.deviceInfo.id !== this.deviceId ||
            this.jellyfinSdk.deviceInfo.name !== this.deviceName;

        if (!this.jellyfinSdk || deviceChanged) {
            this.jellyfinSdk = new Jellyfin({
                clientInfo: {
                    name: 'Chromecast',
                    version: packageVersion
                },
                deviceInfo: {
                    id: this.deviceId,
                    name: this.deviceName
                }
            });
        }

        if (!this.jellyfinApi || regenApi || deviceChanged) {
            if (serverAddress && accessToken) {
                this.jellyfinApi = this.jellyfinSdk.createApi(
                    serverAddress,
                    accessToken
                );
            } else {
                console.error(
                    'Server address or access token not provided - could not create instance of Jellyfin API'
                );
            }
        }
    }

    // Create a basic url.
    // Cannot start with /.
    public static createUrl(path: string): string {
        if (this.serverAddress === undefined) {
            console.error('JellyfinApi.createUrl: no server address present');

            return '';
        }

        // Remove leading slashes
        while (path.startsWith('/')) {
            path = path.substring(1);
        }

        return `${this.serverAddress}/${path}`;
    }

    /**
     * Create url to image
     * @param itemId - Item id
     * @param imgType - Image type: Primary, Logo, Backdrop
     * @param imgTag - Image tag
     * @param imgIdx - Image index, default 0
     * @returns URL
     */
    public static createImageUrl(
        itemId: string,
        imgType: string,
        imgTag: string,
        imgIdx = 0
    ): string {
        return this.createUrl(
            `Items/${itemId}/Images/${imgType}/${imgIdx.toString()}?tag=${imgTag}`
        );
    }
}
