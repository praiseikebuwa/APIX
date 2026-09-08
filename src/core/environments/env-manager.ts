import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Environment } from '../../types/index.js';
import { isProductionUrl } from '../security/safety.js';

export class EnvManager {
  private configDir: string;
  private envFilePath: string;
  private environments: Environment[] = [];
  private activeEnvName: string = 'local';

  constructor(customDir?: string) {
    this.configDir = customDir || path.join(os.homedir(), '.apix');
    this.envFilePath = path.join(this.configDir, 'environments.json');
  }

  public async init(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      const data = await fs.readFile(this.envFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.environments = parsed.environments || [];
      this.activeEnvName = parsed.activeEnvName || 'local';
    } catch {
      // Initialize environment structure
      this.environments = [
        {
          name: 'local',
          baseUrl: 'http://localhost:3000',
          variables: {
            baseUrl: 'http://localhost:3000',
          },
          isProduction: false,
          isDefault: true,
        },
        {
          name: 'development',
          baseUrl: 'http://localhost:4000',
          variables: {
            baseUrl: 'http://localhost:4000',
          },
          isProduction: false,
        },
        {
          name: 'staging',
          baseUrl: '',
          variables: {
            baseUrl: '',
          },
          isProduction: false,
        },
        {
          name: 'production',
          baseUrl: '',
          variables: {
            baseUrl: '',
          },
          isProduction: true,
        },
      ];
      await this.save();
    }
  }

  public async save(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true });
    await fs.writeFile(
      this.envFilePath,
      JSON.stringify(
        {
          activeEnvName: this.activeEnvName,
          environments: this.environments,
        },
        null,
        2
      ),
      'utf-8'
    );
  }

  public getEnvironments(): Environment[] {
    return [...this.environments];
  }

  public getActiveEnvironment(): Environment {
    const env = this.environments.find((e) => e.name === this.activeEnvName);
    if (env) return env;
    return (
      this.environments[0] || {
        name: 'local',
        baseUrl: 'http://localhost:3000',
        variables: {},
        isProduction: false,
      }
    );
  }

  public setActiveEnvironment(name: string): Environment {
    const target = this.environments.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (!target) {
      throw new Error(`Environment "${name}" not found. Available: ${this.environments.map((e) => e.name).join(', ')}`);
    }
    this.activeEnvName = target.name;
    return target;
  }

  public addEnvironment(env: Environment): void {
    const index = this.environments.findIndex((e) => e.name.toLowerCase() === env.name.toLowerCase());
    if (index >= 0) {
      this.environments[index] = env;
    } else {
      this.environments.push(env);
    }
  }

  public setVariable(envName: string, key: string, value: string): void {
    const env = this.environments.find((e) => e.name.toLowerCase() === envName.toLowerCase());
    if (!env) {
      throw new Error(`Environment "${envName}" not found`);
    }
    env.variables[key] = value;
    if (key.toLowerCase() === 'baseurl' || key.toLowerCase() === 'api_url') {
      env.baseUrl = value;
      env.isProduction = isProductionUrl(value) || env.name.toLowerCase().includes('prod');
    }
  }

  /**
   * Replaces {{variableName}} templates using active environment variables and process.env
   */
  public interpolate(text: string, extraVariables?: Record<string, any>): string {
    if (!text || typeof text !== 'string') return text;

    const activeEnv = this.getActiveEnvironment();
    const allVars: Record<string, string> = {
      baseUrl: activeEnv.baseUrl,
      ...activeEnv.variables,
      ...(extraVariables || {}),
    };

    return text.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, varName) => {
      if (allVars[varName] !== undefined && allVars[varName] !== null) {
        return String(allVars[varName]);
      }
      // Check process.env fallback
      if (process.env[varName] !== undefined) {
        return process.env[varName]!;
      }
      return match; // Keep unchanged if not found
    });
  }

  public interpolateObject<T>(obj: T, extraVariables?: Record<string, any>): T {
    if (!obj) return obj;
    if (typeof obj === 'string') {
      return this.interpolate(obj, extraVariables) as unknown as T;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.interpolateObject(item, extraVariables)) as unknown as T;
    }
    if (typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = this.interpolateObject(v, extraVariables);
      }
      return result as unknown as T;
    }
    return obj;
  }
}
