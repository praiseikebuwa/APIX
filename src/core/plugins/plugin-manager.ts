import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface ApixPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  protocol?: 'rest' | 'graphql' | 'grpc' | 'websocket';
  enabled: boolean;
}

export class PluginManager {
  private pluginDir: string;
  private plugins: ApixPlugin[] = [];

  constructor(customDir?: string) {
    this.pluginDir = customDir || path.join(os.homedir(), '.apix', 'plugins');
  }

  public async init(): Promise<void> {
    try {
      await fs.mkdir(this.pluginDir, { recursive: true });
      // Built-in core plugins
      this.plugins = [
        {
          id: 'rest-openapi',
          name: 'OpenAPI REST Discovery Plugin',
          version: '1.0.0',
          description: 'Default REST & OpenAPI 3.x/2.0 auto-discovery engine',
          protocol: 'rest',
          enabled: true,
        },
        {
          id: 'graphql-inspector',
          name: 'GraphQL Introspection Plugin',
          version: '1.0.0',
          description: 'GraphQL schema introspection and query execution',
          protocol: 'graphql',
          enabled: true,
        },
        {
          id: 'code-gen-multi',
          name: '10-Language Code Generator',
          version: '1.0.0',
          description: 'Multi-language code generator for cURL, JS, TS, Python, Go, Rust, etc.',
          enabled: true,
        },
      ];
    } catch {
      this.plugins = [];
    }
  }

  public getPlugins(): ApixPlugin[] {
    return [...this.plugins];
  }

  public async installPlugin(nameOrUrl: string): Promise<ApixPlugin> {
    const plugin: ApixPlugin = {
      id: `plugin-${Date.now()}`,
      name: nameOrUrl,
      version: '1.0.0',
      description: `User-installed plugin from ${nameOrUrl}`,
      enabled: true,
    };
    this.plugins.push(plugin);
    return plugin;
  }
}
