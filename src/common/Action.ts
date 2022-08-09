import { ActionResult } from "./ActionResult";
import { RestClient } from "./RestClient";

export class Action {
    static getActionsBySavedActionId(httpTimeout: number, fqdn: string, session: string, savedActionId: number): Promise<any[]> {
        const p = new Promise<any[]>(async (resolve, reject) => {
            const restBase = `https://${fqdn}/api/v2`;

            try {
                const options: any = {
                    headers: {
                        session: session,
                    },
                    responseType: 'json',
                };
                options.headers['tanium-options'] = `{"cache_filters":[{"field":"saved_action/id","operator":"Equal","value":"${savedActionId}"}]}`;

                const body = await RestClient.get(`${restBase}/actions`, options, true, httpTimeout);

                // remove cache object
                body.data.pop();

                return resolve(body.data);
            } catch (err) {
                return reject(err);
            }
        });

        return p;
    }

    static padTo2Digits(num: number) {
        return num.toString().padStart(2, '0');
    }

    static formatDate(date: Date) {
        return (
            [
                this.padTo2Digits(date.getMonth() + 1),
                this.padTo2Digits(date.getDate()),
                date.getFullYear(),
            ].join('-') +
            ' ' +
            [
                this.padTo2Digits(date.getHours()),
                this.padTo2Digits(date.getMinutes()),
                this.padTo2Digits(date.getSeconds()),
            ].join(':')
        );
    }

    static getResults(httpTimeout: number, fqdn: string, session: string, action: any): Promise<ActionResult[]> {
        const p = new Promise<ActionResult[]>(async (resolve, reject) => {
            const restBase = `https://${fqdn}/api/v2`;

            try {
                const executionDate: Date = new Date(action.start_time);
                const actionId = action.id;

                const options: any = {
                    headers: {
                        session: session,
                    },
                    responseType: 'json',
                };

                const body = await RestClient.get(`${restBase}/result_data/action/${actionId}`, options, true, httpTimeout);

                // populate data
                const retval: ActionResult[] = [];

                if (body.data.result_sets) {
                    for (var i = 0; i < body.data.result_sets.length; i++) {
                        const resultSet: any = body.data.result_sets[i];

                        if (resultSet.rows) {
                            for (var r = 0; r < resultSet.rows.length; r++) {
                                const row = resultSet.rows[r];

                                const statusItems = row.data[1][0].text.split(':');

                                var result: ActionResult = {
                                    executionDate: this.formatDate(executionDate),
                                    actionId: actionId,
                                    status: statusItems[1].substr(0, statusItems[1].length - 1),
                                    computerName: row.data[0][0].text
                                };

                                retval.push(result);
                            }
                        }
                    }
                }

                return resolve(retval);
            } catch (err) {
                return reject(err);
            }
        });

        return p;
    }
}

