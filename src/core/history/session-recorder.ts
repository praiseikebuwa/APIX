import fs from 'node:fs/promises';
import path from 'node:path';
import type { HttpRequestConfig, HttpResponse } from '../../types/index.js';
import { maskBody, maskHeaders } from '../security/masking.js';
import { HttpClient } from '../client/http-client.js';

export interface SessionRecordEntry {
  id: string;
  timestamp: number;
  request: {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: any;
  };
  response: {
    status: number;
    statusText: string;
    durationMs: number;
    sizeBytes: number;
    bodyPreview?: string;
  };
}

export interface ApixSessionFile {
  version: string;
  createdAt: number;
  recordedUrl?: string;
  entries: SessionRecordEntry[];
}

export class SessionRecorder {
  private entries: SessionRecordEntry[] = [];
  private isRecording: boolean = false;
  private recordedUrl?: string;

  public startRecording(targetUrl?: string): void {
    this.isRecording = true;
    this.recordedUrl = targetUrl;
    this.entries = [];
  }

  public recordStep(config: HttpRequestConfig, response: HttpResponse): void {
    if (!this.isRecording) return;

    this.entries.push({
      id: `step_${this.entries.length + 1}`,
      timestamp: Date.now(),
      request: {
        url: config.url,
        method: config.method,
        headers: maskHeaders(config.headers || {}),
        body: maskBody(config.body),
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        durationMs: response.timing.total,
        sizeBytes: response.sizeBytes,
        bodyPreview: typeof response.data === 'object' ? JSON.stringify(response.data).slice(0, 200) : String(response.rawData).slice(0, 200),
      },
    });
  }

  public async saveSession(filePath: string): Promise<string> {
    const resolvedPath = path.resolve(filePath);
    const sessionFile: ApixSessionFile = {
      version: '1.0.0',
      createdAt: Date.now(),
      recordedUrl: this.recordedUrl,
      entries: this.entries,
    };

    await fs.writeFile(resolvedPath, JSON.stringify(sessionFile, null, 2), 'utf-8');
    this.isRecording = false;
    return resolvedPath;
  }

  public static async replaySession(
    filePath: string,
    client?: HttpClient
  ): Promise<{ total: number; passed: number; failed: number; results: any[] }> {
    const resolvedPath = path.resolve(filePath);
    const content = await fs.readFile(resolvedPath, 'utf-8');
    const session: ApixSessionFile = JSON.parse(content);

    const http = client || new HttpClient();
    const results: any[] = [];
    let passed = 0;
    let failed = 0;

    for (const entry of session.entries) {
      try {
        const resp = await http.request({
          url: entry.request.url,
          method: entry.request.method as any,
          headers: entry.request.headers,
          body: entry.request.body,
        });

        const statusPassed = resp.status === entry.response.status;
        if (statusPassed) passed++;
        else failed++;

        results.push({
          id: entry.id,
          method: entry.request.method,
          url: entry.request.url,
          expectedStatus: entry.response.status,
          actualStatus: resp.status,
          expectedDuration: entry.response.durationMs,
          actualDuration: resp.timing.total,
          passed: statusPassed,
        });
      } catch (err: any) {
        failed++;
        results.push({
          id: entry.id,
          method: entry.request.method,
          url: entry.request.url,
          error: err.message,
          passed: false,
        });
      }
    }

    return {
      total: session.entries.length,
      passed,
      failed,
      results,
    };
  }
}
