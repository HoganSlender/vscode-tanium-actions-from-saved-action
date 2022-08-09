import * as vscode from "vscode";
import * as fs from "fs";
import { format } from "fast-csv";
import { getUri } from "../common/getUri";
import { OutputChannelLogging } from "../common/OutputChannelLogging";
import { Session } from "../common/session";
import * as commands from '../common/commands';
import { Action } from "../common/Action";

export class ActionsFromSavedActionIdPanel {
    public static currentPanel: ActionsFromSavedActionIdPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _context: vscode.ExtensionContext;
    private _disposables: vscode.Disposable[] = [];

    private keyFqdn = 'tanium-tools.fqdn';
    private keyUsername = 'tanium-tools.username';

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this._context = context;
        this._panel = panel;
        this._panel.onDidDispose(this.dispose, null, this._disposables);
        this._panel.webview.html = this._getWebviewContent(this._panel.webview, context.extensionUri);
        this._setWebviewMessageListener(this._panel.webview);
    }

    public static activate(context: vscode.ExtensionContext) {
        OutputChannelLogging.initialize();

        commands.register(context, {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            'tanium-tools.actionsFromSavedActionIds': () => {
                OutputChannelLogging.showClear();

                // show ui
                ActionsFromSavedActionIdPanel.render(context);
            }
        });
    }

    public static render(context: vscode.ExtensionContext) {
        if (ActionsFromSavedActionIdPanel.currentPanel) {
            ActionsFromSavedActionIdPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
        } else {
            const panel = vscode.window.createWebviewPanel("actions-from-saved-action-ids", "Retrieves action results from all actions generated by saved action id(s)", vscode.ViewColumn.One, {
                enableScripts: true
            });

            ActionsFromSavedActionIdPanel.currentPanel = new ActionsFromSavedActionIdPanel(panel, context);
        }
    }

    private _getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri) {
        const toolkitUri = getUri(webview, extensionUri, [
            "content",
            "toolkit.js", // A toolkit.min.js file is also available
        ]);

        const mainUri = getUri(webview, extensionUri, [
            "content",
            "main.js"
        ]);

        // get fqdn and username from global state
        let fqdn = this._context.globalState.get(this.keyFqdn) ?? '';
        let username = this._context.globalState.get(this.keyUsername) ?? '';

        // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
        return /*html*/ `
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <script type="module" src="${toolkitUri}"></script>
              <script type="module" src="${mainUri}"></script>
              <title>Actions from Saved Action Id(s)</title>
            </head>
            <body>
              <table>
                <tr>
                    <td>
                        <vscode-text-field size=80 ${ fqdn === '' ? 'autofocus' : ''} id="fqdn" value="${fqdn}">Server FQDN</vscode-text-field>
                    </td>
                </tr>
                <tr>
                    <td>
                        <vscode-text-field size=80 id="username" value="${username}">Username</vscode-text-field>
                    </td>
                </tr>
                <tr>
                    <td>
                        <vscode-text-field size=80 ${ fqdn === '' ? '' : 'autofocus'} type="password" id="password" value="">Password</vscode-text-field>
                    </td>
                </tr>
                <tr>
                    <td>
                        <vscode-text-area id="savedactionids" rows="20" cols="81" placeholder="Comma separated saved action ids to retrieve">Saved Action Ids</vscode-text-area>
                    </td>
                </tr>
                <tr>
                    <td style="text-align:right">
                        <vscode-button id="retrieve">Retrieve</vscode-button>
                    </td>
                </tr>
              </table>
            </body>
          </html>
        `;
    }

    private _setWebviewMessageListener(webview: vscode.Webview) {
        webview.onDidReceiveMessage(
            (message: any) => {
                const command = message.command;

                switch (command) {
                    case "retrieve":
                        this._processRetrieveRequest(message);
                        return;
                }
            },
            undefined,
            this._disposables
        );
    }

    private async _processRetrieveRequest(message: any) {
        const fqdn = message.fqdn;
        const username = message.username;
        const password = message.password;
        const savedActionIdsString = message.savedActionIds;

        // store fqdn, and username for use next time
        this._context.globalState.update(this.keyFqdn, fqdn);
        this._context.globalState.update(this.keyUsername, username);

        const httpTimeout = 60;

        // break down the saved action ids
        const savedActionIds = savedActionIdsString.split(',');

        OutputChannelLogging.clear();

        OutputChannelLogging.log(`fqdn: ${fqdn}`);
        OutputChannelLogging.log(`username: ${username}`);
        OutputChannelLogging.log(`savedActionIds: ${JSON.stringify(savedActionIds)}`);

        try {
            // get session
            const session = await Session.getSession(httpTimeout, fqdn, username, password);

            var promises = new Array();
            var data: any[] = [];

            // process each saved action id
            for (var i = 0; i < savedActionIds.length; i++) {
                const savedActionId = savedActionIds[i];

                // get actions from saved action id
                OutputChannelLogging.log(`retrieving actions derived from saved action id: ${savedActionId}`);
                const actions = await Action.getActionsBySavedActionId(httpTimeout, fqdn, session, savedActionId);

                // get results from actions
                for (var j = 0; j < actions.length; j++) {
                    const action = actions[j];

                    OutputChannelLogging.log(`retrieving action results from action id: ${action.id} - (${j + 1} of ${actions.length})`);
                    promises.push(this.writeResults(httpTimeout, fqdn, session, action, data));
                }
            }

            await Promise.all(promises);

            // sort data
            data.sort((a, b) => (a.executionDate > b.executionDate) ? 1 : -1);

            // write file
            var fileInfo = await vscode.window.showSaveDialog();
            if (fileInfo === undefined) {
                return;
            }
            
            const filename = fileInfo.path.substring(1);
            const csvFile = fs.createWriteStream(filename);
            const stream = format({
                headers: true
            });

            stream.pipe(csvFile);

            stream.write([
                'Date',
                'ActionId',
                'Status',
                'Computer Name'
            ]);

            for (var i = 0; i < data.length; i++) {
                const target = data[i];
                stream.write([
                    target.executionDate,
                    target.actionId,
                    target.status,
                    target.computerName
                ]);
            }

            stream.end();
            data = [];

            OutputChannelLogging.log(`${filename} write complete`);
        } catch (err) {
            OutputChannelLogging.logError('ActionsFromSavedActionIdPanel', err);
        }
    }

    private writeResults(httpTimeout: number, fqdn: string, session: string, action: any, data: any[]) {
        const p = new Promise<void>(async (resolve) => {
            const results = await Action.getResults(httpTimeout, fqdn, session, action);

            // write out actions to results
            OutputChannelLogging.log(`found ${results.length} results for action ${action.id}`);
            for (var r = 0; r < results.length; r++) {
                data.push(results[r]);
            }

            return resolve();
        });

        return p;
    }

    public dispose() {
        ActionsFromSavedActionIdPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}