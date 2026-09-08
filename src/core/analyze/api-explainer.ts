import type { ApiSpec } from '../../types/index.js';
import { HttpClient } from '../client/http-client.js';

export interface ApiExplanation {
  name: string;
  version: string;
  protocol: string;
  docFormat: string;
  endpointCount: number;
  schemaCount: number;
  authType: string;
  resources: Record<string, { method: string; path: string; summary?: string }[]>;
  potentialIssues: string[];
  healthStatus: string;
}

export class ApiExplainer {
  public static async explain(spec: ApiSpec, client?: HttpClient): Promise<ApiExplanation> {
    const http = client || new HttpClient();

    // Group resources by tag
    const resources: Record<string, { method: string; path: string; summary?: string }[]> = {};
    for (const ep of spec.endpoints) {
      const tag = ep.tags[0] || 'General';
      if (!resources[tag]) resources[tag] = [];
      resources[tag].push({
        method: ep.method,
        path: ep.path,
        summary: ep.summary,
      });
    }

    // Detect potential issues
    const potentialIssues: string[] = [];
    let undocSchemas = 0;
    let undocErrors = 0;

    for (const ep of spec.endpoints) {
      if (ep.method === 'DELETE' && !ep.responses.some((r) => Boolean(r.schema))) {
        undocSchemas++;
      }
      if (!ep.responses.some((r) => String(r.statusCode).startsWith('4'))) {
        undocErrors++;
      }
    }

    if (undocSchemas > 0) {
      potentialIssues.push(`⚠ ${undocSchemas} DELETE/PUT operation(s) have no documented response schema`);
    }
    if (undocErrors > 0) {
      potentialIssues.push(`⚠ ${undocErrors} endpoint(s) lack 4xx/5xx error definitions`);
    }

    // Check auth
    const hasAuth = spec.endpoints.some((e) => Boolean(e.security && e.security.length > 0));
    if (hasAuth) {
      potentialIssues.push('✓ Authentication requirements defined across endpoints');
    }

    // Probe health
    let healthStatus = 'Unknown';
    try {
      const healthResp = await http.request({
        url: `${spec.baseUrl}/health`,
        method: 'GET',
        timeoutMs: 3000,
      });
      if (healthResp.status >= 200 && healthResp.status < 300) {
        healthStatus = `✓ Health check online (${healthResp.timing.total}ms)`;
      } else {
        healthStatus = `⚠ Health check returned HTTP ${healthResp.status}`;
      }
    } catch {
      healthStatus = '○ No explicit /health endpoint detected';
    }

    return {
      name: spec.title || 'API',
      version: spec.version || '1.0.0',
      protocol: spec.baseUrl.startsWith('https') ? 'HTTPS (REST)' : 'HTTP (REST)',
      docFormat: spec.rawSpec?.openapi ? `OpenAPI ${spec.rawSpec.openapi}` : spec.rawSpec?.swagger ? `Swagger ${spec.rawSpec.swagger}` : 'Inferred Spec',
      endpointCount: spec.endpoints.length,
      schemaCount: Object.keys(spec.schemas || {}).length,
      authType: hasAuth ? 'Defined' : 'None / Public',
      resources,
      potentialIssues,
      healthStatus,
    };
  }
}
