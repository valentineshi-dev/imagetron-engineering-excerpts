'use strict';

import type { AxiosRequestConfig, RawAxiosRequestHeaders } from 'axios';
import { EHTTPMethods } from 'http-convenience-pack';

import type AxiosAPITransport from './AxiosAPITransport.js';
import type { TPayload } from './AbstractAPITransport.js';
import type APIResponseNormalizedVO from './APIResponseNormalized.valueobject.js';

export default abstract class AbstractAPIFacade {

    protected _transport: AxiosAPITransport;

    constructor(transport: AxiosAPITransport) {
        this._transport = transport;
    }

    /**
     * Makes an API call using the specified HTTP verb and path, and handles the response.
     *
     * @template GResponseData - The expected data type of the API response.
     * 
     * @param {EHTTPVerb} verb - The HTTP verb to use for the API request (e.g., GET, POST, PUT).
     * @param {string} path - The API endpoint path.
     * @param {TPayload} [payload] - The request payload, if applicable (used in POST, PUT, etc.).
     * @param {RawAxiosRequestHeaders} [headers] - Optional request headers.
     * @param {AxiosRequestConfig} [customConfig={}] - Optional custom Axios request configuration.
     * 
     * @returns {Promise<APIResponseNormalizedVO<GResponseData>>} - A promise that resolves with the normalized API response.
     */
    protected async call<GResponseData>(method: EHTTPMethods, path: string, payload?: TPayload, headers?: RawAxiosRequestHeaders, customConfig: AxiosRequestConfig = {}): Promise<APIResponseNormalizedVO<GResponseData>> {
        const response = await this._transport.call<GResponseData>(method, path, payload, headers, customConfig);

        return response;
    }

}