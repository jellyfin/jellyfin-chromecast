export interface ServerCredential {
    apiKey?: string;
    accessToken?: string;
    serverBasePath?: string;
}

interface CredentialStore {
    [id: string]: ServerCredential;
}

export class credentialManager {
    /**
     * Store for credentials
     * @private
     */
    private credentialStore: CredentialStore;

    /**
     * Default constructor for credentialManager.
     * @param initialStore - Existing CredentialStore to initialize private store with.
     */
    constructor(initialStore: CredentialStore = {}) {
        this.credentialStore = initialStore;
    }

    /**
     * Get credentials for the provided server ID.
     * @param serverId - ID of the server the credentials belong to.
     * @returns Credentials for the provided server ID.
     * or undefined if the store has no server with that ID.
     */
    get(serverId: string): ServerCredential | undefined {
        if (serverId in this.credentialStore) {
            return this.credentialStore[serverId];
        }
    }

    /**
     * Update credentials for the provided server ID.
     * @param serverId - ID of the server to update.
     * @param newCredentials - Updated Credentials.
     * @returns True if the value was updated, false if it wasn't.
     */
    update(serverId: string, newCredentials: ServerCredential): boolean {
        if (serverId in this.credentialStore) {
            this.credentialStore[serverId] = newCredentials;

            return true;
        }

        return false;
    }

    /**
     * Add a new credential to store. Only accepts new entries.
     * @param serverId - ID of the server the credentials belong to.
     * @param credentials - Credentials of the server.
     * @returns True if server was added, false if it wasn't.
     */
    add(serverId: string, credentials: ServerCredential): boolean {
        if (serverId in this.credentialStore) {
            return false;
        }

        this.credentialStore[serverId] = credentials;

        return true;
    }

    /**
     * Remove a credential from store.
     * @param serverId - ID of the server the credentials belong to.
     * @returns True if server was removed, false if it wasn't.
     */
    remove(serverId: string): boolean {
        if (serverId in this.credentialStore) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete this.credentialStore[serverId];

            return true;
        }

        return false;
    }
}
