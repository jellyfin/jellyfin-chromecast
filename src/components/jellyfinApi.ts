import { ajax } from './fetchhelper';
import { Dictionary } from '~/types/global';

export abstract class JellyfinApi {
    // userId that we are connecting as currently
    public static userId: string | null = null;

    // Security token to prove authentication
    public static accessToken: string | null = null;

    // Address of server
    public static serverAddress: string | null = null;

    // device name
    public static deviceName = 'Google Cast';

    // unique id
    public static deviceId = '';

    // version
    public static versionNumber = RECEIVERVERSION;

    public static setServerInfo(
        userId: string,
        accessToken: string,
        serverAddress: string,
        receiverName = ''
    ): void {
        console.debug(
            `JellyfinApi.setServerInfo: user:${userId}, token:${accessToken}, ` +
            `server:${serverAddress}, name:${receiverName}`
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
    }

    // create the necessary headers for authentication
    private static getSecurityHeaders(): Dictionary<string> {
        // TODO throw error if this fails

        let auth =
            `Jellyfin Client="Chromecast", Device="${this.deviceName}", ` +
            `DeviceId="${this.deviceId}", Version="${this.versionNumber}"`;

        if (this.userId) {
            auth += `, UserId="${this.userId}"`;
        }

        const headers: Dictionary<string> = {
            Authorization: auth
        };

        if (this.accessToken != null) {
            headers['X-MediaBrowser-Token'] = this.accessToken;
        }

        return headers;
    }

    // Create a basic url.
    // Cannot start with /.
    public static createUrl(path: string): string {
        if (this.serverAddress === null) {
            console.error('JellyfinApi.createUrl: no server address present');

            return '';
        }

        // Remove leading slashes
        while (path.charAt(0) === '/') {
            path = path.substring(1);
        }

        return `${this.serverAddress}/${path}`;
    }

    // create a path in /Users/userId/ <path>
    public static createUserUrl(path: string | null = null): string {
        if (path) {
            return this.createUrl(`Users/${this.userId}/${path}`);
        } else {
            return this.createUrl(`Users/${this.userId}`);
        }
    }

    /**
     * Create url to image
     *
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
    public static authAjax(path: string, args: any): Promise<any> {
        if (
            this.userId === null ||
            this.accessToken === null ||
            this.serverAddress === null
        ) {
            console.error(
                'JellyfinApi.authAjax: No userid/accesstoken/serverAddress present. Skipping request'
            );

            return Promise.reject('no server info present');
        }

        const params = {
            headers: this.getSecurityHeaders(),
            url: this.createUrl(path)
        };

        return ajax({ ...params, ...args });
    }

    // Authenticated ajax
    public static authAjaxUser(path: string, args: any): Promise<any> {
        if (
            this.userId === null ||
            this.accessToken === null ||
            this.serverAddress === null
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
