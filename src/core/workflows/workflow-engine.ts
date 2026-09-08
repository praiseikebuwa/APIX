import { HttpClient } from '../client/http-client.js';
import { EnvManager } from '../environments/env-manager.js';
import { AuthManager } from '../auth/auth-manager.js';
import { AssertionRunner } from '../testing/assertion-runner.js';
import type { AssertionResult, HttpResponse, Workflow, WorkflowStep } from '../../types/index.js';

export interface WorkflowStepResult {
  step: WorkflowStep;
  response?: HttpResponse;
  assertionResults: AssertionResult[];
  extractedVariables: Record<string, any>;
  passed: boolean;
  error?: string;
}

export interface WorkflowRunResult {
  workflow: Workflow;
  stepResults: WorkflowStepResult[];
  passed: boolean;
  durationMs: number;
}

export class WorkflowEngine {
  private client: HttpClient;
  private envManager: EnvManager;
  private authManager: AuthManager;
  private assertionRunner: AssertionRunner;

  constructor(
    client?: HttpClient,
    envManager?: EnvManager,
    authManager?: AuthManager
  ) {
    this.client = client || new HttpClient();
    this.envManager = envManager || new EnvManager();
    this.authManager = authManager || new AuthManager();
    this.assertionRunner = new AssertionRunner();
  }

  public async runWorkflow(
    workflow: Workflow,
    initialVariables: Record<string, any> = {}
  ): Promise<WorkflowRunResult> {
    const start = performance.now();
    const runtimeVariables: Record<string, any> = { ...initialVariables };
    const stepResults: WorkflowStepResult[] = [];
    let allPassed = true;

    for (const step of workflow.steps) {
      const stepRes: WorkflowStepResult = {
        step,
        assertionResults: [],
        extractedVariables: {},
        passed: true,
      };

      try {
        // 1. Interpolate request with current variables
        const activeEnv = this.envManager.getActiveEnvironment();
        const fullUrl = this.envManager.interpolate(
          step.request.path.startsWith('http')
            ? step.request.path
            : `${activeEnv.baseUrl}${step.request.path}`,
          runtimeVariables
        );

        const interpolatedHeaders = this.envManager.interpolateObject(
          step.request.headers || {},
          runtimeVariables
        );
        const interpolatedQuery = this.envManager.interpolateObject(
          step.request.query || {},
          runtimeVariables
        );
        const interpolatedBody = this.envManager.interpolateObject(
          step.request.body,
          runtimeVariables
        );

        let reqConfig = {
          url: fullUrl,
          method: step.request.method,
          headers: interpolatedHeaders,
          query: interpolatedQuery,
          body: interpolatedBody,
        };

        // Apply auth if configured
        if (step.request.authProfileId) {
          reqConfig = this.authManager.applyAuth(reqConfig, step.request.authProfileId);
        }

        // 2. Execute
        const response = await this.client.request(reqConfig);
        stepRes.response = response;

        // 3. Assertions
        if (step.assertions && step.assertions.length > 0) {
          for (const assertion of step.assertions) {
            const aResult = this.assertionRunner.runAssertion(assertion, response);
            stepRes.assertionResults.push(aResult);
            if (!aResult.passed) {
              stepRes.passed = false;
              allPassed = false;
            }
          }
        }

        // 4. Data Extraction
        if (step.extractions && step.extractions.length > 0) {
          for (const ext of step.extractions) {
            const extractedVal = this.extractValue(ext.sourcePath, response);
            if (extractedVal !== undefined) {
              runtimeVariables[ext.targetVariable] = extractedVal;
              stepRes.extractedVariables[ext.targetVariable] = extractedVal;
            }
          }
        }
      } catch (err: any) {
        stepRes.passed = false;
        stepRes.error = err.message || String(err);
        allPassed = false;
      }

      stepResults.push(stepRes);
      if (!stepRes.passed) {
        // Halt chain on step failure
        break;
      }
    }

    return {
      workflow,
      stepResults,
      passed: allPassed,
      durationMs: Math.round(performance.now() - start),
    };
  }

  private extractValue(sourcePath: string, response: HttpResponse): any {
    let cleanPath = sourcePath.trim();
    if (cleanPath.startsWith('response.data.')) cleanPath = cleanPath.slice(14);
    else if (cleanPath.startsWith('response.')) cleanPath = cleanPath.slice(9);
    else if (cleanPath.startsWith('data.')) cleanPath = cleanPath.slice(5);

    let curr: any = response.data;
    if (!curr || typeof curr !== 'object') return undefined;

    const parts = cleanPath.replace(/\[(\w+)\]/g, '.$1').split('.');
    for (const p of parts) {
      if (curr === undefined || curr === null) return undefined;
      curr = curr[p];
    }
    return curr;
  }
}
