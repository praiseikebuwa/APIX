import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AuthProfile, HttpRequestConfig } from '../../types/index.js';
import { maskSecret } from '../security/masking.js';

export class AuthManager {
  private configDir: string;
  private authFilePath: string;
  private profiles: AuthProfile[] = [];

  constructor(customDir?: string) {
    this.configDir = customDir || path.join(os.homedir(), '.apix');
    this.authFilePath = path.join(this.configDir, 'auth.json');
  }

  public async init(): Promise<void> {
    try {
      await fs.mkdir(this.configDir, { recursive: true });
      const data = await fs.readFile(this.authFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.profiles = parsed.profiles || [];
    } catch {
      this.profiles = [];
      await this.save();
    }
  }

  public async save(): Promise<void> {
    await fs.mkdir(this.configDir, { recursive: true });
    await fs.writeFile(
      this.authFilePath,
      JSON.stringify({ profiles: this.profiles }, null, 2),
      'utf-8'
    );
  }

  public getProfiles(): AuthProfile[] {
    return [...this.profiles];
  }

  public getProfile(idOrName: string): AuthProfile | undefined {
    return this.profiles.find(
      (p) => p.id === idOrName || p.name.toLowerCase() === idOrName.toLowerCase()
    );
  }

  public getDefaultProfile(): AuthProfile | undefined {
    return this.profiles.find((p) => p.isDefault) || this.profiles[0];
  }

  public addProfile(profile: AuthProfile): void {
    const existingIndex = this.profiles.findIndex(
      (p) => p.id === profile.id || p.name.toLowerCase() === profile.name.toLowerCase()
    );
    if (profile.isDefault) {
      for (const p of this.profiles) {
        p.isDefault = false;
      }
    }
    if (existingIndex >= 0) {
      this.profiles[existingIndex] = profile;
    } else {
      this.profiles.push(profile);
    }
  }

  public deleteProfile(idOrName: string): boolean {
    const prevLen = this.profiles.length;
    this.profiles = this.profiles.filter(
      (p) => p.id !== idOrName && p.name.toLowerCase() !== idOrName.toLowerCase()
    );
    return this.profiles.length < prevLen;
  }

  public applyAuth(config: HttpRequestConfig, profileIdOrName?: string): HttpRequestConfig {
    const profile = profileIdOrName ? this.getProfile(profileIdOrName) : this.getDefaultProfile();
    if (!profile) return config;

    const headers = { ...(config.headers || {}) };
    const query = { ...(config.query || {}) };

    switch (profile.type) {
      case 'bearer':
        if (profile.config.token) {
          headers['Authorization'] = `Bearer ${profile.config.token}`;
        }
        break;
      case 'api-key': {
        const keyName = profile.config.paramName || profile.config.headerName || 'X-API-Key';
        const keyVal = profile.config.apiKey || profile.config.token || '';
        if (profile.config.paramLocation === 'query') {
          query[keyName] = keyVal;
        } else {
          headers[keyName] = keyVal;
        }
        break;
      }
      case 'basic':
        if (profile.config.username) {
          const user = profile.config.username;
          const pass = profile.config.password || '';
          const b64 = Buffer.from(`${user}:${pass}`).toString('base64');
          headers['Authorization'] = `Basic ${b64}`;
        }
        break;
      case 'custom-header':
        if (profile.config.headerName && profile.config.headerValue) {
          headers[profile.config.headerName] = profile.config.headerValue;
        }
        break;
      case 'oauth2':
        if (profile.config.token) {
          headers['Authorization'] = `Bearer ${profile.config.token}`;
        }
        break;
    }

    return {
      ...config,
      headers,
      query,
    };
  }

  public getMaskedProfile(profile: AuthProfile): Record<string, any> {
    const masked: Record<string, any> = {
      id: profile.id,
      name: profile.name,
      type: profile.type,
      isDefault: profile.isDefault,
    };
    if (profile.config.token) {
      masked.token = maskSecret(profile.config.token);
    }
    if (profile.config.apiKey) {
      masked.apiKey = maskSecret(profile.config.apiKey);
    }
    if (profile.config.username) {
      masked.username = profile.config.username;
      masked.password = '******';
    }
    if (profile.config.headerName) {
      masked.headerName = profile.config.headerName;
      masked.headerValue = maskSecret(profile.config.headerValue || '');
    }
    return masked;
  }
}
