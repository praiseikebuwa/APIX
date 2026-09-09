import { describe, it, expect } from 'vitest';
import { CurlParser } from '../src/core/curl/curl-parser.js';
import { AssertionRunner } from '../src/core/testing/assertion-runner.js';
import { ApiDiffer } from '../src/core/diff/api-diff.js';
import { QualityAnalyzer } from '../src/core/analyze/quality-analyzer.js';
import type { ApiSpec, HttpResponse } from '../src/types/index.js';

describe('CurlParser', () => {
  it('parses complex curl command string', () => {
    const curl = 'curl -X POST "https://api.example.com/items" -H "Authorization: Bearer xyz" -H "Content-Type: application/json" -d \'{"item": "book"}\'';
    const config = CurlParser.parse(curl);

    expect(config.url).toBe('https://api.example.com/items');
    expect(config.method).toBe('POST');
    expect(config.headers?.['Authorization']).toBe('Bearer xyz');
    expect(config.body).toEqual({ item: 'book' });
  });
});

describe('AssertionRunner', () => {
  const runner = new AssertionRunner();
  const mockResponse: HttpResponse = {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    data: { user: { id: 42, name: 'Praise', email: 'praise@example.com' } },
    rawData: '{"user":{"id":42}}',
    contentType: 'application/json',
    sizeBytes: 100,
    timing: { dns: 2, tcp: 4, tls: 6, ttfb: 15, download: 2, total: 29 },
    url: 'https://api.example.com/users/42',
    method: 'GET',
    isJson: true,
    isHtml: false,
    isXml: false,
    isBinary: false,
  };

  it('evaluates status assertions', () => {
    const res = runner.runAssertion(
      { id: '1', type: 'status', expression: 'status', operator: 'equals', expected: 200 },
      mockResponse
    );
    expect(res.passed).toBe(true);
  });

  it('evaluates JSON path assertions', () => {
    const res = runner.runAssertion(
      { id: '2', type: 'jsonpath', expression: 'user.email', operator: 'contains', expected: '@' },
      mockResponse
    );
    expect(res.passed).toBe(true);
  });
});

describe('ApiDiffer', () => {
  it('detects added, removed, and modified endpoints', () => {
    const specA: ApiSpec = {
      title: 'V1',
      version: '1.0',
      baseUrl: 'http://localhost',
      servers: [],
      endpoints: [
        { id: '1', method: 'GET', path: '/users', tags: [], parameters: [], responses: [], source: 'DOCUMENTED' },
        { id: '2', method: 'DELETE', path: '/old', tags: [], parameters: [], responses: [], source: 'DOCUMENTED' },
      ],
      schemas: {},
    };

    const specB: ApiSpec = {
      title: 'V2',
      version: '2.0',
      baseUrl: 'http://localhost',
      servers: [],
      endpoints: [
        { id: '1', method: 'GET', path: '/users', tags: [], parameters: [{ name: 'phone', in: 'query', required: true }], responses: [], source: 'DOCUMENTED' },
        { id: '3', method: 'POST', path: '/users', tags: [], parameters: [], responses: [], source: 'DOCUMENTED' },
      ],
      schemas: {},
    };

    const diff = ApiDiffer.diff(specA, specB);
    expect(diff.addedEndpoints.length).toBe(1);
    expect(diff.addedEndpoints[0].path).toBe('/users');
    expect(diff.removedEndpoints.length).toBe(1);
    expect(diff.removedEndpoints[0].path).toBe('/old');
    expect(diff.modifiedEndpoints.length).toBe(1);
    expect(diff.modifiedEndpoints[0].breaking).toBe(true);
  });
});

describe('QualityAnalyzer', () => {
  it('calculates quality metrics for API spec', () => {
    const spec: ApiSpec = {
      title: 'Quality API',
      version: '1.0',
      baseUrl: 'http://localhost',
      servers: [],
      endpoints: [
        {
          id: '1',
          method: 'GET',
          path: '/pets',
          summary: 'List pets',
          description: 'Detailed description of list pets',
          tags: ['pets'],
          parameters: [],
          responses: [
            { statusCode: 200, description: 'Success', schema: { type: 'array' }, example: [{ id: 1 }] },
            { statusCode: 400, description: 'Bad Request' },
          ],
          source: 'DOCUMENTED',
        },
      ],
      schemas: {},
    };

    const report = QualityAnalyzer.analyze(spec);
    expect(report.score).toBeGreaterThan(80);
    expect(report.documentationCoverage).toBe(100);
  });
});

describe('SafeProber & ApiExplainer', () => {
  it('creates inferred spec and explains non-OpenAPI backend probe results', async () => {
    const { SafeProber } = await import('../src/core/discovery/probing.js');
    const { ApiExplainer } = await import('../src/core/analyze/api-explainer.js');

    const prober = new SafeProber();
    const inferredSpec = prober.createInferredSpec({
      url: 'http://localhost:4000',
      isReachable: true,
      latencyMs: 15,
      serverHeader: 'express',
      tlsStatus: false,
      discoveredEndpoints: [
        {
          id: 'get_root',
          method: 'GET',
          path: '/',
          summary: 'Root Endpoint',
          tags: ['Discovered'],
          parameters: [],
          responses: [{ statusCode: 200, description: 'OK' }],
          source: 'DISCOVERED',
        },
        {
          id: 'post_users',
          method: 'POST',
          path: '/users',
          summary: 'Create User',
          tags: ['Users'],
          parameters: [],
          responses: [{ statusCode: 201, description: 'Created' }],
          source: 'DISCOVERED',
        },
      ],
    });

    expect(inferredSpec.endpoints.length).toBe(2);
    expect(inferredSpec.title).toContain('localhost');

    const report = await ApiExplainer.explain(inferredSpec);
    expect(report.endpointCount).toBe(2);
    expect(report.docFormat).toBe('Inferred Spec');
    expect(report.resources['Users']).toBeDefined();
    expect(report.resources['Users'][0].path).toBe('/users');
  });
});

