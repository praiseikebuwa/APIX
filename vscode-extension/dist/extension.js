"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const http = __importStar(require("http"));
const https = __importStar(require("https"));
const url_1 = require("url");
function activate(context) {
    // 1. CodeLens Provider
    const codelensProvider = new ApixCodeLensProvider();
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ language: 'apix' }, codelensProvider), vscode.languages.registerCodeLensProvider({ pattern: '**/*.apix' }, codelensProvider));
    // 2. TreeView Sidebar Explorer
    const treeDataProvider = new ApixTreeDataProvider(context);
    vscode.window.registerTreeDataProvider('apixExplorerView', treeDataProvider);
    // 3. Command: Run Single Request
    context.subscriptions.push(vscode.commands.registerCommand('apix.runRequest', async (reqName, pathStr, method, rawBody, expectedStatus) => {
        const activeEditor = vscode.window.activeTextEditor;
        let baseUrl = 'http://localhost:4000';
        if (activeEditor) {
            const text = activeEditor.document.getText();
            const baseMatch = text.match(/baseUrl:\s*"([^"]+)"/) || text.match(/baseUrl:\s*([^\s\n]+)/);
            if (baseMatch)
                baseUrl = baseMatch[1];
        }
        const fullUrl = pathStr.startsWith('http') ? pathStr : `${baseUrl.replace(/\/$/, '')}${pathStr.startsWith('/') ? '' : '/'}${pathStr}`;
        const startTime = process.hrtime.bigint();
        vscode.window.showInformationMessage(`[APiX] Sending ${method} ${fullUrl}...`);
        try {
            const result = await executeHttpRequest(fullUrl, method, rawBody);
            const endTime = process.hrtime.bigint();
            const durationMs = Number((endTime - startTime) / BigInt(1_000_000));
            const statusColor = result.statusCode >= 200 && result.statusCode < 300 ? '#10b981' : '#ef4444';
            const testPassed = expectedStatus ? result.statusCode === expectedStatus : true;
            const panel = vscode.window.createWebviewPanel('apixResponse', `APiX: ${method} ${pathStr}`, vscode.ViewColumn.Two, { enableScripts: true });
            panel.webview.html = getWebviewContent({
                method,
                url: fullUrl,
                status: result.statusCode,
                statusText: result.statusMessage,
                durationMs,
                sizeBytes: result.body.length,
                headers: result.headers,
                body: result.body,
                statusColor,
                testPassed,
                expectedStatus,
            });
        }
        catch (err) {
            vscode.window.showErrorMessage(`[APiX Error] ${err.message}`);
        }
    }));
    // 4. Command: Copy cURL
    context.subscriptions.push(vscode.commands.registerCommand('apix.copyCurl', (pathStr, method = 'GET', rawBody) => {
        const curlCmd = `curl -X ${method.toUpperCase()} "http://localhost:4000${pathStr}" ${rawBody ? `-H "Content-Type: application/json" -d '${rawBody}'` : ''}`;
        vscode.env.clipboard.writeText(curlCmd);
        vscode.window.showInformationMessage(`[APiX] Copied cURL command to clipboard!`);
    }));
    // 5. Command: Benchmark Endpoint
    context.subscriptions.push(vscode.commands.registerCommand('apix.benchmark', (pathStr) => {
        const terminal = vscode.window.createTerminal('APiX Benchmark');
        terminal.show();
        terminal.sendText(`npx @praiseikebuwa/apix-cli benchmark ${pathStr} -n 100 -c 5`);
    }));
    // 6. Command: Open in Terminal
    context.subscriptions.push(vscode.commands.registerCommand('apix.openInTerminal', () => {
        const activeEditor = vscode.window.activeTextEditor;
        const target = activeEditor ? activeEditor.document.fileName : '.';
        const terminal = vscode.window.createTerminal('APiX CLI');
        terminal.show();
        terminal.sendText(`npx @praiseikebuwa/apix-cli open "${target}"`);
    }));
    // 7. Command: Create New .apix File
    context.subscriptions.push(vscode.commands.registerCommand('apix.initProject', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('Please open a workspace folder first.');
            return;
        }
        const filePath = vscode.Uri.joinPath(workspaceFolders[0].uri, 'api.apix');
        const sampleYaml = `# APiX Executable API Project
version: 1
name: Sample API Service
baseUrl: "{{baseUrl}}"

environments:
  local:
    baseUrl: "http://localhost:4000"
  production:
    baseUrl: "https://api.myapp.com"

requests:
  - name: Health Check
    method: GET
    path: /health
    tests:
      - expect:
          status: 200

  - name: List Users
    method: GET
    path: /users
    tests:
      - expect:
          status: 200
`;
        await vscode.workspace.fs.writeFile(filePath, Buffer.from(sampleYaml, 'utf8'));
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
        vscode.window.showInformationMessage('✓ Created api.apix project file!');
    }));
    // 8. Command: Switch Environment
    context.subscriptions.push(vscode.commands.registerCommand('apix.switchEnv', async () => {
        const env = await vscode.window.showQuickPick(['local (http://localhost:4000)', 'production (https://api.myapp.com)'], {
            placeHolder: 'Select active APiX environment',
        });
        if (env) {
            vscode.window.showInformationMessage(`[APiX] Switched active environment to [${env.split(' ')[0]}]`);
        }
    }));
}
// HTTP Helper for Extension Execution
function executeHttpRequest(urlStr, method, body) {
    return new Promise((resolve, reject) => {
        try {
            const parsedUrl = new url_1.URL(urlStr);
            const isHttps = parsedUrl.protocol === 'https:';
            const lib = isHttps ? https : http;
            const req = lib.request(urlStr, {
                method: method.toUpperCase(),
                headers: {
                    'User-Agent': 'APiX-VSCode-Extension/1.0',
                    'Content-Type': 'application/json',
                    ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
                },
                timeout: 5000,
            }, (res) => {
                let chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    const respBody = Buffer.concat(chunks).toString('utf8');
                    resolve({
                        statusCode: res.statusCode || 200,
                        statusMessage: res.statusMessage || 'OK',
                        headers: res.headers,
                        body: respBody,
                    });
                });
            });
            req.on('error', (err) => reject(err));
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timed out after 5000ms'));
            });
            if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                req.write(body);
            }
            req.end();
        }
        catch (e) {
            reject(e);
        }
    });
}
// CodeLens Provider Implementation
class ApixCodeLensProvider {
    provideCodeLenses(document) {
        const codeLenses = [];
        const text = document.getText();
        const lines = text.split('\n');
        // Document Top CodeLens
        if (lines.length > 0) {
            const topRange = new vscode.Range(0, 0, 0, 0);
            codeLenses.push(new vscode.CodeLens(topRange, {
                title: '▶ Run All Requests in Project',
                command: 'apix.openInTerminal',
            }), new vscode.CodeLens(topRange, {
                title: '⚡ Open in APiX Terminal',
                command: 'apix.openInTerminal',
            }), new vscode.CodeLens(topRange, {
                title: '⚙ Switch Environment',
                command: 'apix.switchEnv',
            }));
        }
        let currentMethod = 'GET';
        let currentReqName = 'Request';
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('name:')) {
                const m = line.match(/name:\s*(.+)/);
                if (m)
                    currentReqName = m[1].replace(/["']/g, '').trim();
            }
            if (line.includes('method:')) {
                const m = line.match(/method:\s*([A-Z]+)/i);
                if (m)
                    currentMethod = m[1].toUpperCase();
            }
            if (line.includes('path:')) {
                const range = new vscode.Range(i, 0, i, line.length);
                const pathMatch = line.match(/path:\s*([^\s]+)/);
                const pathStr = pathMatch ? pathMatch[1].replace(/["']/g, '') : '/';
                codeLenses.push(new vscode.CodeLens(range, {
                    title: `▶ Run Request (${currentMethod})`,
                    command: 'apix.runRequest',
                    arguments: [currentReqName, pathStr, currentMethod],
                }), new vscode.CodeLens(range, {
                    title: '📋 Copy cURL',
                    command: 'apix.copyCurl',
                    arguments: [pathStr, currentMethod],
                }), new vscode.CodeLens(range, {
                    title: '⚡ Benchmark',
                    command: 'apix.benchmark',
                    arguments: [pathStr],
                }));
            }
        }
        return codeLenses;
    }
}
// TreeDataProvider Implementation for Sidebar
class ApixTreeDataProvider {
    context;
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;
    constructor(context) {
        this.context = context;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (!element) {
            return [
                new ApixTreeItem('Environments', vscode.TreeItemCollapsibleState.Expanded, 'folder'),
                new ApixTreeItem('Endpoints', vscode.TreeItemCollapsibleState.Expanded, 'folder'),
            ];
        }
        if (element.label === 'Environments') {
            return [
                new ApixTreeItem('local (http://localhost:4000) [Active]', vscode.TreeItemCollapsibleState.None, 'env'),
                new ApixTreeItem('production (https://api.myapp.com)', vscode.TreeItemCollapsibleState.None, 'env'),
            ];
        }
        if (element.label === 'Endpoints') {
            return [
                new ApixTreeItem('GET /health', vscode.TreeItemCollapsibleState.None, 'endpoint', { command: 'apix.runRequest', title: 'Run', arguments: ['Health Check', '/health', 'GET'] }),
                new ApixTreeItem('GET /users', vscode.TreeItemCollapsibleState.None, 'endpoint', { command: 'apix.runRequest', title: 'Run', arguments: ['List Users', '/users', 'GET'] }),
                new ApixTreeItem('POST /bookings', vscode.TreeItemCollapsibleState.None, 'endpoint', { command: 'apix.runRequest', title: 'Run', arguments: ['Create Booking', '/bookings', 'POST'] }),
            ];
        }
        return [];
    }
}
class ApixTreeItem extends vscode.TreeItem {
    label;
    collapsibleState;
    type;
    command;
    constructor(label, collapsibleState, type, command) {
        super(label, collapsibleState);
        this.label = label;
        this.collapsibleState = collapsibleState;
        this.type = type;
        this.command = command;
        if (type === 'env') {
            this.iconPath = new vscode.ThemeIcon('gear');
        }
        else if (type === 'endpoint') {
            this.iconPath = new vscode.ThemeIcon('play');
        }
        else {
            this.iconPath = new vscode.ThemeIcon('folder');
        }
    }
}
// Webview HTML Template
function getWebviewContent(data) {
    let formattedBody = data.body;
    try {
        formattedBody = JSON.stringify(JSON.parse(data.body), null, 2);
    }
    catch {
        // raw body fallback
    }
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #fafafa; padding: 1.25rem; margin: 0; }
    .header { border-bottom: 1px solid #27272a; padding-bottom: 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; }
    .method-badge { background: #27272a; color: #38bdf8; padding: 0.3rem 0.6rem; border-radius: 4px; font-weight: bold; font-family: monospace; font-size: 0.9rem; }
    .status-badge { background: ${data.statusColor}; color: white; padding: 0.3rem 0.6rem; border-radius: 4px; font-weight: bold; font-family: monospace; }
    .url { font-family: monospace; color: #a1a1aa; font-size: 0.95rem; }
    .metrics { display: flex; gap: 1.5rem; background: #121215; border: 1px solid #27272a; padding: 0.75rem 1rem; border-radius: 6px; font-size: 0.85rem; margin-bottom: 1.25rem; color: #a1a1aa; }
    .metrics strong { color: #ffffff; }
    pre { background: #000000; border: 1px solid #27272a; padding: 1rem; border-radius: 8px; color: #38bdf8; font-family: 'JetBrains Mono', monospace; font-size: 0.875rem; overflow: auto; max-height: 450px; }
    .test-box { background: ${data.testPassed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; border: 1px solid ${data.testPassed ? '#22c55e' : '#ef4444'}; color: ${data.testPassed ? '#22c55e' : '#ef4444'}; padding: 0.6rem 1rem; border-radius: 6px; margin-bottom: 1.25rem; font-weight: 600; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <span class="method-badge">${data.method}</span>
      <span class="url">${data.url}</span>
    </div>
    <span class="status-badge">${data.status} ${data.statusText}</span>
  </div>

  <div class="metrics">
    <div>Latency: <strong>${data.durationMs}ms</strong></div>
    <div>Size: <strong>${data.sizeBytes} B</strong></div>
    <div>Time: <strong>${new Date().toLocaleTimeString()}</strong></div>
  </div>

  ${data.expectedStatus ? `<div class="test-box">${data.testPassed ? '✓ Contract Assertion Passed: Status === ' + data.expectedStatus : '✗ Contract Assertion Failed: Expected ' + data.expectedStatus + ', got ' + data.status}</div>` : ''}

  <h3>Response Body</h3>
  <pre>${escapeHtml(formattedBody)}</pre>
</body>
</html>`;
}
function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function deactivate() { }
//# sourceMappingURL=extension.js.map