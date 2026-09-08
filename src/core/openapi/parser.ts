import YAML from 'yaml';
import type {
  ApiEndpoint,
  ApiParameter,
  ApiRequestBody,
  ApiResponseDefinition,
  ApiSecurityRequirement,
  ApiSpec,
  HttpMethod,
} from '../../types/index.js';

export class OpenApiParser {
  public static parse(content: string, overrideBaseUrl?: string): ApiSpec {
    let raw: any;
    try {
      raw = JSON.parse(content);
    } catch {
      try {
        raw = YAML.parse(content);
      } catch (e: any) {
        throw new Error(`Failed to parse specification as JSON or YAML: ${e.message}`);
      }
    }

    if (!raw || typeof raw !== 'object') {
      throw new Error('Invalid specification: root must be an object');
    }

    const isSwagger2 = raw.swagger && String(raw.swagger).startsWith('2.');
    const isOpenApi3 = raw.openapi && (String(raw.openapi).startsWith('3.') || String(raw.openapi).startsWith('3.1'));

    if (!isSwagger2 && !isOpenApi3) {
      // Best-effort fallback if it has paths
      if (!raw.paths) {
        throw new Error('Unrecognized API specification format. Expected OpenAPI 3.x or Swagger 2.0.');
      }
    }

    return isSwagger2
      ? this.parseSwagger2(raw, overrideBaseUrl)
      : this.parseOpenApi3(raw, overrideBaseUrl);
  }

