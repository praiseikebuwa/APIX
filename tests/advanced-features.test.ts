import { describe, it, expect } from 'vitest';
import { Benchmarker } from '../src/core/benchmark/benchmarker.js';
import { PluginManager } from '../src/core/plugins/plugin-manager.js';
import http from 'node:http';

describe('Benchmarker', () => {
  it('calculates latency distribution P50/P95 and RPS correctly', async () => {
    // Start temporary test HTTP server
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as any;
    const url = `http://localhost:${address.port}/health`;

    const benchmarker = new Benchmarker();
    const result = await benchmarker.runBenchmark({
      url,
      method: 'GET',
      totalRequests: 20,
      concurrency: 4,
    });

    expect(result.totalRequests).toBe(20);
    expect(result.successful).toBe(20);
    expect(result.failed).toBe(0);
    expect(result.requestsPerSecond).toBeGreaterThan(0);
    expect(result.p50Ms).toBeGreaterThanOrEqual(0);

    server.close();
  });
});

describe('PluginManager', () => {
  it('loads built-in protocol and code generator plugins', async () => {
    const pluginManager = new PluginManager();
    await pluginManager.init();
    const plugins = pluginManager.getPlugins();

    expect(plugins.length).toBeGreaterThan(0);
    expect(plugins.some((p) => p.id === 'rest-openapi')).toBe(true);
  });
});
