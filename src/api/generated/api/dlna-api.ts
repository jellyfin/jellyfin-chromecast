/* tslint:disable */
/* eslint-disable */
/**
 * Jellyfin API
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: v1
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */


import globalAxios, { AxiosPromise, AxiosInstance } from 'axios';
import { Configuration } from '../configuration';
// Some imports not used depending on template conditions
// @ts-ignore
import { BASE_PATH, COLLECTION_FORMATS, RequestArgs, BaseAPI, RequiredError } from '../base';
// @ts-ignore
import { DeviceProfile } from '../models';
// @ts-ignore
import { DeviceProfileInfo } from '../models';
// @ts-ignore
import { ProblemDetails } from '../models';
/**
 * DlnaApi - axios parameter creator
 * @export
 */
export const DlnaApiAxiosParamCreator = function (configuration?: Configuration) {
    return {
        /**
         * 
         * @summary Creates a profile.
         * @param {DeviceProfile} [deviceProfile] Device profile.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        createProfile: async (deviceProfile?: DeviceProfile, options: any = {}): Promise<RequestArgs> => {
            const localVarPath = `/Dlna/Profiles`;
            // use dummy base URL string because the URL constructor only accepts absolute URLs.
            const localVarUrlObj = new URL(localVarPath, 'https://example.com');
            let baseOptions;
            if (configuration) {
                baseOptions = configuration.baseOptions;
            }
            const localVarRequestOptions = { method: 'POST', ...baseOptions, ...options};
            const localVarHeaderParameter = {} as any;
            const localVarQueryParameter = {} as any;

            // authentication CustomAuthentication required
            if (configuration && configuration.apiKey) {
                const localVarApiKeyValue = typeof configuration.apiKey === 'function'
                    ? await configuration.apiKey("X-Emby-Authorization")
                    : await configuration.apiKey;
                localVarHeaderParameter["X-Emby-Authorization"] = localVarApiKeyValue;
            }


    
            localVarHeaderParameter['Content-Type'] = 'application/json';

            const query = new URLSearchParams(localVarUrlObj.search);
            for (const key in localVarQueryParameter) {
                query.set(key, localVarQueryParameter[key]);
            }
            for (const key in options.query) {
                query.set(key, options.query[key]);
            }
            localVarUrlObj.search = (new URLSearchParams(query)).toString();
            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
            localVarRequestOptions.headers = {...localVarHeaderParameter, ...headersFromBaseOptions, ...options.headers};
            const needsSerialization = (typeof deviceProfile !== "string") || localVarRequestOptions.headers['Content-Type'] === 'application/json';
            localVarRequestOptions.data =  needsSerialization ? JSON.stringify(deviceProfile !== undefined ? deviceProfile : {}) : (deviceProfile || "");

            return {
                url: localVarUrlObj.pathname + localVarUrlObj.search + localVarUrlObj.hash,
                options: localVarRequestOptions,
            };
        },
        /**
         * 
         * @summary Deletes a profile.
         * @param {string} profileId Profile id.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        deleteProfile: async (profileId: string, options: any = {}): Promise<RequestArgs> => {
            // verify required parameter 'profileId' is not null or undefined
            if (profileId === null || profileId === undefined) {
                throw new RequiredError('profileId','Required parameter profileId was null or undefined when calling deleteProfile.');
            }
            const localVarPath = `/Dlna/Profiles/{profileId}`
                .replace(`{${"profileId"}}`, encodeURIComponent(String(profileId)));
            // use dummy base URL string because the URL constructor only accepts absolute URLs.
            const localVarUrlObj = new URL(localVarPath, 'https://example.com');
            let baseOptions;
            if (configuration) {
                baseOptions = configuration.baseOptions;
            }
            const localVarRequestOptions = { method: 'DELETE', ...baseOptions, ...options};
            const localVarHeaderParameter = {} as any;
            const localVarQueryParameter = {} as any;

            // authentication CustomAuthentication required
            if (configuration && configuration.apiKey) {
                const localVarApiKeyValue = typeof configuration.apiKey === 'function'
                    ? await configuration.apiKey("X-Emby-Authorization")
                    : await configuration.apiKey;
                localVarHeaderParameter["X-Emby-Authorization"] = localVarApiKeyValue;
            }


    
            const query = new URLSearchParams(localVarUrlObj.search);
            for (const key in localVarQueryParameter) {
                query.set(key, localVarQueryParameter[key]);
            }
            for (const key in options.query) {
                query.set(key, options.query[key]);
            }
            localVarUrlObj.search = (new URLSearchParams(query)).toString();
            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
            localVarRequestOptions.headers = {...localVarHeaderParameter, ...headersFromBaseOptions, ...options.headers};

            return {
                url: localVarUrlObj.pathname + localVarUrlObj.search + localVarUrlObj.hash,
                options: localVarRequestOptions,
            };
        },
        /**
         * 
         * @summary Gets the default profile.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        getDefaultProfile: async (options: any = {}): Promise<RequestArgs> => {
            const localVarPath = `/Dlna/Profiles/Default`;
            // use dummy base URL string because the URL constructor only accepts absolute URLs.
            const localVarUrlObj = new URL(localVarPath, 'https://example.com');
            let baseOptions;
            if (configuration) {
                baseOptions = configuration.baseOptions;
            }
            const localVarRequestOptions = { method: 'GET', ...baseOptions, ...options};
            const localVarHeaderParameter = {} as any;
            const localVarQueryParameter = {} as any;

            // authentication CustomAuthentication required
            if (configuration && configuration.apiKey) {
                const localVarApiKeyValue = typeof configuration.apiKey === 'function'
                    ? await configuration.apiKey("X-Emby-Authorization")
                    : await configuration.apiKey;
                localVarHeaderParameter["X-Emby-Authorization"] = localVarApiKeyValue;
            }


    
            const query = new URLSearchParams(localVarUrlObj.search);
            for (const key in localVarQueryParameter) {
                query.set(key, localVarQueryParameter[key]);
            }
            for (const key in options.query) {
                query.set(key, options.query[key]);
            }
            localVarUrlObj.search = (new URLSearchParams(query)).toString();
            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
            localVarRequestOptions.headers = {...localVarHeaderParameter, ...headersFromBaseOptions, ...options.headers};

            return {
                url: localVarUrlObj.pathname + localVarUrlObj.search + localVarUrlObj.hash,
                options: localVarRequestOptions,
            };
        },
        /**
         * 
         * @summary Gets a single profile.
         * @param {string} profileId Profile Id.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        getProfile: async (profileId: string, options: any = {}): Promise<RequestArgs> => {
            // verify required parameter 'profileId' is not null or undefined
            if (profileId === null || profileId === undefined) {
                throw new RequiredError('profileId','Required parameter profileId was null or undefined when calling getProfile.');
            }
            const localVarPath = `/Dlna/Profiles/{profileId}`
                .replace(`{${"profileId"}}`, encodeURIComponent(String(profileId)));
            // use dummy base URL string because the URL constructor only accepts absolute URLs.
            const localVarUrlObj = new URL(localVarPath, 'https://example.com');
            let baseOptions;
            if (configuration) {
                baseOptions = configuration.baseOptions;
            }
            const localVarRequestOptions = { method: 'GET', ...baseOptions, ...options};
            const localVarHeaderParameter = {} as any;
            const localVarQueryParameter = {} as any;

            // authentication CustomAuthentication required
            if (configuration && configuration.apiKey) {
                const localVarApiKeyValue = typeof configuration.apiKey === 'function'
                    ? await configuration.apiKey("X-Emby-Authorization")
                    : await configuration.apiKey;
                localVarHeaderParameter["X-Emby-Authorization"] = localVarApiKeyValue;
            }


    
            const query = new URLSearchParams(localVarUrlObj.search);
            for (const key in localVarQueryParameter) {
                query.set(key, localVarQueryParameter[key]);
            }
            for (const key in options.query) {
                query.set(key, options.query[key]);
            }
            localVarUrlObj.search = (new URLSearchParams(query)).toString();
            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
            localVarRequestOptions.headers = {...localVarHeaderParameter, ...headersFromBaseOptions, ...options.headers};

            return {
                url: localVarUrlObj.pathname + localVarUrlObj.search + localVarUrlObj.hash,
                options: localVarRequestOptions,
            };
        },
        /**
         * 
         * @summary Get profile infos.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        getProfileInfos: async (options: any = {}): Promise<RequestArgs> => {
            const localVarPath = `/Dlna/ProfileInfos`;
            // use dummy base URL string because the URL constructor only accepts absolute URLs.
            const localVarUrlObj = new URL(localVarPath, 'https://example.com');
            let baseOptions;
            if (configuration) {
                baseOptions = configuration.baseOptions;
            }
            const localVarRequestOptions = { method: 'GET', ...baseOptions, ...options};
            const localVarHeaderParameter = {} as any;
            const localVarQueryParameter = {} as any;

            // authentication CustomAuthentication required
            if (configuration && configuration.apiKey) {
                const localVarApiKeyValue = typeof configuration.apiKey === 'function'
                    ? await configuration.apiKey("X-Emby-Authorization")
                    : await configuration.apiKey;
                localVarHeaderParameter["X-Emby-Authorization"] = localVarApiKeyValue;
            }


    
            const query = new URLSearchParams(localVarUrlObj.search);
            for (const key in localVarQueryParameter) {
                query.set(key, localVarQueryParameter[key]);
            }
            for (const key in options.query) {
                query.set(key, options.query[key]);
            }
            localVarUrlObj.search = (new URLSearchParams(query)).toString();
            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
            localVarRequestOptions.headers = {...localVarHeaderParameter, ...headersFromBaseOptions, ...options.headers};

            return {
                url: localVarUrlObj.pathname + localVarUrlObj.search + localVarUrlObj.hash,
                options: localVarRequestOptions,
            };
        },
        /**
         * 
         * @summary Updates a profile.
         * @param {string} profileId Profile id.
         * @param {DeviceProfile} [deviceProfile] Device profile.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        updateProfile: async (profileId: string, deviceProfile?: DeviceProfile, options: any = {}): Promise<RequestArgs> => {
            // verify required parameter 'profileId' is not null or undefined
            if (profileId === null || profileId === undefined) {
                throw new RequiredError('profileId','Required parameter profileId was null or undefined when calling updateProfile.');
            }
            const localVarPath = `/Dlna/Profiles/{profileId}`
                .replace(`{${"profileId"}}`, encodeURIComponent(String(profileId)));
            // use dummy base URL string because the URL constructor only accepts absolute URLs.
            const localVarUrlObj = new URL(localVarPath, 'https://example.com');
            let baseOptions;
            if (configuration) {
                baseOptions = configuration.baseOptions;
            }
            const localVarRequestOptions = { method: 'POST', ...baseOptions, ...options};
            const localVarHeaderParameter = {} as any;
            const localVarQueryParameter = {} as any;

            // authentication CustomAuthentication required
            if (configuration && configuration.apiKey) {
                const localVarApiKeyValue = typeof configuration.apiKey === 'function'
                    ? await configuration.apiKey("X-Emby-Authorization")
                    : await configuration.apiKey;
                localVarHeaderParameter["X-Emby-Authorization"] = localVarApiKeyValue;
            }


    
            localVarHeaderParameter['Content-Type'] = 'application/json';

            const query = new URLSearchParams(localVarUrlObj.search);
            for (const key in localVarQueryParameter) {
                query.set(key, localVarQueryParameter[key]);
            }
            for (const key in options.query) {
                query.set(key, options.query[key]);
            }
            localVarUrlObj.search = (new URLSearchParams(query)).toString();
            let headersFromBaseOptions = baseOptions && baseOptions.headers ? baseOptions.headers : {};
            localVarRequestOptions.headers = {...localVarHeaderParameter, ...headersFromBaseOptions, ...options.headers};
            const needsSerialization = (typeof deviceProfile !== "string") || localVarRequestOptions.headers['Content-Type'] === 'application/json';
            localVarRequestOptions.data =  needsSerialization ? JSON.stringify(deviceProfile !== undefined ? deviceProfile : {}) : (deviceProfile || "");

            return {
                url: localVarUrlObj.pathname + localVarUrlObj.search + localVarUrlObj.hash,
                options: localVarRequestOptions,
            };
        },
    }
};

/**
 * DlnaApi - functional programming interface
 * @export
 */
export const DlnaApiFp = function(configuration?: Configuration) {
    return {
        /**
         * 
         * @summary Creates a profile.
         * @param {DeviceProfile} [deviceProfile] Device profile.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        async createProfile(deviceProfile?: DeviceProfile, options?: any): Promise<(axios?: AxiosInstance, basePath?: string) => AxiosPromise<void>> {
            const localVarAxiosArgs = await DlnaApiAxiosParamCreator(configuration).createProfile(deviceProfile, options);
            return (axios: AxiosInstance = globalAxios, basePath: string = BASE_PATH) => {
                const axiosRequestArgs = {...localVarAxiosArgs.options, url: basePath + localVarAxiosArgs.url};
                return axios.request(axiosRequestArgs);
            };
        },
        /**
         * 
         * @summary Deletes a profile.
         * @param {string} profileId Profile id.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        async deleteProfile(profileId: string, options?: any): Promise<(axios?: AxiosInstance, basePath?: string) => AxiosPromise<void>> {
            const localVarAxiosArgs = await DlnaApiAxiosParamCreator(configuration).deleteProfile(profileId, options);
            return (axios: AxiosInstance = globalAxios, basePath: string = BASE_PATH) => {
                const axiosRequestArgs = {...localVarAxiosArgs.options, url: basePath + localVarAxiosArgs.url};
                return axios.request(axiosRequestArgs);
            };
        },
        /**
         * 
         * @summary Gets the default profile.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        async getDefaultProfile(options?: any): Promise<(axios?: AxiosInstance, basePath?: string) => AxiosPromise<DeviceProfile>> {
            const localVarAxiosArgs = await DlnaApiAxiosParamCreator(configuration).getDefaultProfile(options);
            return (axios: AxiosInstance = globalAxios, basePath: string = BASE_PATH) => {
                const axiosRequestArgs = {...localVarAxiosArgs.options, url: basePath + localVarAxiosArgs.url};
                return axios.request(axiosRequestArgs);
            };
        },
        /**
         * 
         * @summary Gets a single profile.
         * @param {string} profileId Profile Id.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        async getProfile(profileId: string, options?: any): Promise<(axios?: AxiosInstance, basePath?: string) => AxiosPromise<DeviceProfile>> {
            const localVarAxiosArgs = await DlnaApiAxiosParamCreator(configuration).getProfile(profileId, options);
            return (axios: AxiosInstance = globalAxios, basePath: string = BASE_PATH) => {
                const axiosRequestArgs = {...localVarAxiosArgs.options, url: basePath + localVarAxiosArgs.url};
                return axios.request(axiosRequestArgs);
            };
        },
        /**
         * 
         * @summary Get profile infos.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        async getProfileInfos(options?: any): Promise<(axios?: AxiosInstance, basePath?: string) => AxiosPromise<Array<DeviceProfileInfo>>> {
            const localVarAxiosArgs = await DlnaApiAxiosParamCreator(configuration).getProfileInfos(options);
            return (axios: AxiosInstance = globalAxios, basePath: string = BASE_PATH) => {
                const axiosRequestArgs = {...localVarAxiosArgs.options, url: basePath + localVarAxiosArgs.url};
                return axios.request(axiosRequestArgs);
            };
        },
        /**
         * 
         * @summary Updates a profile.
         * @param {string} profileId Profile id.
         * @param {DeviceProfile} [deviceProfile] Device profile.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        async updateProfile(profileId: string, deviceProfile?: DeviceProfile, options?: any): Promise<(axios?: AxiosInstance, basePath?: string) => AxiosPromise<void>> {
            const localVarAxiosArgs = await DlnaApiAxiosParamCreator(configuration).updateProfile(profileId, deviceProfile, options);
            return (axios: AxiosInstance = globalAxios, basePath: string = BASE_PATH) => {
                const axiosRequestArgs = {...localVarAxiosArgs.options, url: basePath + localVarAxiosArgs.url};
                return axios.request(axiosRequestArgs);
            };
        },
    }
};

/**
 * DlnaApi - factory interface
 * @export
 */
export const DlnaApiFactory = function (configuration?: Configuration, basePath?: string, axios?: AxiosInstance) {
    return {
        /**
         * 
         * @summary Creates a profile.
         * @param {DeviceProfile} [deviceProfile] Device profile.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        createProfile(deviceProfile?: DeviceProfile, options?: any): AxiosPromise<void> {
            return DlnaApiFp(configuration).createProfile(deviceProfile, options).then((request) => request(axios, basePath));
        },
        /**
         * 
         * @summary Deletes a profile.
         * @param {string} profileId Profile id.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        deleteProfile(profileId: string, options?: any): AxiosPromise<void> {
            return DlnaApiFp(configuration).deleteProfile(profileId, options).then((request) => request(axios, basePath));
        },
        /**
         * 
         * @summary Gets the default profile.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        getDefaultProfile(options?: any): AxiosPromise<DeviceProfile> {
            return DlnaApiFp(configuration).getDefaultProfile(options).then((request) => request(axios, basePath));
        },
        /**
         * 
         * @summary Gets a single profile.
         * @param {string} profileId Profile Id.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        getProfile(profileId: string, options?: any): AxiosPromise<DeviceProfile> {
            return DlnaApiFp(configuration).getProfile(profileId, options).then((request) => request(axios, basePath));
        },
        /**
         * 
         * @summary Get profile infos.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        getProfileInfos(options?: any): AxiosPromise<Array<DeviceProfileInfo>> {
            return DlnaApiFp(configuration).getProfileInfos(options).then((request) => request(axios, basePath));
        },
        /**
         * 
         * @summary Updates a profile.
         * @param {string} profileId Profile id.
         * @param {DeviceProfile} [deviceProfile] Device profile.
         * @param {*} [options] Override http request option.
         * @throws {RequiredError}
         */
        updateProfile(profileId: string, deviceProfile?: DeviceProfile, options?: any): AxiosPromise<void> {
            return DlnaApiFp(configuration).updateProfile(profileId, deviceProfile, options).then((request) => request(axios, basePath));
        },
    };
};

/**
 * Request parameters for createProfile operation in DlnaApi.
 * @export
 * @interface DlnaApiCreateProfileRequest
 */
export interface DlnaApiCreateProfileRequest {
    /**
     * Device profile.
     * @type {DeviceProfile}
     * @memberof DlnaApiCreateProfile
     */
    readonly deviceProfile?: DeviceProfile
}

/**
 * Request parameters for deleteProfile operation in DlnaApi.
 * @export
 * @interface DlnaApiDeleteProfileRequest
 */
export interface DlnaApiDeleteProfileRequest {
    /**
     * Profile id.
     * @type {string}
     * @memberof DlnaApiDeleteProfile
     */
    readonly profileId: string
}

/**
 * Request parameters for getProfile operation in DlnaApi.
 * @export
 * @interface DlnaApiGetProfileRequest
 */
export interface DlnaApiGetProfileRequest {
    /**
     * Profile Id.
     * @type {string}
     * @memberof DlnaApiGetProfile
     */
    readonly profileId: string
}

/**
 * Request parameters for updateProfile operation in DlnaApi.
 * @export
 * @interface DlnaApiUpdateProfileRequest
 */
export interface DlnaApiUpdateProfileRequest {
    /**
     * Profile id.
     * @type {string}
     * @memberof DlnaApiUpdateProfile
     */
    readonly profileId: string

    /**
     * Device profile.
     * @type {DeviceProfile}
     * @memberof DlnaApiUpdateProfile
     */
    readonly deviceProfile?: DeviceProfile
}

/**
 * DlnaApi - object-oriented interface
 * @export
 * @class DlnaApi
 * @extends {BaseAPI}
 */
export class DlnaApi extends BaseAPI {
    /**
     * 
     * @summary Creates a profile.
     * @param {DlnaApiCreateProfileRequest} requestParameters Request parameters.
     * @param {*} [options] Override http request option.
     * @throws {RequiredError}
     * @memberof DlnaApi
     */
    public createProfile(requestParameters: DlnaApiCreateProfileRequest = {}, options?: any) {
        return DlnaApiFp(this.configuration).createProfile(requestParameters.deviceProfile, options).then((request) => request(this.axios, this.basePath));
    }

    /**
     * 
     * @summary Deletes a profile.
     * @param {DlnaApiDeleteProfileRequest} requestParameters Request parameters.
     * @param {*} [options] Override http request option.
     * @throws {RequiredError}
     * @memberof DlnaApi
     */
    public deleteProfile(requestParameters: DlnaApiDeleteProfileRequest, options?: any) {
        return DlnaApiFp(this.configuration).deleteProfile(requestParameters.profileId, options).then((request) => request(this.axios, this.basePath));
    }

    /**
     * 
     * @summary Gets the default profile.
     * @param {*} [options] Override http request option.
     * @throws {RequiredError}
     * @memberof DlnaApi
     */
    public getDefaultProfile(options?: any) {
        return DlnaApiFp(this.configuration).getDefaultProfile(options).then((request) => request(this.axios, this.basePath));
    }

    /**
     * 
     * @summary Gets a single profile.
     * @param {DlnaApiGetProfileRequest} requestParameters Request parameters.
     * @param {*} [options] Override http request option.
     * @throws {RequiredError}
     * @memberof DlnaApi
     */
    public getProfile(requestParameters: DlnaApiGetProfileRequest, options?: any) {
        return DlnaApiFp(this.configuration).getProfile(requestParameters.profileId, options).then((request) => request(this.axios, this.basePath));
    }

    /**
     * 
     * @summary Get profile infos.
     * @param {*} [options] Override http request option.
     * @throws {RequiredError}
     * @memberof DlnaApi
     */
    public getProfileInfos(options?: any) {
        return DlnaApiFp(this.configuration).getProfileInfos(options).then((request) => request(this.axios, this.basePath));
    }

    /**
     * 
     * @summary Updates a profile.
     * @param {DlnaApiUpdateProfileRequest} requestParameters Request parameters.
     * @param {*} [options] Override http request option.
     * @throws {RequiredError}
     * @memberof DlnaApi
     */
    public updateProfile(requestParameters: DlnaApiUpdateProfileRequest, options?: any) {
        return DlnaApiFp(this.configuration).updateProfile(requestParameters.profileId, requestParameters.deviceProfile, options).then((request) => request(this.axios, this.basePath));
    }
}
