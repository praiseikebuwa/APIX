import type { ApiSpec, DiffResult } from '../../types/index.js';

export class ApiDiffer {
  public static diff(specA: ApiSpec, specB: ApiSpec): DiffResult {
    const mapA = new Map<string, typeof specA.endpoints[0]>();
    const mapB = new Map<string, typeof specB.endpoints[0]>();

    for (const ep of specA.endpoints) {
      mapA.set(`${ep.method.toUpperCase()} ${ep.path}`, ep);
    }
    for (const ep of specB.endpoints) {
      mapB.set(`${ep.method.toUpperCase()} ${ep.path}`, ep);
    }

    const addedEndpoints: { method: string; path: string; summary?: string }[] = [];
    const removedEndpoints: { method: string; path: string; summary?: string }[] = [];
    const modifiedEndpoints: {
      method: string;
      path: string;
      changes: string[];
      breaking: boolean;
    }[] = [];

    // Find added and modified
    for (const [key, epB] of mapB.entries()) {
      const epA = mapA.get(key);
      if (!epA) {
        addedEndpoints.push({
          method: epB.method,
          path: epB.path,
          summary: epB.summary,
        });
      } else {
        const changes: string[] = [];
        let isBreaking = false;

        // Compare parameters
        const paramsA = new Map(epA.parameters.map((p) => [p.name, p]));
        const paramsB = new Map(epB.parameters.map((p) => [p.name, p]));

        for (const [pName, pB] of paramsB.entries()) {
          const pA = paramsA.get(pName);
          if (!pA) {
            changes.push(`Added parameter: ${pName} (${pB.in}, ${pB.required ? 'required' : 'optional'})`);
            if (pB.required) isBreaking = true;
          } else if (!pA.required && pB.required) {
            changes.push(`Parameter ${pName} changed from optional to required`);
            isBreaking = true;
          }
        }

        for (const [pName, pA] of paramsA.entries()) {
          if (!paramsB.has(pName)) {
            changes.push(`Removed parameter: ${pName} (${pA.in})`);
            if (pA.required) isBreaking = true;
          }
        }

        // Compare Request Body
        if (!epA.requestBody && epB.requestBody?.required) {
          changes.push('Added required request body');
          isBreaking = true;
        } else if (epA.requestBody?.required && !epB.requestBody) {
          changes.push('Removed request body');
        }

        // Compare Responses
        const codesA = new Set(epA.responses.map((r) => String(r.statusCode)));
        const codesB = new Set(epB.responses.map((r) => String(r.statusCode)));

        for (const code of codesB) {
          if (!codesA.has(code)) {
            changes.push(`Added response status: ${code}`);
          }
        }
        for (const code of codesA) {
          if (!codesB.has(code) && code.startsWith('2')) {
            changes.push(`Removed success response status: ${code}`);
            isBreaking = true;
          }
        }

        if (changes.length > 0) {
          modifiedEndpoints.push({
            method: epB.method,
            path: epB.path,
            changes,
            breaking: isBreaking,
          });
        }
      }
    }

    // Find removed
    for (const [key, epA] of mapA.entries()) {
      if (!mapB.has(key)) {
        removedEndpoints.push({
          method: epA.method,
          path: epA.path,
          summary: epA.summary,
        });
      }
    }

    // Schema changes
    const schemaChanges: string[] = [];
    const schemasA = specA.schemas || {};
    const schemasB = specB.schemas || {};

    for (const sName of Object.keys(schemasB)) {
      if (!schemasA[sName]) {
        schemaChanges.push(`Added schema: ${sName}`);
      }
    }
    for (const sName of Object.keys(schemasA)) {
      if (!schemasB[sName]) {
        schemaChanges.push(`Removed schema: ${sName}`);
      }
    }

    return {
      addedEndpoints,
      removedEndpoints,
      modifiedEndpoints,
      schemaChanges,
    };
  }
}
