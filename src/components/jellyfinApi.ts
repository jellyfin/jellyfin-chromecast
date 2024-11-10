import { Api, Jellyfin } from '@jellyfin/sdk';
import axios from 'axios';
import { version as packageVersion } from '../../package.json';
import { ajax } from './fetchhelper';

axios.interceptors.request.use((request) => {
    console.log(`requesting url: ${request.url}`);

    return request;
});

axios.interceptors.response.use(
    (response) => {
        console.log(
            `response status: ${response.status}, url: ${response.request.responseURL}`
        );

        return response;
    },
    // eslint-disable-next-line promise/prefer-await-to-callbacks
    (error) => {
        console.log(`request failed to url: ${error.request.url}`);
        throw error;
    }
);

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export abstract class JellyfinApi {
    // userId that we are connecting as currently
    public static userId: string | undefined;

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
        userId?: string,
        accessToken?: string,
        serverAddress?: string,
        receiverName = ''
    ): void {
        const regenApi =
            this.accessToken !== accessToken ||
            this.serverAddress !== serverAddress;

        console.debug(
            `JellyfinApi.setServerInfo: user:${userId}, token:${accessToken}, server:${serverAddress}, name:${receiverName}`
        );
        this.userId = userId;
        this.accessToken = accessToken;
        this.serverAddress = serverAddress;

        if (receiverName) {
            // remove special characters from the receiver name
            receiverName = receiverName.replace(/[^\w\s]/gi, '');

            this.deviceName = receiverName;
            // deviceId just needs to be unique-ish
            this.deviceId = btoa(receiverName);
        } else {
            const senders =
                cast.framework.CastReceiverContext.getInstance().getSenders();

            this.deviceName = 'Google Cast';
            this.deviceId =
                senders.length !== 0 && senders[0].id
                    ? senders[0].id
                    : new Date().getTime().toString();
        }

        if (!this.jellyfinSdk) {
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

        if (!this.jellyfinApi || regenApi) {
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

    // create the necessary headers for authentication
    private static getSecurityHeaders(): { Authorization?: string } {
        const parameters: Record<string, string> = {
            Client: 'Chromecast',
            Version: packageVersion
        };

        if (this.accessToken) {
            parameters.Token = this.accessToken;
        }

        if (this.deviceId) {
            parameters.DeviceId = this.deviceId;
        }

        if (this.deviceName) {
            parameters.Device = this.deviceName;
        }

        let header = 'MediaBrowser';

        for (const [key, value] of Object.entries(parameters)) {
            header += ` ${key}="${encodeURIComponent(value)}", `;
        }

        // Remove last comma
        header = header.substring(0, header.length - 2);

        return {
            Authorization: header
        };
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

    // create a path in /Users/userId/ <path>
    public static createUserUrl(path: string | null = null): string {
        if (path) {
            // Remove leading slashes
            while (path.startsWith('/')) {
                path = path.substring(1);
            }

            return this.createUrl(`Users/${this.userId}/${path}`);
        } else {
            return this.createUrl(`Users/${this.userId}`);
        }
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

    // Authenticated ajax
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static authAjaxUser(path: string, args: any): Promise<any> {
        if (
            this.userId === undefined ||
            this.accessToken === undefined ||
            this.serverAddress === undefined
        ) {
            console.error(
                'JellyfinApi.authAjaxUser: No userid/accesstoken/serverAddress present. Skipping request'
            );

            return Promise.reject('no server info present');
        }

        const params = {
            headers: this.getSecurityHeaders(),
            url: this.createUserUrl(path)
        };

        return ajax({ ...params, ...args });
    }
}
