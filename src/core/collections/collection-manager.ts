import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { ApiCollection, ApiSavedRequest } from '../../types/index.js';

export class CollectionManager {
  private configDir: string;
  private collectionsFilePath: string;
  private collections: ApiCollection[] = [];

  constructor(customDir?: string) {
    this.configDir = customDir || path.join(os.homedir(), '.apix');
    this.collectionsFilePath = path.join(this.configDir, 'collections.json');
  }

  public async init(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      const data = await fs.readFile(this.collectionsFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.collections = parsed.collections || [];
    } catch {
      this.collections = [];
      await this.save();
    }
  }

  public async save(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true });
    await fs.writeFile(
      this.collectionsFilePath,
      JSON.stringify({ collections: this.collections }, null, 2),
      'utf-8'
    );
  }

  public getCollections(): ApiCollection[] {
    return [...this.collections];
  }

  public getCollection(idOrName: string): ApiCollection | undefined {
    return this.collections.find(
      (c) => c.id === idOrName || c.name.toLowerCase() === idOrName.toLowerCase()
    );
  }

  public createCollection(name: string, description?: string): ApiCollection {
    const existing = this.getCollection(name);
    if (existing) {
      throw new Error(`Collection "${name}" already exists`);
    }

    const col: ApiCollection = {
      id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      description,
      requests: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.collections.push(col);
    return col;
  }

  public addRequest(collectionIdOrName: string, request: Omit<ApiSavedRequest, 'id' | 'createdAt'>): ApiSavedRequest {
    const col = this.getCollection(collectionIdOrName);
    if (!col) {
      throw new Error(`Collection "${collectionIdOrName}" not found`);
    }

    const savedReq: ApiSavedRequest = {
      ...request,
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
    };

    col.requests.push(savedReq);
    col.updatedAt = Date.now();
    return savedReq;
  }

  public deleteRequest(collectionIdOrName: string, requestId: string): boolean {
    const col = this.getCollection(collectionIdOrName);
    if (!col) return false;
    const prev = col.requests.length;
    col.requests = col.requests.filter((r) => r.id !== requestId);
    if (col.requests.length < prev) {
      col.updatedAt = Date.now();
      return true;
    }
    return false;
  }

  public deleteCollection(idOrName: string): boolean {
    const prev = this.collections.length;
    this.collections = this.collections.filter(
      (c) => c.id !== idOrName && c.name.toLowerCase() !== idOrName.toLowerCase()
    );
    return this.collections.length < prev;
  }

  public async exportCollection(idOrName: string, targetPath: string): Promise<void> {
    const col = this.getCollection(idOrName);
    if (!col) throw new Error(`Collection "${idOrName}" not found`);

    const exportData = {
      apixVersion: '1.0.0',
      type: 'collection',
      collection: col,
    };
    await fs.writeFile(path.resolve(targetPath), JSON.stringify(exportData, null, 2), 'utf-8');
  }

  public async importCollection(filePath: string): Promise<ApiCollection> {
    const content = await fs.readFile(path.resolve(filePath), 'utf-8');
    const parsed = JSON.parse(content);
    const colData = parsed.collection || parsed;

    if (!colData.name || !Array.isArray(colData.requests)) {
      throw new Error('Invalid APiX collection format. Expected "name" and "requests" array.');
    }

    const col: ApiCollection = {
      id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: colData.name,
      description: colData.description,
      requests: colData.requests,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.collections.push(col);
    await this.save();
    return col;
  }
}
