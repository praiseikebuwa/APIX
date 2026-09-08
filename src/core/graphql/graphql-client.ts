import { HttpClient } from '../client/http-client.js';

export interface GraphQlOperation {
  name: string;
  kind: 'query' | 'mutation';
  args: { name: string; type: string }[];
  returnType: string;
}

export interface GraphQlSchemaInfo {
  types: string[];
  queries: GraphQlOperation[];
  mutations: GraphQlOperation[];
}

export class GraphQlClient {
  private client: HttpClient;

  constructor(client?: HttpClient) {
    this.client = client || new HttpClient();
  }

  public async introspect(endpointUrl: string, headers?: Record<string, string>): Promise<GraphQlSchemaInfo> {
    const introspectionQuery = `
      query IntrospectSchema {
        __schema {
          queryType { name }
          mutationType { name }
          types {
            name
            kind
            fields {
              name
              type { name kind ofType { name kind } }
              args { name type { name kind } }
            }
          }
        }
      }
    `;

    const resp = await this.client.request({
      url: endpointUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {}),
      },
      body: { query: introspectionQuery },
    });

    if (resp.status >= 400 || !resp.data?.data?.__schema) {
      throw new Error(`GraphQL introspection failed (HTTP ${resp.status}): ${resp.rawData.slice(0, 100)}`);
    }

    const schema = resp.data.data.__schema;
    const queryTypeName = schema.queryType?.name || 'Query';
    const mutationTypeName = schema.mutationType?.name || 'Mutation';

    const queries: GraphQlOperation[] = [];
    const mutations: GraphQlOperation[] = [];
    const types: string[] = [];

    if (Array.isArray(schema.types)) {
      for (const t of schema.types) {
        if (!t.name || t.name.startsWith('__')) continue;
        types.push(t.name);

        if (t.name === queryTypeName && Array.isArray(t.fields)) {
          for (const f of t.fields) {
            queries.push({
              name: f.name,
              kind: 'query',
              args: Array.isArray(f.args) ? f.args.map((a: any) => ({ name: a.name, type: a.type?.name || 'String' })) : [],
              returnType: f.type?.name || f.type?.ofType?.name || 'Object',
            });
          }
        }

        if (t.name === mutationTypeName && Array.isArray(t.fields)) {
          for (const f of t.fields) {
            mutations.push({
              name: f.name,
              kind: 'mutation',
              args: Array.isArray(f.args) ? f.args.map((a: any) => ({ name: a.name, type: a.type?.name || 'String' })) : [],
              returnType: f.type?.name || f.type?.ofType?.name || 'Object',
            });
          }
        }
      }
    }

    return {
      types,
      queries,
      mutations,
    };
  }

  public async query(
    endpointUrl: string,
    queryStr: string,
    variables?: Record<string, any>,
    headers?: Record<string, string>
  ): Promise<any> {
    return this.client.request({
      url: endpointUrl,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(headers || {}),
      },
      body: {
        query: queryStr,
        variables,
      },
    });
  }
}
