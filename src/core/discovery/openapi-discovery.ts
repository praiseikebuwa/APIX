import fs from 'node:fs/promises';
import path from 'node:path';
import { HttpClient } from '../client/http-client.js';
import { OpenApiParser } from '../openapi/parser.js';
import type { ApiSpec } from '../../types/index.js';

export class OpenApiDiscovery {
  private client: HttpClient;
  public static readonly COMMON_OPENAPI_PATHS = [
    '/openapi.json',
    '/openapi.yaml',
    '/swagger.json',
    '/swagger.yaml',
    '/api-docs',
    '/api-docs/openapi.json',
    '/docs/openapi.json',
    '/v2/api-docs',
    '/v3/api-docs',
  ];

  constructor(client?: HttpClient) {
    this.client = client || new HttpClient();
  }

  public async discover(
    targetUrl: string,
    explicitLocation?: string,
    insecure: boolean = false
  ): Promise<{ spec: ApiSpec; location: string } | null> {
    // 1. If explicit location is given (file or URL)
    if (explicitLocation) {
      if (explicitLocation.startsWith('http://') || explicitLocation.startsWith('https://')) {
        const resp = await this.client.request({
          url: explicitLocation,
          method: 'GET',
          allowInsecure: insecure,
          timeoutMs: 10000,
        });
        if (resp.status >= 200 && resp.status < 300) {
          const spec = OpenApiParser.parse(resp.rawData, targetUrl);
          return { spec, location: explicitLocation };
        }
      } else {
        // Read local file
        const resolvedPath = path.resolve(explicitLocation);
        const content = await fs.readFile(resolvedPath, 'utf-8');
        const spec = OpenApiParser.parse(content, targetUrl);
        return { spec, location: resolvedPath };
      }
    }

    // 2. Scan common paths on the target URL
    const baseUrl = targetUrl.replace(/\/$/, '');
    for (const p of OpenApiDiscovery.COMMON_OPENAPI_PATHS) {
      const probeUrl = `${baseUrl}${p}`;
      try {
        const resp = await this.client.request({
          url: probeUrl,
          method: 'GET',
          allowInsecure: insecure,
          timeoutMs: 4000,
        });

        if (resp.status >= 200 && resp.status < 300) {
          // Check if response looks like OpenAPI or Swagger JSON/YAML
          const text = resp.rawData.trim();
          if (
            text.includes('"openapi"') ||
            text.includes('"swagger"') ||
            text.startsWith('openapi:') ||
            text.startsWith('swagger:') ||
            (resp.isJson && (resp.data?.paths || resp.data?.openapi || resp.data?.swagger))
          ) {
            try {
              const spec = OpenApiParser.parse(text, baseUrl);
              if (spec.endpoints.length > 0 || spec.rawSpec?.paths) {
                return { spec, location: probeUrl };
              }
            } catch {
              // Not a valid OpenAPI spec, continue probing
            }
          }
        }
      } catch {
        // Continue to next probe
      }
    }

    return null;
  }

  public async importFromFile(filePath: string, overrideBaseUrl?: string): Promise<ApiSpec> {
    const resolvedPath = path.resolve(filePath);
    const content = await fs.readFile(resolvedPath, 'utf-8');
    return OpenApiParser.parse(content, overrideBaseUrl);
  }
}
