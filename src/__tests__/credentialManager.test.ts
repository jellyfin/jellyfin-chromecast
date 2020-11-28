import { Configuration } from "../api/generated/configuration";

import {
    credentialManager,
    CredentialStore
} from "../api/credentialManager";

const serverId1 = "f4486b851af24255b3305fe614b81f01";
const serverConfig1: Configuration = {
    apiKey: "b49268e51af24255b3305fe614b81f01"
};

const serverId2 = "af72hb851af24255b3305fe614b81f01";
const serverConfig2: Configuration = {
    apiKey: "d4286b8119f24a55b3305fe614b81f01"
};

describe("Getting servers from credentialManager", () => {
    let credentialMgr: credentialManager;

    beforeEach(() => {
        credentialMgr = new credentialManager({
            [serverId1]: serverConfig1
        });
    });

    test("Get existing server from store", () => {
        expect(credentialMgr.get(serverId1)).toEqual(serverConfig1);
    });

    test("Get non-existant server from store", () => {
        expect(credentialMgr.get(serverId2)).toBeUndefined();
    });
});

describe("Updating servers in credentialManager", () => {
    let credentialMgr: credentialManager;

    beforeEach(() => {
        credentialMgr = new credentialManager({
            [serverId1]: serverConfig1
        });
    });

    test("Update existing server in store", () => {
        expect(credentialMgr.update(serverId1, serverConfig1)).toBeTruthy();
    });

    test("Update non-existant server in store", () => {
        expect(credentialMgr.update(serverId2, serverConfig2)).toBeFalsy();
    });
});

describe("Adding servers to credentialManager", () => {
    let credentialMgr: credentialManager;

    beforeEach(() => {
        credentialMgr = new credentialManager({
            [serverId1]: serverConfig1
        });
    });

    test("Add server id to store", () => {
        expect(credentialMgr.add(serverId2, serverConfig2)).toBeTruthy();
    });

    test("Add existing server configuration to store", () => {
        expect(credentialMgr.add(serverId1, serverConfig1)).toBeFalsy();
    });
});

describe("Removing server from credentialManager", () => {
    let credentialMgr: credentialManager;

    beforeEach(() => {
        credentialMgr = new credentialManager({
            [serverId1]: serverConfig1
        });
    });

    test("Remove existing server from store", () => {
        expect(credentialMgr.remove(serverId1)).toBeTruthy();
    });

    test("Remove non-existant server from store", () => {
        expect(credentialMgr.remove(serverId2)).toBeFalsy();
    });
});
