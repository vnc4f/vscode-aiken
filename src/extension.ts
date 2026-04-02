// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
/*eslint curly: ["error", "multi-line"]*/
import * as vscode from "vscode";
import {
  integer,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

import * as fs from "fs";
import * as path from "path";

function resolveAikenBinary(
  workspaceFolders: readonly vscode.WorkspaceFolder[],
  config: vscode.WorkspaceConfiguration,
  idx: integer,
): string {
  const configuredPath = config.get<string>("executablePath");

  // 1. User/workspace config
  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath;
  }

  // 2. Workspace ./bin/aiken
  const binaryName = process.platform === "win32" ? "aiken.exe" : "aiken";
  if (workspaceFolders.at(idx)) {
    const localAiken = path.join(
      workspaceFolders[idx].uri.fsPath,
      "bin",
      binaryName,
    );
    if (fs.existsSync(localAiken)) {
      return localAiken;
    }
  } else {
    for (const workspaceFolder of workspaceFolders) {
      const localAiken = path.join(
        workspaceFolder.uri.fsPath,
        "bin",
        binaryName,
      );
      if (fs.existsSync(localAiken)) {
        return localAiken;
      }
    }
  }

  // 3. Fallback PATH
  return binaryName;
}

vscode.workspace.onDidChangeConfiguration((e) => {
  if (
    e.affectsConfiguration("aiken.executablePath") ||
    e.affectsConfiguration("aiken.workspaceFolderIdx")
  ) {
    vscode.window.showInformationMessage("Reload to apply Aiken config");
  }
});

let client: LanguageClient | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(_context: vscode.ExtensionContext) {
  const workspaceFolders = vscode.workspace.workspaceFolders || [];
  if (workspaceFolders) {
    const config = vscode.workspace.getConfiguration("aiken");
    const idx = config.get<integer>("workspaceFolderIdx") || -1;

    let clientOptions: LanguageClientOptions = {
      documentSelector: [{ scheme: "file", language: "aiken" }],
      synchronize: {
        fileEvents: [
          vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(
              idx >= 0 ? workspaceFolders[idx] : workspaceFolders[0],
              "aiken.toml",
            ),
          ),
        ],
      },
    };

    const resolved = resolveAikenBinary(workspaceFolders, config, idx);
    console.log("Using Aiken binary:", resolved);

    let serverOptions: ServerOptions = {
      command: resolved,
      args: ["lsp"],
      transport: TransportKind.stdio,
      options: {
        env: Object.assign(process.env, {}),
      },
    };

    client = new LanguageClient(
      "aiken_language_server",
      "Aiken Language Server",
      serverOptions,
      clientOptions,
    );

    client.start();
  }
}

// This method is called when your extension is deactivated
export function deactivate() {
  return client?.stop();
}
