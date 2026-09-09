import YAML from 'yaml';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  ApiCollection,
  ApiEndpoint,
  ApiSavedRequest,
  ApiSpec,
  Environment,
  HttpMethod,
  RequestAssertion,
  Workflow,
} from '../../types/index.js';

export interface ApixFileSchema {
  version: number | string;
  name: string;
  description?: string;
  baseUrl: string;
  environments?: Record<
    string,
    {
      baseUrl: string;
      variables?: Record<string, string>;
      isProduction?: boolean;
    }
  >;
  auth?: {
    type: 'bearer' | 'api-key' | 'basic' | 'custom-header';
    token?: string;
    apiKey?: string;
    headerName?: string;
    username?: string;
    password?: string;
  };
  requests?: {
    name: string;
    method: HttpMethod;
    path: string;
    summary?: string;
    headers?: Record<string, string>;
    query?: Record<string, any>;
    body?: any;
    tests?: {
      expect: {
        status?: number;
        path?: string;
        type?: string;
        equals?: any;
      };
    }[];
  }[];
  workflows?: {
    name: string;
    description?: string;
    steps: {
      request: string;
      save?: Record<string, string>;
      variables?: Record<string, any>;
    }[];
  }[];
}

export class ApixFormatParser {
  public static parseYaml(content: string): ApixFileSchema {
    try {
      const parsed = YAML.parse(content);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid .apix file content: Root must be a YAML object');
      }
      return parsed as ApixFileSchema;
    } catch (e: any) {
      throw new Error(`Failed to parse .apix YAML format: ${e.message}`);
    }
  }

  public static async loadFile(filePath: string): Promise<ApixFileSchema> {
    const resolvedPath = path.resolve(filePath);
    const content = await fs.readFile(resolvedPath, 'utf-8');
    return this.parseYaml(content);
  }

  public static async saveFile(filePath: string, schema: ApixFileSchema): Promise<void> {
    const resolvedPath = path.resolve(filePath);
    const yamlStr = YAML.stringify(schema);
    await fs.writeFile(resolvedPath, yamlStr, 'utf-8');
  }

  public static convertToApiSpec(apixData: ApixFileSchema): ApiSpec {
    const endpoints: ApiEndpoint[] = (apixData.requests || []).map((req, i) => {
      const assertions: RequestAssertion[] = (req.tests || []).map((t, idx) => ({
        id: `ast_${idx}`,
        type: t.expect.status ? 'status' : 'jsonpath',
        expression: t.expect.status ? 'status' : t.expect.path || 'status',
        operator: t.expect.status ? 'equals' : 'exists',
        expected: t.expect.status || t.expect.equals,
      }));

      return {
        id: req.name.toLowerCase().replace(/[^a-z0-9]/g, '_') || `req_${i}`,
        method: req.method,
        path: req.path,
        summary: req.summary || req.name,
        tags: ['General'],
        parameters: [],
        requestBody: req.body
          ? { contentType: 'application/json', example: req.body }
          : undefined,
        responses: [
          {
            statusCode: 200,
            description: 'OK',
          },
        ],
        source: 'DOCUMENTED',
      };
    });

    return {
      title: apixData.name || 'APiX Project',
      version: String(apixData.version || '1.0.0'),
      description: apixData.description,
      baseUrl: apixData.baseUrl || 'http://localhost:3000',
      servers: [apixData.baseUrl || 'http://localhost:3000'],
      endpoints,
      schemas: {},
    };
  }

  public static generateSampleApixYaml(name: string = 'gas API'): string {
    const sample: ApixFileSchema = {
      version: 1,
      name,
      description: 'Executable APiX project format specification',
      baseUrl: '{{baseUrl}}',
      environments: {
        development: {
          baseUrl: 'http://localhost:4000',
          variables: {
            baseUrl: 'http://localhost:4000',
          },
        },
        production: {
          baseUrl: 'https://api.example.com',
          isProduction: true,
          variables: {
            baseUrl: 'https://api.example.com',
          },
        },
      },
      auth: {
        type: 'bearer',
        token: '{{API_TOKEN}}',
      },
      requests: [
        {
          name: 'List Users',
          method: 'GET',
          path: '/users',
          summary: 'Retrieve all users',
          query: { limit: 10, page: 1 },
          tests: [
            {
              expect: {
                status: 200,
              },
            },
          ],
        },
        {
          name: 'Get User By ID',
          method: 'GET',
          path: '/users/{id}',
          summary: 'Retrieve user by ID',
        },
        {
          name: 'Create User',
          method: 'POST',
          path: '/users',
          summary: 'Create a new user',
          body: {
            name: '{{name}}',
            email: '{{email}}',
          },
          tests: [
            {
              expect: {
                status: 201,
              },
            },
          ],
        },
      ],
      workflows: [
        {
          name: 'User Onboarding Flow',
          description: 'Authenticate and fetch user details',
          steps: [
            {
              request: 'Create User',
              save: {
                userId: 'response.id',
              },
            },
            {
              request: 'Get User By ID',
              variables: {
                id: '{{userId}}',
              },
            },
          ],
        },
      ],
    };

    return YAML.stringify(sample);
  }
}
