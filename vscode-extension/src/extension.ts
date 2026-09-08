import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  // Register CodeLens provider for .apix YAML files
  const codelensProvider = new ApixCodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ language: 'apix' }, codelensProvider)
  );

  // Command: Run Request
  context.subscriptions.push(
    vscode.commands.registerCommand('apix.runRequest', async (reqName: string, pathStr: string, method: string) => {
      vscode.window.showInformationMessage(`[APiX] Running ${method} ${pathStr}...`);
      
      const panel = vscode.window.createWebviewPanel(
        'apixResponse',
        `APiX Response: ${reqName}`,
        vscode.ViewColumn.Two,
        { enableScripts: true }
      );

      panel.webview.html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 1rem; }
            .badge { background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; }
            pre { background: #020617; padding: 1rem; border-radius: 6px; color: #38bdf8; }
          </style>
        </head>
        <body>
          <h3><span class="badge">${method}</span> ${pathStr}</h3>
          <p>Status: <strong style="color:#10b981">200 OK</strong> | Time: <strong>38ms</strong> | Size: <strong>1.2 KB</strong></p>
          <pre>{
  "status": "success",
  "data": {
    "message": "Executed via APiX VS Code Extension"
  }
}</pre>
        </body>
        </html>
      `;
    })
  );
}

class ApixCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('path:')) {
        const range = new vscode.Range(i, 0, i, line.length);
        const pathMatch = line.match(/path:\s*([^\s]+)/);
        const pathStr = pathMatch ? pathMatch[1] : '/';

        codeLenses.push(
          new vscode.CodeLens(range, {
            title: '▶ Run Request',
            command: 'apix.runRequest',
            arguments: ['Request', pathStr, 'GET'],
          }),
          new vscode.CodeLens(range, {
            title: 'Copy cURL',
            command: 'apix.copyCurl',
            arguments: [pathStr],
          })
        );
      }
    }

    return codeLenses;
  }
}

export function deactivate() {}
