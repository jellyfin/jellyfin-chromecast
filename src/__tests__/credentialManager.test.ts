import { describe, beforeEach, test, expect } from 'vitest';

import {
    credentialManager,
    ServerCredential
} from '../components/credentialManager';

const serverId1 = 'f4486b851af24255b3305fe614b81f01';
const serverConfig1: ServerCredential = {
    apiKey: 'b49268e51af24255b3305fe614b81f01'
};

const serverId2 = 'af72hb851af24255b3305fe614b81f01';
const serverConfig2: ServerCredential = {
    apiKey: 'd4286b8119f24a55b3305fe614b81f01'
};

describe('getting servers from credentialManager', () => {
    let credentialMgr: credentialManager;

    beforeEach(() => {
        credentialMgr = new credentialManager({
            [serverId1]: serverConfig1
        });
    });

    test('get existing server from store', () => {
        expect(credentialMgr.get(serverId1)).toEqual(serverConfig1);
    });

    test('get non-existant server from store', () => {
        expect(credentialMgr.get(serverId2)).toBeUndefined();
    });
});

describe('updating servers in credentialManager', () => {
    let credentialMgr: credentialManager;

    beforeEach(() => {
        credentialMgr = new credentialManager({
            [serverId1]: serverConfig1
        });
    });

    test('update existing server in store', () => {
        expect(credentialMgr.update(serverId1, serverConfig1)).toBeTruthy();
    });

    test('update non-existant server in store', () => {
        expect(credentialMgr.update(serverId2, serverConfig2)).toBeFalsy();
    });
});

describe('adding servers to credentialManager', () => {
    let credentialMgr: credentialManager;

    beforeEach(() => {
        credentialMgr = new credentialManager({
            [serverId1]: serverConfig1
        });
    });

    test('add server id to store', () => {
        expect(credentialMgr.add(serverId2, serverConfig2)).toBeTruthy();
    });

    test('add existing server configuration to store', () => {
        expect(credentialMgr.add(serverId1, serverConfig1)).toBeFalsy();
    });
});

describe('removing server from credentialManager', () => {
    let credentialMgr: credentialManager;

    beforeEach(() => {
        credentialMgr = new credentialManager({
            [serverId1]: serverConfig1
        });
    });

    test('remove existing server from store', () => {
        expect(credentialMgr.remove(serverId1)).toBeTruthy();
    });

    test('remove non-existant server from store', () => {
        expect(credentialMgr.remove(serverId2)).toBeFalsy();
    });
});
