import { describe, it, expect } from 'vitest';
import { OpenApiParser } from '../src/core/openapi/parser.js';

describe('OpenApiParser', () => {
  const sampleOpenApi3 = JSON.stringify({
    openapi: '3.0.0',
    info: {
      title: 'Pet Store API',
      version: '1.2.0',
      description: 'A sample pet store API',
    },
    servers: [{ url: 'https://api.petstore.com/v1' }],
    paths: {
      '/pets': {
        get: {
          summary: 'List all pets',
          operationId: 'listPets',
          tags: ['pets'],
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
            },
          ],
          responses: {
            '200': {
              description: 'A paged array of pets',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Pet' },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: 'Create a pet',
          operationId: 'createPet',
          tags: ['pets'],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NewPet' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Null response',
            },
          },
        },
      },
      '/pets/{id}': {
        get: {
          summary: 'Info for a specific pet',
          operationId: 'showPetById',
          tags: ['pets'],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Expected response to a valid request',
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Pet: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
          },
        },
        NewPet: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
          },
        },
      },
    },
  });

  it('parses OpenAPI 3.0 spec properly', () => {
    const spec = OpenApiParser.parse(sampleOpenApi3);
    expect(spec.title).toBe('Pet Store API');
    expect(spec.version).toBe('1.2.0');
    expect(spec.baseUrl).toBe('https://api.petstore.com/v1');
    expect(spec.endpoints.length).toBe(3);

    const listPets = spec.endpoints.find((e) => e.id === 'listPets');
    expect(listPets).toBeDefined();
    expect(listPets?.method).toBe('GET');
    expect(listPets?.path).toBe('/pets');
    expect(listPets?.parameters[0].name).toBe('limit');
    expect(listPets?.parameters[0].required).toBe(false);

    const createPet = spec.endpoints.find((e) => e.id === 'createPet');
    expect(createPet).toBeDefined();
    expect(createPet?.method).toBe('POST');
    expect(createPet?.requestBody?.required).toBe(true);
    expect(createPet?.requestBody?.schema?.properties?.name).toBeDefined();
  });

  it('parses Swagger 2.0 specs properly', () => {
    const swagger2 = JSON.stringify({
      swagger: '2.0',
      info: { title: 'Legacy API', version: '2.0.0' },
      host: 'localhost:8080',
      basePath: '/api',
      schemes: ['http'],
      paths: {
        '/users': {
          get: {
            summary: 'Get all users',
            responses: {
              '200': { description: 'Success' },
            },
          },
        },
      },
    });

    const spec = OpenApiParser.parse(swagger2);
    expect(spec.title).toBe('Legacy API');
    expect(spec.baseUrl).toBe('http://localhost:8080/api');
    expect(spec.endpoints.length).toBe(1);
    expect(spec.endpoints[0].method).toBe('GET');
    expect(spec.endpoints[0].path).toBe('/users');
  });
});
