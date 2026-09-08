import Ajv from 'ajv';
import type {
  ApiResponseDefinition,
  AssertionResult,
  HttpResponse,
  RequestAssertion,
} from '../../types/index.js';

export class AssertionRunner {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
  }

  public runAssertion(assertion: RequestAssertion, response: HttpResponse): AssertionResult {
    const actual = this.resolveExpression(assertion.expression, response);

    switch (assertion.operator) {
      case 'equals': {
        const passed = actual === assertion.expected;
        return {
          passed,
          assertion,
          actual,
          message: passed
            ? `Assertion passed: ${assertion.expression} == ${assertion.expected}`
            : `Assertion failed: expected ${assertion.expression} to equal ${assertion.expected}, got ${actual}`,
        };
      }
      case 'not_equals': {
        const passed = actual !== assertion.expected;
        return {
          passed,
          assertion,
          actual,
          message: passed
            ? `Assertion passed: ${assertion.expression} != ${assertion.expected}`
            : `Assertion failed: expected ${assertion.expression} not to equal ${assertion.expected}`,
        };
      }
      case 'contains': {
        const passed =
          actual !== undefined &&
          actual !== null &&
          String(actual).includes(String(assertion.expected));
        return {
          passed,
          assertion,
          actual,
          message: passed
            ? `Assertion passed: ${assertion.expression} contains "${assertion.expected}"`
            : `Assertion failed: expected ${assertion.expression} to contain "${assertion.expected}", got "${actual}"`,
        };
      }
      case 'not_contains': {
        const passed =
          actual === undefined ||
          actual === null ||
          !String(actual).includes(String(assertion.expected));
        return {
          passed,
          assertion,
          actual,
          message: passed
            ? `Assertion passed: ${assertion.expression} does not contain "${assertion.expected}"`
            : `Assertion failed: ${assertion.expression} contains "${assertion.expected}"`,
        };
      }
      case 'greater_than': {
        const passed = Number(actual) > Number(assertion.expected);
        return {
          passed,
          assertion,
          actual,
          message: passed
            ? `Assertion passed: ${assertion.expression} (${actual}) > ${assertion.expected}`
            : `Assertion failed: expected ${assertion.expression} > ${assertion.expected}, got ${actual}`,
        };
      }
      case 'less_than': {
        const passed = Number(actual) < Number(assertion.expected);
        return {
          passed,
          assertion,
          actual,
          message: passed
            ? `Assertion passed: ${assertion.expression} (${actual}) < ${assertion.expected}`
            : `Assertion failed: expected ${assertion.expression} < ${assertion.expected}, got ${actual}`,
        };
      }
      case 'exists': {
        const passed = actual !== undefined && actual !== null;
        return {
          passed,
          assertion,
          actual,
          message: passed
            ? `Assertion passed: ${assertion.expression} exists`
            : `Assertion failed: expected ${assertion.expression} to exist`,
        };
      }
      case 'matches': {
        const regex = new RegExp(String(assertion.expected));
        const passed = regex.test(String(actual));
        return {
          passed,
          assertion,
          actual,
          message: passed
            ? `Assertion passed: ${assertion.expression} matches ${assertion.expected}`
            : `Assertion failed: ${assertion.expression} ("${actual}") does not match ${assertion.expected}`,
        };
      }
      default:
        return {
          passed: false,
          assertion,
          actual,
          message: `Unknown assertion operator: ${assertion.operator}`,
        };
    }
  }

  public validateContract(
    response: HttpResponse,
    responseDef?: ApiResponseDefinition,
    schemas?: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    if (!responseDef || !responseDef.schema) {
      return { valid: true, errors: [] };
    }

    try {
      let schema = responseDef.schema;
      if (schemas && Object.keys(schemas).length > 0) {
        schema = {
          ...schema,
          components: { schemas },
        };
      }

      const validate = this.ajv.compile(schema);
      const valid = Boolean(validate(response.data));

      if (!valid && validate.errors) {
        const errors = validate.errors.map(
          (err) => `${err.instancePath || 'root'} ${err.message || 'invalid'}`
        );
        return { valid: false, errors };
      }

      return { valid: true, errors: [] };
    } catch (e: any) {
      return { valid: false, errors: [`Schema compilation error: ${e.message}`] };
    }
  }

  private resolveExpression(expr: string, response: HttpResponse): any {
    const cleanExpr = expr.trim();
    if (cleanExpr === 'status' || cleanExpr === 'statusCode') {
      return response.status;
    }
    if (cleanExpr === 'duration' || cleanExpr === 'time') {
      return response.timing.total;
    }
    if (cleanExpr.startsWith('headers.')) {
      const headerName = cleanExpr.slice(8).toLowerCase();
      return response.headers[headerName];
    }

    let target: any = response.data;
    let path = cleanExpr;
    if (path.startsWith('response.data.')) {
      path = path.slice(14);
    } else if (path.startsWith('data.')) {
      path = path.slice(5);
    } else if (path.startsWith('response.')) {
      path = path.slice(9);
    }

    if (!target || typeof target !== 'object') return undefined;

    // Evaluate dot notation and array index like users[0].id
    const parts = path.replace(/\[(\w+)\]/g, '.$1').split('.');
    for (const part of parts) {
      if (target === undefined || target === null) return undefined;
      target = target[part];
    }
    return target;
  }
}
