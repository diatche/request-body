/**
 * Created by diatche on 12/11/14.
 */

'use strict';

var request = require('request'),
    Promise = require('promise');

var cache = {},
    activeCount = 0,
    waitResolvers = [];

var requestBody = function(url, options, callback) {
    var promise, cacheInterval = -1;
    if (options && options.cache) {
        cacheInterval = parseFloat(options.cache);
        if (isNaN(cacheInterval)) cacheInterval = 0;
    }
    if (cacheInterval !== 0) {
        promise = cache[url];
    }
    if (!promise) {
        promise = wait()
            .then(function() {
                beginRequest();
                return new Promise(function (resolve, reject) {
                    request(url, options, function (err, res, body) {
                        endRequest();

                        if (cacheInterval !== 0) {
                            setTimeout(function () {
                                delete cache[url];
                            }, cacheInterval * 1000);
                        }

                        if (err) {
                            reject(err);
                            return;
                        }
                        if (res.statusCode !== 200) {
                            reject(res);
                        }
                        resolve(body);
                    });
                });
            }).nodeify(callback);

        if (cacheInterval !== 0) {
            cache[url] = promise;
        }
    }
    return promise;
};
requestBody.maxSimultaneousRequests = 5;

requestBody.json = function(url, options, callback) {
    return requestBody(url, options)
        .then(JSON.parse)
        .then(function(result) {
            if (typeof result === "object" && result.error)
                throw new Error(result.error);
            return result;
        })
        .nodeify(callback);
};

/*
requestBody.retrier = function(info) {
    return false;
};
*/

module.exports = requestBody;

function beginRequest() {
    activeCount++;
    //console.log('active requests: ' + activeCount);
}

function endRequest() {
    activeCount--;
    //console.log('active requests: ' + activeCount);

    // Start another request
    if (waitResolvers.length)
        waitResolvers.shift()(true);
}

function wait() {
    if (activeCount < requestBody.maxSimultaneousRequests)
        return Promise.resolve();

    return new Promise(function (resolve) {
        waitResolvers.push(resolve);
    });
}