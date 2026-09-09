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
    '/healthz',
    '/status',
    '/ping',
    '/info',
    '/metrics',
    '/api',
    '/api/v1',
    '/v1',
    '/api/v2',
    '/v2',
    '/users',
    '/user',
    '/api/users',
    '/auth',
    '/login',
    '/register',
    '/items',
    '/products',
    '/orders',
    '/posts',
    '/comments',
    '/docs',
  ];

  constructor(client?: HttpClient) {
    this.client = client || new HttpClient();
  }

  private getDefaultResponses(method: HttpMethod) {
    switch (method) {
      case 'POST':
        return [
          { statusCode: 201, description: 'Created', contentType: 'application/json' },
          { statusCode: 400, description: 'Bad Request', contentType: 'application/json' },
        ];
      case 'PUT':
      case 'PATCH':
        return [
          { statusCode: 200, description: 'OK', contentType: 'application/json' },
          { statusCode: 400, description: 'Bad Request', contentType: 'application/json' },
        ];
      case 'DELETE':
        return [
          { statusCode: 204, description: 'No Content' },
          { statusCode: 404, description: 'Not Found' },
        ];
      default:
        return [
          { statusCode: 200, description: 'OK', contentType: 'application/json' },
          { statusCode: 404, description: 'Not Found', contentType: 'application/json' },
        ];
    }
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
                responses: this.getDefaultResponses(m as HttpMethod),
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

          if (p === '/health' || p === '/healthz' || p === '/status' || p === '/ping') {
            healthStatus = `HTTP ${resp.status} ${resp.statusText}`;
          }

          // Infer tag from path segment (e.g. /users -> Users)
          const segments = p.split('/').filter(Boolean);
          const tag = segments.length > 0
            ? segments[0].charAt(0).toUpperCase() + segments[0].slice(1)
            : 'Discovered';

          // Check if already in endpoints
          const exists = discoveredEndpoints.some(e => e.path === p && e.method === 'GET');
          if (!exists) {
            const isListEndpoint = Array.isArray(resp.data);
            const queryParams = isListEndpoint
              ? [
                  { name: 'limit', in: 'query' as const, required: false, description: 'Max items to return', schema: { type: 'integer' } },
                  { name: 'page', in: 'query' as const, required: false, description: 'Page number', schema: { type: 'integer' } },
                ]
              : [];

            discoveredEndpoints.push({
              id: `get_${p.replace(/[^a-zA-Z0-9]/g, '_')}`,
              method: 'GET',
              path: p,
              summary: `${p === '/' ? 'Root' : p} Endpoint`,
              tags: [tag],
              parameters: queryParams,
              responses: [
                {
                  statusCode: resp.status,
                  description: resp.statusText || 'OK',
                  contentType: resp.contentType || 'application/json',
                  example: resp.isJson ? resp.data : undefined,
                },
              ],
              source: 'DISCOVERED',
            });

            // If path represents a entity collection (like /users, /items, /products), infer CRUD sub-endpoints
            if (segments.length === 1 && !['health', 'status', 'ping', 'docs', 'metrics', 'info'].includes(segments[0])) {
              const singular = segments[0];
              
              // Infer POST /<resource>
              if (!discoveredEndpoints.some(e => e.path === p && e.method === 'POST')) {
                let sampleBody: any = {};
                if (isListEndpoint && resp.data.length > 0 && typeof resp.data[0] === 'object') {
                  const { id, _id, createdAt, updatedAt, ...rest } = resp.data[0];
                  sampleBody = rest;
                }
                discoveredEndpoints.push({
                  id: `post_${singular}`,
                  method: 'POST',
                  path: p,
                  summary: `Create ${singular}`,
                  tags: [tag],
                  parameters: [],
                  requestBody: {
                    contentType: 'application/json',
                    description: `Payload for creating ${singular}`,
                    example: sampleBody,
                  },
                  responses: this.getDefaultResponses('POST'),
                  source: 'DISCOVERED',
                });
              }

              // Infer GET /<resource>/{id}
              const itemPath = `${p}/{id}`;
              if (!discoveredEndpoints.some(e => e.path === itemPath && e.method === 'GET')) {
                discoveredEndpoints.push({
                  id: `get_${singular}_by_id`,
                  method: 'GET',
                  path: itemPath,
                  summary: `Get ${singular} by ID`,
                  tags: [tag],
                  parameters: [
                    { name: 'id', in: 'path', required: true, description: `${singular} identifier`, schema: { type: 'string' } },
                  ],
                  responses: this.getDefaultResponses('GET'),
                  source: 'DISCOVERED',
                });
              }
            }
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
