/**
 * Function to send a request, with or without the timeout option
 *
 * @param request - Custom request object, mostly modeled after RequestInit.
 * @returns response promise
 */
function getFetchPromise(request: any): Promise<Response> {
    const headers = request.headers || {};

    if (request.dataType === 'json') {
        headers.accept = 'application/json';
    }

    const fetchRequest: RequestInit = {
        credentials: 'same-origin',
        headers: headers,
        method: request.type
    };
    let contentType = request.contentType;

    if (request.data) {
        if (typeof request.data == 'string') {
            fetchRequest.body = request.data;
        } else {
            fetchRequest.body = paramsToString(request.data);
            contentType =
                contentType ||
                'application/x-www-form-urlencoded; charset=UTF-8';
        }
    }

    if (contentType) {
        headers['Content-Type'] = contentType;
    }

    let url = request.url;

    if (request.query) {
        const paramString = paramsToString(request.query);

        paramString && (url += `?${paramString}`);
    }

    return request.timeout
        ? fetchWithCredentials(url, fetchRequest)
        : fetch(url, fetchRequest);
}

/**
 * Timeout wrapper for fetch()
 *
 * @param url - url to get
 * @param options - RequestInit with additional options
 * @returns response promise
 */
async function fetchWithCredentials(
    url: string,
    options: RequestInit
): Promise<Response> {
    console.log(`fetchWithCredentials: ${url}`);

    try {
        options = options || {};
        options.credentials = 'same-origin';

        const response = await fetch(url, options);

        console.log(
            `fetchWithCredentials: succeeded connecting to url: ${url}`
        );

        return response;
    } catch (e) {
        throw new Error(
            `fetchWithCredentials: timed out connecting to url: ${url}`
        );
    }
}

/**
 * Urlencode a dictionary of strings for use in POST form or GET requests
 *
 * @param params - Dictionary to encode
 * @returns string with encoded values
 */
function paramsToString(params: Record<string, string>): string {
    const values = [];

    for (const key in params) {
        const value = params[key];

        null !== value &&
            void 0 !== value &&
            '' !== value &&
            values.push(
                `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
            );
    }

    return values.join('&');
}

/**
 * Make an ajax request
 *
 * @param request - RequestInit-like structure but with url/type/timeout parameters as well
 * @returns response promise, may be automatically unpacked based on request datatype
 */
export async function ajax(request: any): Promise<Response | string> {
    if (!request) {
        throw new Error('Request cannot be null');
    }

    request.headers = request.headers || {};
    console.log(`requesting url: ${request.url}`);

    try {
        const response = await getFetchPromise(request);

        console.log(`response status: ${response.status}, url: ${request.url}`);

        if (response.status >= 400) {
            return Promise.reject(response);
        } else if (
            request.dataType === 'json' ||
            request.headers?.accept === 'application/json'
        ) {
            return response.json();
        } else if (
            request.dataType === 'text' ||
            (response.headers.get('Content-Type') || '')
                .toLowerCase()
                .indexOf('text/') === 0
        ) {
            return response.text();
        } else {
            return response;
        }
    } catch (err) {
        console.log(`request failed to url: ${request.url}`);
        throw err;
    }
}
