export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type EndpointSource = 'DOCUMENTED' | 'DISCOVERED' | 'INFERRED' | 'USER-PROVIDED';

export interface ApiParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  description?: string;
  schema?: any;
  example?: any;
  defaultValue?: any;
}

export interface ApiRequestBody {
  description?: string;
  required?: boolean;
  contentType: string;
  schema?: any;
  example?: any;
}

export interface ApiResponseDefinition {
  statusCode: string | number;
  description: string;
  contentType?: string;
  schema?: any;
  example?: any;
  headers?: Record<string, any>;
}

export interface ApiSecurityRequirement {
  type: 'bearer' | 'apiKey' | 'basic' | 'oauth2' | 'custom';
  name?: string;
  in?: 'header' | 'query';
  scheme?: string;
  scopes?: string[];
}

export interface ApiEndpoint {
  id: string; // e.g. "users.list" or "GET_/users"
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: ApiResponseDefinition[];
  security?: ApiSecurityRequirement[];
  source: EndpointSource;
}

export interface ApiSpec {
  title: string;
  version: string;
  description?: string;
  baseUrl: string;
  servers: string[];
  endpoints: ApiEndpoint[];
  schemas: Record<string, any>;
  securitySchemes?: Record<string, any>;
  rawSpec?: any;
}

export interface HttpTimingBreakdown {
  dns: number;       // DNS lookup time in ms
  tcp: number;       // TCP connection time in ms
  tls: number;       // TLS handshake time in ms
  ttfb: number;      // Server processing (Time to First Byte) in ms
  download: number;  // Response content transfer in ms
  total: number;     // Total duration in ms
}

export interface HttpRequestConfig {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean>;
  params?: Record<string, string | number>;
  body?: any;
  timeoutMs?: number;
  allowInsecure?: boolean;
  maxRedirects?: number;
  maxBodySize?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string | string[]>;
  data: any;
  rawData: string;
  contentType: string;
  sizeBytes: number;
  timing: HttpTimingBreakdown;
  url: string;
  method: HttpMethod;
  isJson: boolean;
  isHtml: boolean;
  isXml: boolean;
  isBinary: boolean;
}

export interface Environment {
  name: string;
  baseUrl: string;
  variables: Record<string, string>;
  isProduction: boolean;
  isDefault?: boolean;
}

export type AuthType = 'bearer' | 'api-key' | 'basic' | 'oauth2' | 'custom-header';

export interface AuthProfile {
  id: string;
  name: string;
  type: AuthType;
  config: {
    token?: string;
    apiKey?: string;
    headerName?: string;
    headerValue?: string;
    paramName?: string;
    paramLocation?: 'header' | 'query';
    username?: string;
    password?: string;
    prefix?: string;
  };
  isDefault?: boolean;
}

export interface RequestHistoryItem {
  id: string;
  timestamp: number;
  method: HttpMethod;
  url: string;
  path: string;
  status: number;
  statusText: string;
  durationMs: number;
  sizeBytes: number;
  environment?: string;
  request: {
    headers: Record<string, string>;
    query?: Record<string, any>;
    params?: Record<string, any>;
    body?: any;
  };
  responsePreview?: string;
}

export interface RequestAssertion {
  id: string;
  type: 'status' | 'jsonpath' | 'header' | 'duration' | 'schema';
  expression: string; // e.g. "status", "data.users.length", "headers.content-type"
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'exists' | 'matches';
  expected?: any;
}

export interface AssertionResult {
  passed: boolean;
  assertion: RequestAssertion;
  actual?: any;
  message: string;
}

export interface ApiSavedRequest {
  id: string;
  name: string;
  method: HttpMethod;
  path: string;
  summary?: string;
  query?: Record<string, any>;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
  authProfileId?: string;
  assertions?: RequestAssertion[];
  createdAt: number;
}

export interface ApiCollection {
  id: string;
  name: string;
  description?: string;
  requests: ApiSavedRequest[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowStep {
  id: string;
  name: string;
  request: ApiSavedRequest;
  extractions: {
    sourcePath: string; // e.g. "response.data.token"
    targetVariable: string; // e.g. "token"
  }[];
  assertions?: RequestAssertion[];
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
}

export interface DiffResult {
  addedEndpoints: { method: string; path: string; summary?: string }[];
  removedEndpoints: { method: string; path: string; summary?: string }[];
  modifiedEndpoints: {
    method: string;
    path: string;
    changes: string[];
    breaking: boolean;
  }[];
  schemaChanges: string[];
}

export interface QualityReport {
  score: number;
  documentationCoverage: number;
  schemaCoverage: number;
  errorDefinitionCoverage: number;
  exampleCoverage: number;
  totalEndpoints: number;
  endpointsWithoutDescriptions: string[];
  endpointsWithoutSchemas: string[];
  endpointsWithoutErrors: string[];
  endpointsWithoutExamples: string[];
  warnings: string[];
  suggestions: string[];
}
