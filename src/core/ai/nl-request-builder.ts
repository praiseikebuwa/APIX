import type { ApiEndpoint, ApiSpec, HttpMethod, HttpRequestConfig } from '../../types/index.js';

export interface NlRequestProposal {
  endpoint: ApiEndpoint;
  method: HttpMethod;
  url: string;
  query: Record<string, any>;
  params: Record<string, any>;
  body?: any;
  explanation: string;
}

export class NlRequestBuilder {
  public static proposeRequest(query: string, spec: ApiSpec): NlRequestProposal | null {
    const text = query.toLowerCase();

    // 1. Infer HTTP method
    let inferredMethod: HttpMethod = 'GET';
    if (text.includes('create') || text.includes('add') || text.includes('post') || text.includes('new')) {
      inferredMethod = 'POST';
    } else if (text.includes('update') || text.includes('modify') || text.includes('put') || text.includes('patch')) {
      inferredMethod = 'PUT';
    } else if (text.includes('delete') || text.includes('remove')) {
      inferredMethod = 'DELETE';
    }

    // 2. Rank matching endpoints
    let bestEndpoint: ApiEndpoint | null = null;
    let maxScore = -1;

    for (const ep of spec.endpoints) {
      let score = 0;

      // Method match
      if (ep.method === inferredMethod) score += 5;

      // Path / summary keywords match
      const pathParts = ep.path.toLowerCase().split(/[\/-_]/).filter(Boolean);
      for (const part of pathParts) {
        if (part !== 'api' && part !== 'v1' && part !== 'v2' && text.includes(part)) {
          score += 10;
        }
      }

      if (ep.summary && ep.summary.toLowerCase().split(/\s+/).some((w) => w.length > 3 && text.includes(w))) {
        score += 8;
      }

      if (score > maxScore) {
        maxScore = score;
        bestEndpoint = ep;
      }
    }

    if (!bestEndpoint || maxScore <= 0) {
      bestEndpoint = spec.endpoints.find((e) => e.method === inferredMethod) || spec.endpoints[0];
    }

    if (!bestEndpoint) return null;

    // 3. Extract query parameters (e.g. "first 10" or "limit 10")
    const extractedQuery: Record<string, any> = {};
    const limitMatch = text.match(/(?:limit|first|top|size)\s*=?\s*(\d+)/i) || text.match(/(\d+)\s+(?:items|results|bookings|users|products)/i);
    if (limitMatch) {
      const limitVal = parseInt(limitMatch[1], 10);
      const limitParam = bestEndpoint.parameters.find(
        (p) => p.name.toLowerCase().includes('limit') || p.name.toLowerCase().includes('size') || p.name.toLowerCase().includes('count')
      );
      if (limitParam) {
        extractedQuery[limitParam.name] = limitVal;
      } else {
        extractedQuery['limit'] = limitVal;
      }
    }

    // 4. Extract body fields (e.g. "named Praise", "email praise@example.com")
    let extractedBody: any = undefined;
    if (bestEndpoint.method === 'POST' || bestEndpoint.method === 'PUT' || bestEndpoint.method === 'PATCH') {
      extractedBody = {};

      const emailMatch = query.match(/(?:email|mail)\s+["']?([a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+)["']?/i);
      if (emailMatch) {
        extractedBody['email'] = emailMatch[1].trim();
      }

      const nameMatch = query.match(/(?:named|name|called)\s+["']?([a-zA-Z0-9_]+)["']?/i);
      if (nameMatch) {
        extractedBody['name'] = nameMatch[1].trim();
      }

      if (Object.keys(extractedBody).length === 0) {
        extractedBody = bestEndpoint.requestBody?.example || { name: 'Sample' };
      }
    }

    const fullUrl = `${spec.baseUrl.replace(/\/$/, '')}${bestEndpoint.path}`;

    return {
      endpoint: bestEndpoint,
      method: bestEndpoint.method,
      url: fullUrl,
      query: extractedQuery,
      params: {},
      body: extractedBody,
      explanation: `Mapped "${query}" to ${bestEndpoint.method} ${bestEndpoint.path} based on endpoint tags and parameter schema.`,
    };
  }
}
