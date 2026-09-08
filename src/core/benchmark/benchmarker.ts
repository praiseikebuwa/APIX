import { HttpClient } from '../client/http-client.js';
import type { HttpMethod, HttpRequestConfig } from '../../types/index.js';

export interface BenchmarkOptions {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  totalRequests: number;
  concurrency: number;
  timeoutMs?: number;
}

export interface BenchmarkResult {
  url: string;
  method: string;
  totalRequests: number;
  successful: number;
  failed: number;
  totalTimeMs: number;
  requestsPerSecond: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p90Ms: number;
  p95Ms: number;
  p99Ms: number;
}

export class Benchmarker {
  private client: HttpClient;

  constructor(client?: HttpClient) {
    this.client = client || new HttpClient();
  }

  public async runBenchmark(options: BenchmarkOptions): Promise<BenchmarkResult> {
    const total = Math.max(1, options.totalRequests);
    const concurrency = Math.max(1, Math.min(options.concurrency, total));

    const latencies: number[] = [];
    let successful = 0;
    let failed = 0;

    const startOverall = performance.now();
    let remaining = total;

    const worker = async () => {
      while (remaining > 0) {
        remaining--;
        const reqConfig: HttpRequestConfig = {
          url: options.url,
          method: options.method,
          headers: options.headers,
          body: options.body,
          timeoutMs: options.timeoutMs ?? 10000,
        };

        try {
          const resp = await this.client.request(reqConfig);
          latencies.push(resp.timing.total);
          if (resp.status >= 200 && resp.status < 400) {
            successful++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }
    };

    const workers: Promise<void>[] = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker());
    }

    await Promise.all(workers);

    const totalTimeMs = Math.max(1, performance.now() - startOverall);
    latencies.sort((a, b) => a - b);

    const count = latencies.length || 1;
    const sum = latencies.reduce((acc, v) => acc + v, 0);
    const avgMs = Math.round(sum / count);
    const minMs = latencies[0] || 0;
    const maxMs = latencies[latencies.length - 1] || 0;

    const percentile = (p: number) => {
      if (latencies.length === 0) return 0;
      const idx = Math.min(latencies.length - 1, Math.floor((p / 100) * latencies.length));
      return latencies[idx];
    };

    const rps = parseFloat(((total / totalTimeMs) * 1000).toFixed(2));

    return {
      url: options.url,
      method: options.method,
      totalRequests: total,
      successful,
      failed,
      totalTimeMs: Math.round(totalTimeMs),
      requestsPerSecond: rps,
      avgMs,
      minMs,
      maxMs,
      p50Ms: percentile(50),
      p90Ms: percentile(90),
      p95Ms: percentile(95),
      p99Ms: percentile(99),
    };
  }
}
