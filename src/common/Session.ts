import { RestClient } from "./RestClient";

export class Session {
    static getSession(httpTimeout: number, fqdn: string, username: string, password: string): Promise<string> {
        const p: Promise<string> = new Promise<string>(async (resolve, reject) => {
            try {
                const destRestBase = `https://${fqdn}/api/v2`;
                const options = {
                    json: {
                        username: username,
                        password: password,
                    },
                    responseType: 'json',
                };

                const body = await RestClient.post(`${destRestBase}/session/login`, options, true, httpTimeout);

                return resolve(body.data.session);
            } catch (err) {
                return reject(err);
            }
        });

        return p;
    }
}