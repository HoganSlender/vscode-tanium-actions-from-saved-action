import * as fs from 'fs';

import https = require('https');

const got = require('got');
const { promisify } = require('util');
const stream = require('stream');

export interface PostTextPlainData {
    statusCode: number,
    data: any
}

export class RestClient {
    static postTextPlain(data: string, options: any) {
        const p: Promise<PostTextPlainData> = new Promise<PostTextPlainData>(async (resolve, reject) => {
            try {
                var statusCode: number;
                var responseData: string = '';
                const req = https.request(options, res => {
                    statusCode = res.statusCode!;
                    console.log(`statusCode: ${res.statusCode}`);

                    res.on('data', d => {
                        console.log(`data: ${d.toString()}`);
                        responseData = responseData + d.toString();
                    });

                    res.on('close', () => {
                        console.log('close');
                        resolve({
                            statusCode: statusCode,
                            data: JSON.parse(responseData),
                        });
                    });
                });

                req.on('error', err => {
                    return reject(err);
                });

                req.write(data);
                req.end();
            } catch (err) {
                return reject(err);
            }
        });

        return p;
    }

    static post(url: string, options: any, allowSelfSignedCerts: boolean, httpTimeout: number, dontThrow404?: boolean) {
        const p: Promise<any> = new Promise<any>(async (resolve, reject) => {
            try {
                options = this._wrapOption(allowSelfSignedCerts, httpTimeout, options);
                const { body } = await got.post(encodeURI(url), options);

                return resolve(body);
            } catch (err: any) {
                if (dontThrow404) {
                    if (err.response.statusCode === 404) {
                        const result = err.response.body;
                        result['statusCode'] = 404;
                        return resolve(result);
                    } else {
                        return reject(err);
                    }
                } else {
                    return reject(err);
                }
            }
        });

        return p;
    }

    static patch(url: string, options: any, allowSelfSignedCerts: boolean, httpTimeout: number, dontThrow404?: boolean) {
        const p: Promise<any> = new Promise<any>(async (resolve, reject) => {
            try {
                options = this._wrapOption(allowSelfSignedCerts, httpTimeout, options);
                const { body } = await got.patch(encodeURI(url), options);

                return resolve(body);
            } catch (err: any) {
                if (dontThrow404) {
                    if (err.response.statusCode === 404) {
                        const result = err.response.body;
                        result['statusCode'] = 404;
                        return resolve(result);
                    } else {
                        return reject(err);
                    }
                } else {
                    return reject(err);
                }
            }
        });

        return p;
    }

    static delete(url: string, options: any, allowSelfSignedCerts: boolean, httpTimeout: number) {
        const p: Promise<any> = new Promise<any>(async (resolve, reject) => {
            try {
                options = this._wrapOption(allowSelfSignedCerts, httpTimeout, options);
                const { body } = await got.delete(encodeURI(url), options);

                return resolve(body);
            } catch (err) {
                return reject(err);
            }
        });

        return p;
    }

    static get(url: string, options: any, allowSelfSignedCerts: boolean, httpTimeout: number, dontThrow404?: boolean) {
        const p: Promise<any> = new Promise<any>(async (resolve, reject) => {
            try {
                options = this._wrapOption(allowSelfSignedCerts, httpTimeout, options);
                const { body } = await got.get(encodeURI(url), options);

                return resolve(body);
            } catch (err: any) {
                if (dontThrow404) {
                    if (err.response.statusCode === 404) {
                        const result = err.response.body;
                        result['statusCode'] = 404;
                        return resolve(result);
                    } else {
                        return reject(err);
                    }
                } else {
                    return reject(err);
                }
            }
        });

        return p;
    }

    static downloadFile(url: string, filePath: string, options: any, allowSelfSignedCerts: boolean, httpTimeout: number) {
        const p = new Promise<void>(async (resolve, reject) => {
            const pipeline = promisify(stream.pipeline);
            try {
                options = this._wrapOption(allowSelfSignedCerts, httpTimeout, options);
                await pipeline(
                    got.stream(encodeURI(url), options),
                    fs.createWriteStream(filePath)
                );
            } catch (err) {
                return reject(err);
            }

            return resolve();
        });

        return p;
    }

    static _wrapOption(allow: boolean, httpTimeout: number, options: any) {
        if (allow) {
            options['https'] = {
                rejectUnauthorized: !allow
            };
        }

        options.timeout = httpTimeout * 1000;

        return options;
    }
}
