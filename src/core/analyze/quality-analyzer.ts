import type { ApiSpec, QualityReport } from '../../types/index.js';

export class QualityAnalyzer {
  public static analyze(spec: ApiSpec): QualityReport {
    const totalEndpoints = spec.endpoints.length;
    if (totalEndpoints === 0) {
      return {
        score: 0,
        documentationCoverage: 0,
        schemaCoverage: 0,
        errorDefinitionCoverage: 0,
        exampleCoverage: 0,
        totalEndpoints: 0,
        endpointsWithoutDescriptions: [],
        endpointsWithoutSchemas: [],
        endpointsWithoutErrors: [],
        endpointsWithoutExamples: [],
        warnings: ['No endpoints found in API specification'],
        suggestions: ['Define paths and operations in your OpenAPI document.'],
      };
    }

    const withoutDescriptions: string[] = [];
    const withoutSchemas: string[] = [];
    const withoutErrors: string[] = [];
    const withoutExamples: string[] = [];

    let documentedCount = 0;
    let schemaCount = 0;
    let errorCount = 0;
    let exampleCount = 0;

    for (const ep of spec.endpoints) {
      const epLabel = `${ep.method} ${ep.path}`;

      // Documentation
      if (ep.description || (ep.summary && ep.summary !== epLabel)) {
        documentedCount++;
      } else {
        withoutDescriptions.push(epLabel);
      }

      // Schema
      const hasResponseSchema = ep.responses.some((r) => Boolean(r.schema));
      const hasBodySchema = ep.requestBody ? Boolean(ep.requestBody.schema) : true;
      if (hasResponseSchema && hasBodySchema) {
        schemaCount++;
      } else {
        withoutSchemas.push(epLabel);
      }

      // Errors
      const hasErrorDef = ep.responses.some((r) => {
        const code = String(r.statusCode);
        return code.startsWith('4') || code.startsWith('5') || code === 'default';
      });
      if (hasErrorDef) {
        errorCount++;
      } else {
        withoutErrors.push(epLabel);
      }

      // Examples
      const hasExamples =
        ep.parameters.some((p) => p.example !== undefined) ||
        Boolean(ep.requestBody?.example) ||
        ep.responses.some((r) => r.example !== undefined);
      if (hasExamples) {
        exampleCount++;
      } else {
        withoutExamples.push(epLabel);
      }
    }

    const docPct = Math.round((documentedCount / totalEndpoints) * 100);
    const schemaPct = Math.round((schemaCount / totalEndpoints) * 100);
    const errorPct = Math.round((errorCount / totalEndpoints) * 100);
    const examplePct = Math.round((exampleCount / totalEndpoints) * 100);

    const overallScore = Math.round(docPct * 0.3 + schemaPct * 0.35 + errorPct * 0.2 + examplePct * 0.15);

    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (withoutDescriptions.length > 0) {
      warnings.push(`${withoutDescriptions.length} endpoint(s) lack descriptions or summaries`);
      suggestions.push('Add descriptive summaries and detailed descriptions to all operations.');
    }
    if (withoutSchemas.length > 0) {
      warnings.push(`${withoutSchemas.length} endpoint(s) have missing request/response schemas`);
      suggestions.push('Specify explicit JSON schemas for responses and request bodies.');
    }
    if (withoutErrors.length > 0) {
      warnings.push(`${withoutErrors.length} endpoint(s) do not document error responses (4xx/5xx)`);
      suggestions.push('Document standard error payloads (e.g. 400 Bad Request, 401 Unauthorized, 404 Not Found).');
    }
    if (withoutExamples.length > 0) {
      warnings.push(`${withoutExamples.length} endpoint(s) have no request/response examples`);
      suggestions.push('Include realistic JSON examples in request bodies and responses.');
    }

    return {
      score: overallScore,
      documentationCoverage: docPct,
      schemaCoverage: schemaPct,
      errorDefinitionCoverage: errorPct,
      exampleCoverage: examplePct,
      totalEndpoints,
      endpointsWithoutDescriptions: withoutDescriptions,
      endpointsWithoutSchemas: withoutSchemas,
      endpointsWithoutErrors: withoutErrors,
      endpointsWithoutExamples: withoutExamples,
      warnings,
      suggestions,
    };
  }
}
