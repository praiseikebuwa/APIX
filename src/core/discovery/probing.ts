import { HttpClient } from '../client/http-client.js';
import type { ApiEndpoint, ApiSpec, HttpMethod } from '../../types/index.js';

export interface ProbeResult {
  url: string;
  isReachable: boolean;
  latencyMs: number;
  serverHeader?: string;
  poweredByHeader?: string;
  httpVersion?: string;
  tlsStatus: boolean;
  discoveredEndpoints: ApiEndpoint[];
  healthStatus?: string;
}

export class SafeProber {
  private client: HttpClient;
  public static readonly SAFE_PROBE_PATHS = [
    '/',
    '/health',
    '/status',
    '/ping',
    '/api',
    '/api/v1',
    '/docs',
  ];

  constructor(client?: HttpClient) {
    this.client = client || new HttpClient();
  }

  public async probe(baseUrlStr: string, insecure: boolean = false): Promise<ProbeResult> {
    const baseUrl = baseUrlStr.replace(/\/$/, '');
    const isHttps = baseUrl.startsWith('https://');
    let isReachable = false;
    let latencyMs = 0;
    let serverHeader: string | undefined;
    let poweredByHeader: string | undefined;
    let healthStatus: string | undefined;

    const discoveredEndpoints: ApiEndpoint[] = [];

    // 1. Probe root with OPTIONS and GET
    try {
      const optionsResp = await this.client.request({
        url: baseUrl,
        method: 'OPTIONS',
        allowInsecure: insecure,
        timeoutMs: 4000,
      });

      if (optionsResp.status > 0) {
        isReachable = true;
        latencyMs = optionsResp.timing.total;
        serverHeader = optionsResp.headers['server'] as string;
        poweredByHeader = optionsResp.headers['x-powered-by'] as string;

        const allowHeader = (optionsResp.headers['allow'] || optionsResp.headers['access-control-allow-methods']) as string;
        if (allowHeader) {
          const methods = allowHeader.split(',').map(m => m.trim().toUpperCase());
          for (const m of methods) {
            if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(m)) {
              discoveredEndpoints.push({
                id: `${m.toLowerCase()}_root`,
                method: m as HttpMethod,
                path: '/',
                summary: `${m} Root Endpoint`,
                tags: ['Discovered'],
                parameters: [],
                responses: [],
                source: 'DISCOVERED',
              });
            }
          }
        }
      }
    } catch {
      // ignore OPTIONS failure
    }

    // 2. Probe safe standard paths
    for (const p of SafeProber.SAFE_PROBE_PATHS) {
      try {
        const resp = await this.client.request({
          url: `${baseUrl}${p}`,
          method: 'GET',
          allowInsecure: insecure,
          timeoutMs: 3000,
        });

        if (resp.status >= 200 && resp.status < 500) {
          isReachable = true;
          if (latencyMs === 0) latencyMs = resp.timing.total;
          if (!serverHeader && resp.headers['server']) {
            serverHeader = resp.headers['server'] as string;
          }
          if (!poweredByHeader && resp.headers['x-powered-by']) {
            poweredByHeader = resp.headers['x-powered-by'] as string;
          }

          if (p === '/health' || p === '/status' || p === '/ping') {
            healthStatus = `HTTP ${resp.status} ${resp.statusText}`;
          }

          // Check if already in endpoints
          const exists = discoveredEndpoints.some(e => e.path === p && e.method === 'GET');
          if (!exists) {
            discoveredEndpoints.push({
              id: `get_${p.replace(/[^a-zA-Z0-9]/g, '_')}`,
              method: 'GET',
              path: p,
              summary: `${p === '/' ? 'Root' : p} Endpoint`,
              tags: [p.includes('health') || p.includes('status') || p.includes('ping') ? 'Health' : 'Discovered'],
              parameters: [],
              responses: [
                {
                  statusCode: resp.status,
                  description: resp.statusText,
                  contentType: resp.contentType,
                  example: resp.isJson ? resp.data : undefined,
                },
              ],
              source: 'DISCOVERED',
            });
          }
        }
      } catch {
        // endpoint not found or unreachable, safe to skip
      }
    }

    return {
      url: baseUrl,
      isReachable,
      latencyMs,
      serverHeader,
      poweredByHeader,
      tlsStatus: isHttps,
      discoveredEndpoints,
      healthStatus,
    };
  }

  public createInferredSpec(probeResult: ProbeResult): ApiSpec {
    return {
      title: `Discovered API (${new URL(probeResult.url).hostname})`,
      version: 'Inferred',
      description: `Discovered without formal OpenAPI specification. Server: ${probeResult.serverHeader || 'Unknown'}, Latency: ${probeResult.latencyMs}ms.`,
      baseUrl: probeResult.url,
      servers: [probeResult.url],
      endpoints: probeResult.discoveredEndpoints,
      schemas: {},
    };
  }
}
