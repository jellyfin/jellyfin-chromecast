import { ajax } from './fetchhelper';
import { Dictionary } from '../types/global';

export abstract class JellyfinApi {
    // userId that we are connecting as currently
    public static userId: string | null = null;

    // Security token to prove authentication
    public static accessToken: string | null = null;

    // Address of server
    public static serverAddress: string | null = null;

    public static setServerInfo(
        userId: string,
        accessToken: string,
        serverAddress: string
    ) {
        console.debug(
            'JellyfinApi.setServerInfo: user:' +
                userId +
                ', token:' +
                accessToken +
                ', server:' +
                serverAddress
        );
        this.userId = userId;
        this.accessToken = accessToken;
        this.serverAddress = serverAddress;
    }

    // create the necessary headers for authentication
    private static getSecurityHeaders(): Dictionary<string> {
        // TODO throw error if this fails

        var auth =
            'Emby Client="Chromecast", Device="' +
            window.deviceInfo.deviceName +
            '", DeviceId="' +
            window.deviceInfo.deviceId +
            '", Version="' +
            window.deviceInfo.versionNumber +
            '"';

        if (this.userId) {
            auth += ', UserId="' + this.userId + '"';
        }

        var headers: Dictionary<string> = {
            Authorization: auth
        };

        if (this.accessToken != null)
            headers['X-MediaBrowser-Token'] = this.accessToken;

        return headers;
    }

    // Create a basic url.
    // Cannot start with /.
    public static createUrl(path: string): string {
        // Remove leading slashes
        while (path.charAt(0) === '/') path = path.substring(1);

        return this.serverAddress + '/' + path;
    }

    // create a path in /Users/userId/ <path>
    public static createUserUrl(path: string | null = null): string {
        if (path) {
            return this.createUrl('Users/' + this.userId + '/' + path);
        } else {
            return this.createUrl('Users/' + this.userId);
        }
    }

    // Authenticated ajax
    public static authAjax(url: string, args: any): Promise<any> {
        const params = {
            url: url,
            headers: this.getSecurityHeaders()
        };

        return ajax({ ...params, ...args });
    }
}
