import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export interface ApixConfig {
  theme: 'dark' | 'light' | 'high-contrast' | 'monochrome';
  timeoutMs: number;
  historyEnabled: boolean;
  maxHistoryItems: number;
  allowInsecureTls: boolean;
  lastConnectedUrl?: string;
  defaultEnvironment?: string;
}

export const DEFAULT_CONFIG: ApixConfig = {
  theme: 'dark',
  timeoutMs: 20000,
  historyEnabled: true,
  maxHistoryItems: 500,
  allowInsecureTls: false,
};

export class ConfigManager {
  private configDir: string;
  private configFilePath: string;
  private config: ApixConfig = { ...DEFAULT_CONFIG };

  constructor(customDir?: string) {
    this.configDir = customDir || path.join(os.homedir(), '.apix');
    this.configFilePath = path.join(this.configDir, 'config.json');
  }

  public async init(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      const data = await fs.readFile(this.configFilePath, 'utf-8');
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch {
      this.config = { ...DEFAULT_CONFIG };
      await this.save();
    }
  }

  public async save(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true });
    await fs.writeFile(this.configFilePath, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  public get<K extends keyof ApixConfig>(key: K): ApixConfig[K] {
    return this.config[key];
  }

  public async set<K extends keyof ApixConfig>(key: K, value: ApixConfig[K]): Promise<void> {
    this.config[key] = value;
    await this.save();
  }

  public getAll(): ApixConfig {
    return { ...this.config };
  }
}
