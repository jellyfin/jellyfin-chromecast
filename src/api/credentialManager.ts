import { Configuration } from './generated/configuration';

interface CredentialStore {
    [id: string]: Configuration;
}

export class credentialManager {
    /**
     * Store for credentials
     *
     * @private
     */
    private credentialStore: CredentialStore = {};

    /**
     * Get credentials for the provided server ID
     *
     * @param serverId - ID of the server the credentials belong to
     * @returns Credentials for the provided server ID or undefined if the store has no server with that ID
     */
    get(serverId: string): Configuration | undefined {
        if (serverId in this.credentialStore) {
            return this.credentialStore[serverId];
        }
    }

    /**
     * Update credentials for the provided server ID
     *
     * @param serverId - ID of the server to update
     * @param newConfig - Updated Credentials
     * @returns True if the value was updated, false if it wasn't
     */
    update(serverId: string, newConfig: Configuration): boolean {
        if (serverId in this.credentialStore) {
            this.credentialStore[serverId] = newConfig;

            return true;
        }

        return false;
    }

    /**
     * Add a new credential to store. Only accepts new entries.
     *
     * @param serverId - ID of the server the credentials belong to
     * @param configuration - Credentials of the server
     * @returns True if server was added, false if it wasn't
     */
    add(serverId: string, configuration: Configuration): boolean {
        if (serverId in this.credentialStore) {
            return false;
        }

        this.credentialStore[serverId] = configuration;

        return true;
    }

    /**
     * Add a new credential to store. Only accepts new entries.
     *
     * @param serverId - ID of the server the credentials belong to
     * @returns True if server was added, false if it wasn't
     */
    remove(serverId: string): boolean {
        if (serverId in this.credentialStore) {
            delete this.credentialStore[serverId];

            return true;
        }

        return false;
    }
}
