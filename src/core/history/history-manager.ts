import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { HttpRequestConfig, HttpResponse, RequestHistoryItem } from '../../types/index.js';
import { maskBody, maskHeaders } from '../security/masking.js';

export class HistoryManager {
  private configDir: string;
  private historyFilePath: string;
  private items: RequestHistoryItem[] = [];
  private maxItems: number = 500;
  private enabled: boolean = true;

  constructor(customDir?: string) {
    this.configDir = customDir || path.join(os.homedir(), '.apix');
    this.historyFilePath = path.join(this.configDir, 'history.json');
  }

  public async init(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      const data = await fs.readFile(this.historyFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.items = parsed.items || [];
      if (parsed.enabled !== undefined) {
        this.enabled = parsed.enabled;
      }
    } catch {
      this.items = [];
      await this.save();
    }
  }

  public async save(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true });
    await fs.writeFile(
      this.historyFilePath,
      JSON.stringify(
        {
          enabled: this.enabled,
          items: this.items.slice(0, this.maxItems),
        },
        null,
        2
      ),
      'utf-8'
    );
  }

  public async record(
    config: HttpRequestConfig,
    response: HttpResponse,
    environmentName?: string
  ): Promise<RequestHistoryItem | null> {
    if (!this.enabled) return null;

    let pathOnly = '/';
    try {
      pathOnly = new URL(config.url).pathname;
    } catch {
      pathOnly = config.url;
    }

    let preview = '';
    if (response.isJson && typeof response.data === 'object') {
      preview = JSON.stringify(response.data).slice(0, 150);
    } else if (response.rawData) {
      preview = response.rawData.slice(0, 150);
    }

    const item: RequestHistoryItem = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      method: config.method,
      url: config.url,
      path: pathOnly,
      status: response.status,
      statusText: response.statusText,
      durationMs: response.timing.total,
      sizeBytes: response.sizeBytes,
      environment: environmentName,
      request: {
        headers: maskHeaders(config.headers || {}),
        query: config.query,
        params: config.params,
        body: maskBody(config.body),
      },
      responsePreview: preview,
    };

    this.items.unshift(item);
    if (this.items.length > this.maxItems) {
      this.items = this.items.slice(0, this.maxItems);
    }

    await this.save();
    return item;
  }

  public getItems(limit: number = 50): RequestHistoryItem[] {
    return this.items.slice(0, limit);
  }

  public getItem(id: string): RequestHistoryItem | undefined {
    return this.items.find((item) => item.id === id);
  }

  public async deleteItem(id: string): Promise<boolean> {
    const prev = this.items.length;
    this.items = this.items.filter((item) => item.id !== id);
    if (this.items.length < prev) {
      await this.save();
      return true;
    }
    return false;
  }

  public async clear(): Promise<void> {
    this.items = [];
    await this.save();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }
}
