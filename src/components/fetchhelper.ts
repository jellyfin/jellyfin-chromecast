/**
 * Function to send a request, with or without the timeout option
 *
 * @param request custom request object, mostly modeled after RequestInit.
 * @returns response promise
 */
function getFetchPromise(request: any): Promise<Response> {
    const headers = request.headers || {};
    if (request.dataType === 'json') headers.accept = 'application/json';
    const fetchRequest: RequestInit = {
        headers: headers,
        method: request.type,
        credentials: 'same-origin'
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
        paramString && (url += '?' + paramString);
    }
    return request.timeout
        ? fetchWithTimeout(url, fetchRequest, request.timeout)
        : fetch(url, fetchRequest);
}

/**
 * Timeout wrapper for fetch()
 *
 * @param url url to get
 * @param options RequestInit with additional options
 * @param timeoutMs request timeout in ms
 * @returns response promise
 */
function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
): Promise<Response> {
    console.log('fetchWithTimeout: timeoutMs: ' + timeoutMs + ', url: ' + url);
    return new Promise(function (resolve, reject) {
        const timeout = setTimeout(reject, timeoutMs);
        options = options || {};
        options.credentials = 'same-origin';
        fetch(url, options).then(
            function (response) {
                clearTimeout(timeout);
                console.log(
                    'fetchWithTimeout: succeeded connecting to url: ' + url
                );
                resolve(response);
            },
            function () {
                clearTimeout(timeout);
                console.log(
                    'fetchWithTimeout: timed out connecting to url: ' + url
                );
                reject();
            }
        );
    });
}

/**
 * Urlencode a dictionary of strings for use in POST form or GET requests
 *
 * @param params Dictionary to encode
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
                encodeURIComponent(key) + '=' + encodeURIComponent(value)
            );
    }
    return values.join('&');
}

/**
 * Make an ajax request
 *
 * @param request RequestInit-like structure but with url/type/timeout parameters as well
 * @returns response promise, may be automatically unpacked based on request datatype
 */
export function ajax(request: any): Promise<any> {
    if (!request) throw new Error('Request cannot be null');
    request.headers = request.headers || {};
    console.log('requesting url: ' + request.url);

    return getFetchPromise(request).then(
        (response: Response) => {
            console.log(
                'response status: ' + response.status + ', url: ' + request.url
            );
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
        },
        function (err) {
            console.log('request failed to url: ' + request.url);
            throw err;
        }
    );
}
