export function getFetchPromise(request) {
    var headers = request.headers || {};
    'json' === request.dataType && (headers.accept = 'application/json');
    var fetchRequest = {
        headers: headers,
        method: request.type,
        credentials: 'same-origin'
    };
    var contentType = request.contentType;
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
    var url = request.url;
    if (request.query) {
        var paramString = paramsToString(request.query);
        paramString && (url += '?' + paramString);
    }
    return request.timeout
        ? fetchWithTimeout(url, fetchRequest, request.timeout)
        : fetch(url, fetchRequest);
}

export function fetchWithTimeout(url, options, timeoutMs) {
    return (
        console.log(
            'fetchWithTimeout: timeoutMs: ' + timeoutMs + ', url: ' + url
        ),
        new Promise(function (resolve, reject) {
            var timeout = setTimeout(reject, timeoutMs);
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
        })
    );
}

export function paramsToString(params) {
    var values = [];
    for (var key in params) {
        var value = params[key];
        null !== value &&
            void 0 !== value &&
            '' !== value &&
            values.push(
                encodeURIComponent(key) + '=' + encodeURIComponent(value)
            );
    }
    return values.join('&');
}

export function ajax(request) {
    if (!request) throw new Error('Request cannot be null');
    request.headers = request.headers || {};
    console.log('requesting url: ' + request.url);

    return getFetchPromise(request).then(
        function (response) {
            console.log(
                'response status: ' + response.status + ', url: ' + request.url
            );
            if (response.status >= 400) {
                return Promise.reject(response);
            } else if (
                request.dataType === 'json' ||
                request.headers.accept === 'application/json'
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

export default {
    ajax
};
