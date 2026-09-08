import http from 'node:http';
import type { ApiEndpoint, ApiSpec } from '../../types/index.js';

export class MockServer {
  private spec: ApiSpec;
  private server: http.Server | null = null;
  private port: number = 5050;

  constructor(spec: ApiSpec, port: number = 5050) {
    this.spec = spec;
    this.port = port;
  }

  public start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const method = (req.method || 'GET').toUpperCase();
        const reqUrl = new URL(req.url || '/', `http://localhost:${this.port}`);
        const pathname = reqUrl.pathname;

        // Find matching endpoint
        const match = this.findMatchingEndpoint(method, pathname);
        if (!match) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              error: 'Not Found',
              message: `No mock route matched for ${method} ${pathname}`,
              availableEndpoints: this.spec.endpoints.map((e) => `${e.method} ${e.path}`),
            })
          );
          return;
        }

        // Find first 2xx response definition or first available
        const responseDef =
          match.responses.find((r) => String(r.statusCode).startsWith('2')) || match.responses[0];

        const statusCode = responseDef ? parseInt(String(responseDef.statusCode), 10) || 200 : 200;
        const contentType = responseDef?.contentType || 'application/json';

        let bodyPayload: any = null;
        if (responseDef?.example !== undefined) {
          bodyPayload = responseDef.example;
        } else if (responseDef?.schema) {
          bodyPayload = this.generateSampleFromSchema(responseDef.schema);
        } else {
          bodyPayload = {
            message: `Mock response for ${method} ${pathname}`,
            status: statusCode,
          };
        }

        res.writeHead(statusCode, {
          'Content-Type': contentType,
          'X-APiX-Mock': 'true',
          'Access-Control-Allow-Origin': '*',
        });

        if (typeof bodyPayload === 'object') {
          res.end(JSON.stringify(bodyPayload, null, 2));
        } else {
          res.end(String(bodyPayload));
        }
      });

      this.server.on('error', reject);
      this.server.listen(this.port, () => {
        resolve(`http://localhost:${this.port}`);
      });
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private findMatchingEndpoint(method: string, pathname: string): ApiEndpoint | undefined {
    for (const ep of this.spec.endpoints) {
      if (ep.method.toUpperCase() !== method) continue;

      // Convert OpenAPI path format /users/{id} or /users/:id to regex
      const regexStr =
        '^' +
        ep.path
          .replace(/\{([a-zA-Z0-9_-]+)\}/g, '([^/]+)')
          .replace(/:([a-zA-Z0-9_-]+)/g, '([^/]+)') +
        '$';
      const regex = new RegExp(regexStr);
      if (regex.test(pathname)) {
        return ep;
      }
    }
    return undefined;
  }

  private generateSampleFromSchema(schema: any): any {
    if (!schema || typeof schema !== 'object') return null;

    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;

    switch (schema.type) {
      case 'string':
        if (schema.enum && schema.enum.length > 0) return schema.enum[0];
        if (schema.format === 'date-time') return new Date().toISOString();
        if (schema.format === 'email') return 'developer@example.com';
        if (schema.format === 'uri') return 'https://example.com';
        return 'sample_text';
      case 'integer':
      case 'number':
        return 42;
      case 'boolean':
        return true;
      case 'array': {
        const itemSchema = schema.items || {};
        return [this.generateSampleFromSchema(itemSchema)];
      }
      case 'object':
      default: {
        const obj: Record<string, any> = {};
        const props = schema.properties || {};
        for (const [propName, propSchema] of Object.entries(props)) {
          obj[propName] = this.generateSampleFromSchema(propSchema);
        }
        return obj;
      }
    }
  }
}