  private static parseOpenApi3(raw: any, overrideBaseUrl?: string): ApiSpec {
    const title = raw.info?.title || 'API';
    const version = raw.info?.version || '1.0.0';
    const description = raw.info?.description || '';

    const servers: string[] = [];
    if (Array.isArray(raw.servers) && raw.servers.length > 0) {
      for (const s of raw.servers) {
        if (s?.url) servers.push(s.url);
      }
    }

    const baseUrl = overrideBaseUrl || servers[0] || 'http://localhost';
    const schemas = raw.components?.schemas || {};
    const securitySchemes = raw.components?.securitySchemes || {};

    const endpoints: ApiEndpoint[] = [];
    const paths = raw.paths || {};

    for (const [pathStr, pathItem] of Object.entries<any>(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      const commonParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

      const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
      for (const method of methods) {
        const op = pathItem[method.toLowerCase()];
        if (!op) continue;

        const endpointParams: ApiParameter[] = [];
        const allParams = [...commonParams, ...(Array.isArray(op.parameters) ? op.parameters : [])];

        for (const p of allParams) {
          const resolvedParam = this.resolveRef(p, raw);
          if (resolvedParam && resolvedParam.name && resolvedParam.in) {
            endpointParams.push({
              name: resolvedParam.name,
              in: resolvedParam.in,
              required: Boolean(resolvedParam.required || resolvedParam.in === 'path'),
              description: resolvedParam.description,
              schema: resolvedParam.schema ? this.resolveRef(resolvedParam.schema, raw) : undefined,
              example: resolvedParam.example || resolvedParam.schema?.example,
              defaultValue: resolvedParam.schema?.default,
            });
          }
        }

        // Request Body
        let requestBody: ApiRequestBody | undefined = undefined;
        if (op.requestBody) {
          const resolvedBody = this.resolveRef(op.requestBody, raw);
          const content = resolvedBody?.content || {};
          const firstContentType = Object.keys(content)[0] || 'application/json';
          const contentObj = content[firstContentType] || {};
          requestBody = {
            description: resolvedBody?.description,
            required: Boolean(resolvedBody?.required),
            contentType: firstContentType,
            schema: contentObj.schema ? this.resolveRef(contentObj.schema, raw) : undefined,
            example: contentObj.example || contentObj.schema?.example,
          };
        }

        // Responses
        const responses: ApiResponseDefinition[] = [];
        const opResponses = op.responses || {};
        for (const [code, respObj] of Object.entries<any>(opResponses)) {
          const resolvedResp = this.resolveRef(respObj, raw);
          const content = resolvedResp?.content || {};
          const firstContentType = Object.keys(content)[0];
          const contentObj = firstContentType ? content[firstContentType] : undefined;

          responses.push({
            statusCode: code,
            description: resolvedResp?.description || '',
            contentType: firstContentType,
            schema: contentObj?.schema ? this.resolveRef(contentObj.schema, raw) : undefined,
            example: contentObj?.example || contentObj?.schema?.example,
            headers: resolvedResp?.headers,
          });
        }

        // Security
        const security: ApiSecurityRequirement[] = [];
        const opSec = op.security || raw.security || [];
        if (Array.isArray(opSec)) {
          for (const secReq of opSec) {
            for (const [schemeName, scopes] of Object.entries(secReq)) {
              const schemeDef = securitySchemes[schemeName];
              if (schemeDef) {
                security.push({
                  type: schemeDef.type === 'http' && schemeDef.scheme === 'bearer' ? 'bearer' : schemeDef.type,
                  name: schemeDef.name || schemeName,
                  in: schemeDef.in,
                  scheme: schemeDef.scheme,
                  scopes: Array.isArray(scopes) ? scopes : [],
                });
              } else {
                security.push({
                  type: 'custom',
                  name: schemeName,
                  scopes: Array.isArray(scopes) ? scopes : [],
                });
              }
            }
          }
        }

        const tags = Array.isArray(op.tags) && op.tags.length > 0 ? op.tags : ['General'];
        const id = op.operationId || `${method.toLowerCase()}_${pathStr.replace(/[^a-zA-Z0-9]/g, '_')}`;

        endpoints.push({
          id,
          method,
          path: pathStr,
          summary: op.summary || `${method} ${pathStr}`,
          description: op.description,
          tags,
          parameters: endpointParams,
          requestBody,
          responses,
          security: security.length > 0 ? security : undefined,
          source: 'DOCUMENTED',
        });
      }
    }

    return {
      title,
      version,
      description,
      baseUrl,
      servers,
      endpoints,
      schemas,
      securitySchemes,
      rawSpec: raw,
    };
  }

  private static parseSwagger2(raw: any, overrideBaseUrl?: string): ApiSpec {
    const title = raw.info?.title || 'Swagger API';
    const version = raw.info?.version || '1.0.0';
    const description = raw.info?.description || '';

    const host = raw.host || 'localhost';
    const basePath = raw.basePath || '';
    const schemes = Array.isArray(raw.schemes) && raw.schemes.length > 0 ? raw.schemes : ['http'];
    const calculatedBaseUrl = `${schemes[0]}://${host}${basePath.replace(/\/$/, '')}`;
    const baseUrl = overrideBaseUrl || calculatedBaseUrl;

    const schemas = raw.definitions || {};
    const securitySchemes = raw.securityDefinitions || {};

    const endpoints: ApiEndpoint[] = [];
    const paths = raw.paths || {};

    for (const [pathStr, pathItem] of Object.entries<any>(paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;

      const commonParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
      const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

      for (const method of methods) {
        const op = pathItem[method.toLowerCase()];
        if (!op) continue;

        const endpointParams: ApiParameter[] = [];
        let requestBody: ApiRequestBody | undefined = undefined;

        const allParams = [...commonParams, ...(Array.isArray(op.parameters) ? op.parameters : [])];

        for (const p of allParams) {
          const resolvedParam = this.resolveRef(p, raw);
          if (!resolvedParam) continue;

          if (resolvedParam.in === 'body') {
            requestBody = {
              description: resolvedParam.description,
              required: Boolean(resolvedParam.required),
              contentType: (raw.consumes && raw.consumes[0]) || 'application/json',
              schema: resolvedParam.schema ? this.resolveRef(resolvedParam.schema, raw) : undefined,
              example: resolvedParam.schema?.example,
            };
          } else if (resolvedParam.name && resolvedParam.in) {
            endpointParams.push({
              name: resolvedParam.name,
              in: resolvedParam.in,
              required: Boolean(resolvedParam.required || resolvedParam.in === 'path'),
              description: resolvedParam.description,
              schema: resolvedParam.type ? { type: resolvedParam.type, format: resolvedParam.format } : undefined,
              example: resolvedParam.example,
              defaultValue: resolvedParam.default,
            });
          }
        }

        // Responses
        const responses: ApiResponseDefinition[] = [];
        const opResponses = op.responses || {};
        for (const [code, respObj] of Object.entries<any>(opResponses)) {
          const resolvedResp = this.resolveRef(respObj, raw);
          responses.push({
            statusCode: code,
            description: resolvedResp?.description || '',
            contentType: (raw.produces && raw.produces[0]) || 'application/json',
            schema: resolvedResp?.schema ? this.resolveRef(resolvedResp.schema, raw) : undefined,
            example: resolvedResp?.schema?.example,
            headers: resolvedResp?.headers,
          });
        }

        const tags = Array.isArray(op.tags) && op.tags.length > 0 ? op.tags : ['General'];
        const id = op.operationId || `${method.toLowerCase()}_${pathStr.replace(/[^a-zA-Z0-9]/g, '_')}`;

        endpoints.push({
          id,
          method,
          path: pathStr,
          summary: op.summary || `${method} ${pathStr}`,
          description: op.description,
          tags,
          parameters: endpointParams,
          requestBody,
          responses,
          source: 'DOCUMENTED',
        });
      }
    }

    return {
      title,
      version,
      description,
      baseUrl,
      servers: [baseUrl],
      endpoints,
      schemas,
      securitySchemes,
      rawSpec: raw,
    };
  }

  public static resolveRef(obj: any, root: any): any {
    if (!obj || typeof obj !== 'object') return obj;
    if (!obj.$ref) return obj;

    const ref = obj.$ref;
    if (typeof ref === 'string' && ref.startsWith('#/')) {
      const parts = ref.substring(2).split('/');
      let current = root;
      for (const part of parts) {
        if (!current || typeof current !== 'object') return obj;
        current = current[part];
      }
      return current || obj;
    }
    return obj;
  }
}
