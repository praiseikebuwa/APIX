import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import Table from 'cli-table3';
import { render } from 'ink';
import React from 'react';
import { App } from '../tui/app.js';
import { HttpClient } from '../core/client/http-client.js';
import { OpenApiDiscovery } from '../core/discovery/openapi-discovery.js';
import { SafeProber } from '../core/discovery/probing.js';
import { OpenApiParser } from '../core/openapi/parser.js';
import { EnvManager } from '../core/environments/env-manager.js';
import { AuthManager } from '../core/auth/auth-manager.js';
import { HistoryManager } from '../core/history/history-manager.js';
import { CollectionManager } from '../core/collections/collection-manager.js';
import { CodeGenerator, type SupportedLanguage } from '../core/generators/index.js';
import { AssertionRunner } from '../core/testing/assertion-runner.js';
import { ApiDiffer } from '../core/diff/api-diff.js';
import { DocsGenerator } from '../core/docs/docs-generator.js';
import { MockServer } from '../core/mock/mock-server.js';
import { QualityAnalyzer } from '../core/analyze/quality-analyzer.js';
import { ApiExplainer } from '../core/analyze/api-explainer.js';
import { CurlParser } from '../core/curl/curl-parser.js';
import { ConfigManager } from '../core/config/config-manager.js';
import { NlRequestBuilder } from '../core/ai/nl-request-builder.js';
import { SessionRecorder } from '../core/history/session-recorder.js';
import { ProjectManager } from '../core/projects/project-manager.js';
import { Benchmarker } from '../core/benchmark/benchmarker.js';
import { GraphQlClient } from '../core/graphql/graphql-client.js';
import { PluginManager } from '../core/plugins/plugin-manager.js';
import { isDangerousMethod, isProductionUrl, promptCliConfirmation } from '../core/security/safety.js';
import type { HttpMethod, HttpRequestConfig } from '../types/index.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('apix')
    .description('APiX: Universal terminal-native API exploration, testing, and automation platform')
    .version('1.0.0');

  // Default action: Connect URL or launch interactive Terminal UI
  program
    .argument('[url]', 'Target API URL to explore')
    .action(async (urlArg?: string) => {
      if (urlArg && (urlArg.startsWith('http://') || urlArg.startsWith('https://'))) {
        render(React.createElement(App, { initialUrl: urlArg }));
      } else {
        render(React.createElement(App, {}));
      }
    });

  // apix benchmark <endpoint>
  program
    .command('benchmark <endpoint>')
    .description('Run load benchmarking against an endpoint (measures RPS, P50, P95, P99 latencies)')
    .option('-X, --method <method>', 'HTTP method', 'GET')
    .option('-n, --requests <number>', 'Total number of requests', '100')
    .option('-c, --concurrency <number>', 'Concurrency level', '5')
    .option('--force', 'Bypass production safety warning')
    .action(async (endpoint: string, options: { method: string; requests: string; concurrency: string; force?: boolean }) => {
      const envManager = new EnvManager();
      await envManager.init();
      const activeEnv = envManager.getActiveEnvironment();

      const method = options.method.toUpperCase() as HttpMethod;
      const fullUrl = endpoint.startsWith('http') ? endpoint : `${activeEnv.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

      if (isProductionUrl(fullUrl) && !options.force) {
        const confirm = await promptCliConfirmation(
          chalk.red(`⚠ WARNING: About to run load benchmark against PRODUCTION [${fullUrl}]. Continue?`)
        );
        if (!confirm) {
          console.log(chalk.yellow('Benchmark canceled.'));
          process.exit(0);
        }
      }

      const totalRequests = parseInt(options.requests, 10) || 100;
      const concurrency = parseInt(options.concurrency, 10) || 5;

      console.log(chalk.cyan(`Running load benchmark: ${totalRequests} requests against ${method} ${fullUrl} (concurrency: ${concurrency})...\n`));

      const benchmarker = new Benchmarker();
      const res = await benchmarker.runBenchmark({
        url: fullUrl,
        method,
        totalRequests,
        concurrency,
      });

      console.log(boxen(
        `${chalk.bold('BENCHMARK RESULTS')}\n\n` +
          `Target:       ${chalk.bold(res.url)}\n` +
          `Requests:     ${res.totalRequests} total (${chalk.green(`${res.successful} successful`)}, ${res.failed > 0 ? chalk.red(`${res.failed} failed`) : '0 failed'})\n` +
          `Total Duration: ${res.totalTimeMs}ms\n` +
          `Throughput:   ${chalk.green(`${res.requestsPerSecond} req/sec`)}\n\n` +
          `Latency Distribution:\n` +
          `  Average:    ${res.avgMs}ms\n` +
          `  Min:        ${res.minMs}ms\n` +
          `  P50:        ${chalk.cyan(`${res.p50Ms}ms`)}\n` +
          `  P90:        ${res.p90Ms}ms\n` +
          `  P95:        ${chalk.yellow(`${res.p95Ms}ms`)}\n` +
          `  P99:        ${chalk.red(`${res.p99Ms}ms`)}\n` +
          `  Max:        ${res.maxMs}ms`,
        { padding: 1, borderColor: 'cyan', borderStyle: 'round' }
      ));
    });

  // apix graphql <url>
  program
    .command('graphql <url>')
    .description('Introspect and query a GraphQL API endpoint')
    .option('-q, --query <query>', 'GraphQL query string')
    .action(async (urlStr: string, options: { query?: string }) => {
      const gqlClient = new GraphQlClient();

      if (options.query) {
        console.log(chalk.cyan(`Executing GraphQL Query against ${urlStr}...`));
        const resp = await gqlClient.query(urlStr, options.query);
        console.log(`\nStatus: ${resp.status} ${resp.statusText}\n`);
        console.log(JSON.stringify(resp.data, null, 2));
      } else {
        console.log(chalk.cyan(`Introspecting GraphQL schema at ${urlStr}...`));
        try {
          const info = await gqlClient.introspect(urlStr);
          console.log(boxen(
            `${chalk.bold('GRAPHQL SCHEMA INTROSPECTION')}\n\n` +
              `Queries:   ${info.queries.length}\n` +
              `Mutations: ${info.mutations.length}\n` +
              `Types:     ${info.types.length}`,
            { padding: 1, borderColor: 'magenta' }
          ));

          if (info.queries.length > 0) {
            console.log(chalk.bold('\nQueries:\n'));
            for (const q of info.queries) {
              console.log(`  • ${chalk.cyan(q.name)} (${q.args.map((a) => `${a.name}: ${a.type}`).join(', ')}): ${q.returnType}`);
            }
          }
        } catch (e: any) {
          console.error(chalk.red(`GraphQL Introspection error: ${e.message}`));
        }
      }
    });

  // apix plugin [cmd]
  program
    .command('plugin [cmd] [name]')
    .description('Manage APiX plugins (list, install)')
    .action(async (cmd: string = 'list', name?: string) => {
      const pluginManager = new PluginManager();
      await pluginManager.init();

      if (cmd === 'list') {
        const plugins = pluginManager.getPlugins();
        console.log(chalk.bold('\nInstalled APiX Plugins:\n'));
        for (const p of plugins) {
          console.log(`  ❯ ${chalk.cyan(p.name.padEnd(30))} (v${p.version}) - ${chalk.gray(p.description)}`);
        }
        console.log('');
      } else if (cmd === 'install' && name) {
        const p = await pluginManager.installPlugin(name);
        console.log(chalk.green(`✓ Installed plugin "${p.name}"`));
      }
    });

  // apix explain [url] - API Intelligence Report
  program
    .command('explain [url]')
    .description('Analyze connected API and output intelligence report (resources, schemas, health, potential issues)')
    .action(async (urlArg?: string) => {
      const envManager = new EnvManager();
      await envManager.init();
      const targetUrl = urlArg || envManager.getActiveEnvironment().baseUrl;

      const discovery = new OpenApiDiscovery();
      const result = await discovery.discover(targetUrl);
      if (!result) {
        console.log(chalk.yellow(`No OpenAPI spec found at ${targetUrl} to explain.`));
        return;
      }

      const report = await ApiExplainer.explain(result.spec);

      console.log(boxen(
        `${chalk.bold('API ANALYSIS REPORT')}\n` +
          `────────────────────────────────────────\n\n` +
          `Name:           ${chalk.bold(report.name)}\n` +
          `Version:        ${report.version}\n` +
          `Protocol:       ${report.protocol}\n` +
          `Documentation:  ${report.docFormat}\n` +
          `Endpoints:      ${report.endpointCount}\n` +
          `Schemas:        ${report.schemaCount}\n` +
          `Authentication: ${report.authType}\n` +
          `Health:         ${report.healthStatus}`,
        { padding: 1, borderColor: 'cyan', borderStyle: 'round' }
      ));

      console.log(chalk.bold('\nResources:\n'));
      for (const [tag, items] of Object.entries(report.resources)) {
        console.log(chalk.cyan(`  ${tag}`));
        for (const item of items) {
          console.log(`   ├── ${chalk.bold(item.method.padEnd(6))} ${item.path}`);
        }
        console.log('');
      }

      if (report.potentialIssues.length > 0) {
        console.log(chalk.bold('Potential Issues:\n'));
        for (const issue of report.potentialIssues) {
          console.log(`  ${issue}`);
        }
      }
    });

  // Direct HTTP Method Shorthands: GET, POST, PUT, DELETE, PATCH
  ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].forEach((method) => {
    program
      .command(`${method} <url>`)
      .description(`Directly execute HTTP ${method} request against target URL`)
      .option('-d, --data <data>', 'JSON payload body')
      .option('-H, --header <header...>', 'Headers (e.g. -H "Authorization: Bearer ...")')
      .action(async (urlStr: string, options: { data?: string; header?: string[] }) => {
        const authManager = new AuthManager();
        await authManager.init();

        const headers: Record<string, string> = {};
        if (options.header) {
          for (const h of options.header) {
            const idx = h.indexOf(':');
            if (idx > 0) headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
          }
        }

        let parsedBody: any = undefined;
        if (options.data) {
          try {
            parsedBody = JSON.parse(options.data);
          } catch {
            parsedBody = options.data;
          }
        }

        let reqConfig: HttpRequestConfig = {
          url: urlStr,
          method: method as HttpMethod,
          headers,
          body: parsedBody,
        };

        reqConfig = authManager.applyAuth(reqConfig);
        const client = new HttpClient();

        console.log(chalk.cyan(`Executing ${method} ${urlStr}...`));
        try {
          const resp = await client.request(reqConfig);
          console.log(`\nStatus: ${resp.status} ${resp.statusText} (${resp.timing.total}ms)\n`);
          console.log(typeof resp.data === 'object' ? JSON.stringify(resp.data, null, 2) : resp.rawData);
        } catch (e: any) {
          console.error(chalk.red(`Request failed: ${e.message}`));
          process.exit(1);
        }
      });
  });

  // apix connect <url>
  program
    .command('connect <url>')
    .description('Connect to an API and launch the interactive explorer')
    .option('--openapi <location>', 'Explicit OpenAPI spec URL or file path')
    .option('--insecure', 'Allow insecure TLS / self-signed certificates')
    .action(async (url: string, options: { openapi?: string; insecure?: boolean }) => {
      render(React.createElement(App, { initialUrl: url }));
    });

  // apix ping <url>
  program
    .command('ping [url]')
    .description('Test connectivity and latency to an API without modifying state')
    .option('--insecure', 'Allow insecure TLS')
    .action(async (urlArg?: string, options?: { insecure?: boolean }) => {
      const envManager = new EnvManager();
      await envManager.init();
      const targetUrl = urlArg || envManager.getActiveEnvironment().baseUrl;

      console.log(chalk.cyan(`Pinging ${targetUrl}...`));
      const client = new HttpClient();
      try {
        const resp = await client.request({
          url: targetUrl,
          method: 'GET',
          allowInsecure: options?.insecure,
          timeoutMs: 5000,
        });

        console.log(
          boxen(
            `${chalk.green('✓ REACHABLE')}\n\n` +
              `Target:       ${chalk.bold(targetUrl)}\n` +
              `Status:       ${chalk.green(`${resp.status} ${resp.statusText}`)}\n` +
              `Total Time:   ${chalk.bold(`${resp.timing.total}ms`)}\n` +
              `DNS:          ${resp.timing.dns}ms\n` +
              `TCP:          ${resp.timing.tcp}ms\n` +
              `TLS:          ${resp.timing.tls}ms\n` +
              `Server TTFB:  ${resp.timing.ttfb}ms\n` +
              `Server:       ${resp.headers['server'] || 'Unknown'}`,
            { padding: 1, borderColor: 'green', borderStyle: 'round' }
          )
        );
      } catch (err: any) {
        console.error(
          boxen(
            `${chalk.red('✗ UNREACHABLE')}\n\n` +
              `Target:  ${chalk.bold(targetUrl)}\n` +
              `Reason:  ${err.message}\n` +
              `Code:    ${err.code || 'UNKNOWN'}`,
            { padding: 1, borderColor: 'red', borderStyle: 'round' }
          )
        );
        process.exit(1);
      }
    });

  // apix ask "<query>" - Natural Language API Control
  program
    .command('ask <query>')
    .description('Construct an API request using natural language (e.g., "get the first 10 bookings")')
    .option('--url <url>', 'Target API URL')
    .option('--force', 'Execute request without interactive confirmation')
    .action(async (query: string, options: { url?: string; force?: boolean }) => {
      const envManager = new EnvManager();
      const authManager = new AuthManager();
      await envManager.init();
      await authManager.init();

      const targetUrl = options.url || envManager.getActiveEnvironment().baseUrl;
      const discovery = new OpenApiDiscovery();
      const result = await discovery.discover(targetUrl);

      if (!result) {
        console.log(chalk.yellow(`No OpenAPI spec found at ${targetUrl} to interpret natural language query.`));
        return;
      }

      const proposal = NlRequestBuilder.proposeRequest(query, result.spec);
      if (!proposal) {
        console.log(chalk.red(`Could not map query "${query}" to an endpoint.`));
        return;
      }

      console.log(boxen(
        `${chalk.bold('APiX Natural Language Proposal')}\n\n` +
          `Query:       "${chalk.yellow(query)}"\n` +
          `Method:      ${chalk.bold(proposal.method)}\n` +
          `URL:         ${chalk.cyan(proposal.url)}\n` +
          `Query Params: ${JSON.stringify(proposal.query)}\n` +
          `Body:        ${proposal.body ? JSON.stringify(proposal.body) : 'None'}\n\n` +
          `${chalk.gray(proposal.explanation)}`,
        { padding: 1, borderColor: 'cyan' }
      ));

      let confirm = options.force;
      if (!confirm) {
        confirm = await promptCliConfirmation(chalk.bold('Execute this request?'));
      }

      if (confirm) {
        const client = new HttpClient();
        let reqConfig: HttpRequestConfig = {
          url: proposal.url,
          method: proposal.method,
          query: proposal.query,
          body: proposal.body,
        };
        reqConfig = authManager.applyAuth(reqConfig);
        const resp = await client.request(reqConfig);
        console.log(`\nStatus: ${resp.status} ${resp.statusText} (${resp.timing.total}ms)\n`);
        console.log(typeof resp.data === 'object' ? JSON.stringify(resp.data, null, 2) : resp.rawData);
      } else {
        console.log(chalk.yellow('Request canceled.'));
      }
    });

  // apix endpoints [url]
  program
    .command('endpoints [url]')
    .description('List all discovered endpoints for the active or specified API')
    .option('--openapi <path>', 'Path to local or remote OpenAPI spec')
    .action(async (urlArg?: string, options?: { openapi?: string }) => {
      const envManager = new EnvManager();
      await envManager.init();
      const targetUrl = urlArg || envManager.getActiveEnvironment().baseUrl;

      const discovery = new OpenApiDiscovery();
      const result = await discovery.discover(targetUrl, options?.openapi);

      if (!result) {
        console.log(chalk.yellow(`No OpenAPI spec found at ${targetUrl}. Run "apix connect" for probing.`));
        return;
      }

      console.log(chalk.bold(`\n${result.spec.title} (v${result.spec.version}) - ${result.spec.endpoints.length} Endpoints\n`));

      const table = new Table({
        head: [chalk.cyan('Method'), chalk.cyan('Path'), chalk.cyan('Tag'), chalk.cyan('Summary')],
        colWidths: [10, 35, 15, 40],
      });

      for (const ep of result.spec.endpoints) {
        const color =
          ep.method === 'GET'
            ? chalk.green
            : ep.method === 'POST'
            ? chalk.blue
            : ep.method === 'DELETE'
            ? chalk.red
            : chalk.yellow;
        table.push([color(ep.method), ep.path, ep.tags[0] || 'General', (ep.summary || '').slice(0, 35)]);
      }

      console.log(table.toString());
    });

  // apix search <query>
  program
    .command('search <query>')
    .description('Search endpoints, parameters, and schemas')
    .option('--url <url>', 'Target API URL')
    .action(async (query: string, options?: { url?: string }) => {
      const envManager = new EnvManager();
      await envManager.init();
      const targetUrl = options?.url || envManager.getActiveEnvironment().baseUrl;

      const discovery = new OpenApiDiscovery();
      const result = await discovery.discover(targetUrl);
      if (!result) {
        console.log(chalk.yellow('No active API spec found to search.'));
        return;
      }

      const q = query.toLowerCase();
      const matches = result.spec.endpoints.filter(
        (e) =>
          e.path.toLowerCase().includes(q) ||
          e.method.toLowerCase().includes(q) ||
          (e.summary && e.summary.toLowerCase().includes(q)) ||
          e.parameters.some((p) => p.name.toLowerCase().includes(q))
      );

      console.log(chalk.cyan(`Found ${matches.length} matches for "${query}":\n`));
      for (const m of matches) {
        console.log(`  ${chalk.bold(m.method.padEnd(7))} ${chalk.white(m.path)} - ${chalk.gray(m.summary || '')}`);
      }
    });

  // apix run <endpoint>
  program
    .command('run <endpoint>')
    .description('Execute an API endpoint from the command line')
    .option('-X, --method <method>', 'HTTP method', 'GET')
    .option('-d, --data <data>', 'JSON request body')
    .option('-H, --header <header...>', 'Custom headers (e.g. -H "Authorization: Bearer ...")')
    .option('--force', 'Bypass production safety confirmation')
    .action(async (endpoint: string, options: { method: string; data?: string; header?: string[]; force?: boolean }) => {
      const envManager = new EnvManager();
      const authManager = new AuthManager();
      const historyManager = new HistoryManager();
      await envManager.init();
      await authManager.init();
      await historyManager.init();

      const activeEnv = envManager.getActiveEnvironment();
      const method = options.method.toUpperCase() as HttpMethod;
      const fullUrl = endpoint.startsWith('http') ? endpoint : `${activeEnv.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

      // Production safety check
      const isProd = activeEnv.isProduction || isProductionUrl(fullUrl);
      if (isDangerousMethod(method) && isProd && !options.force) {
        const confirmed = await promptCliConfirmation(
          chalk.red(`⚠ WARNING: About to execute destructive ${method} against PRODUCTION [${fullUrl}]. Continue?`)
        );
        if (!confirmed) {
          console.log(chalk.yellow('Operation canceled by user.'));
          process.exit(0);
        }
      }

      const headers: Record<string, string> = {};
      if (options.header) {
        for (const h of options.header) {
          const idx = h.indexOf(':');
          if (idx > 0) {
            headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
          }
        }
      }

      let parsedBody: any = undefined;
      if (options.data) {
        try {
          parsedBody = JSON.parse(options.data);
        } catch {
          parsedBody = options.data;
        }
      }

      let reqConfig: HttpRequestConfig = {
        url: fullUrl,
        method,
        headers,
        body: parsedBody,
      };

      reqConfig = authManager.applyAuth(reqConfig);

      console.log(chalk.cyan(`Executing ${method} ${fullUrl}...`));
      const client = new HttpClient();
      try {
        const resp = await client.request(reqConfig);
        await historyManager.record(reqConfig, resp, activeEnv.name);

        const statusColor = resp.status >= 200 && resp.status < 300 ? chalk.green : chalk.red;
        console.log(`\nStatus: ${statusColor(`${resp.status} ${resp.statusText}`)}  Time: ${chalk.bold(`${resp.timing.total}ms`)}  Size: ${(resp.sizeBytes / 1024).toFixed(2)} KB\n`);

        if (resp.isJson && typeof resp.data === 'object') {
          console.log(JSON.stringify(resp.data, null, 2));
        } else {
          console.log(resp.rawData);
        }
      } catch (err: any) {
        console.error(chalk.red(`\nRequest failed: ${err.message}`));
        process.exit(1);
      }
    });

  // apix test [target] - CI/CD Mode support
  program
    .command('test [target]')
    .description('Run automated contract tests & assertions (supports CI/CD exit code 1 on failure)')
    .option('--ci', 'Run in strict CI/CD mode (fails process if any test fails)')
    .action(async (target?: string, options?: { ci?: boolean }) => {
      console.log(chalk.cyan('Running APiX Contract & Endpoint Tests...\n'));
      const envManager = new EnvManager();
      await envManager.init();
      const targetUrl = target || envManager.getActiveEnvironment().baseUrl;

      const discovery = new OpenApiDiscovery();
      const result = await discovery.discover(targetUrl);
      if (!result) {
        console.log(chalk.yellow(`No OpenAPI spec available at ${targetUrl} for contract testing.`));
        if (options?.ci) process.exit(1);
        return;
      }

      const client = new HttpClient();
      let passed = 0;
      let failed = 0;

      for (const ep of result.spec.endpoints.slice(0, 5)) {
        if (ep.method === 'GET' && !ep.parameters.some((p) => p.required)) {
          try {
            const resp = await client.request({
              url: `${result.spec.baseUrl}${ep.path}`,
              method: 'GET',
              timeoutMs: 5000,
            });

            const statusMatch = resp.status < 400;
            if (statusMatch) {
              console.log(`${chalk.green('✓')} ${ep.method.padEnd(6)} ${ep.path.padEnd(25)} ${chalk.green(resp.status)} (${resp.timing.total}ms)`);
              passed++;
            } else {
              console.log(`${chalk.red('✗')} ${ep.method.padEnd(6)} ${ep.path.padEnd(25)} ${chalk.red(resp.status)} (${resp.timing.total}ms)`);
              failed++;
            }
          } catch (e: any) {
            console.log(`${chalk.red('✗')} ${ep.method.padEnd(6)} ${ep.path.padEnd(25)} Error: ${e.message}`);
            failed++;
          }
        }
      }

      console.log(`\nResults: ${chalk.green(`${passed} passed`)}, ${failed > 0 ? chalk.red(`${failed} failed`) : '0 failed'}`);
      if (failed > 0 && options?.ci) {
        console.error(chalk.red('\nCI Test Run Failed. Exiting with code 1.'));
        process.exit(1);
      }
    });

  // apix diff <spec1> <spec2>
  program
    .command('diff <spec1> <spec2>')
    .description('Compare two OpenAPI specifications to detect breaking changes and schema diffs')
    .action(async (spec1Path: string, spec2Path: string) => {
      const discovery = new OpenApiDiscovery();
      const specA = await discovery.importFromFile(spec1Path);
      const specB = await discovery.importFromFile(spec2Path);

      const diff = ApiDiffer.diff(specA, specB);

      console.log(boxen(chalk.bold('API SPECIFICATION DIFF'), { padding: 1, borderColor: 'cyan' }));

      if (diff.addedEndpoints.length > 0) {
        console.log(chalk.green('\n+ ADDED ENDPOINTS:'));
        for (const ep of diff.addedEndpoints) {
          console.log(chalk.green(`  + ${ep.method} ${ep.path} ${ep.summary ? `(${ep.summary})` : ''}`));
        }
      }

      if (diff.removedEndpoints.length > 0) {
        console.log(chalk.red('\n- REMOVED ENDPOINTS:'));
        for (const ep of diff.removedEndpoints) {
          console.log(chalk.red(`  - ${ep.method} ${ep.path} ${ep.summary ? `(${ep.summary})` : ''}`));
        }
      }

      if (diff.modifiedEndpoints.length > 0) {
        console.log(chalk.yellow('\n~ MODIFIED ENDPOINTS:'));
        for (const ep of diff.modifiedEndpoints) {
          console.log(chalk.yellow(`  ~ ${ep.method} ${ep.path} ${ep.breaking ? chalk.red('[BREAKING]') : ''}`));
          for (const c of ep.changes) {
            console.log(chalk.gray(`      • ${c}`));
          }
        }
      }

      if (
        diff.addedEndpoints.length === 0 &&
        diff.removedEndpoints.length === 0 &&
        diff.modifiedEndpoints.length === 0
      ) {
        console.log(chalk.green('\nNo endpoint changes detected between specifications.'));
      }
    });

  // apix docs generate [spec]
  program
    .command('docs [action] [spec]')
    .description('Generate documentation from an API spec (markdown, html, json)')
    .option('-f, --format <format>', 'Output format: markdown, html, json', 'markdown')
    .action(async (action: string = 'generate', specPath?: string, options?: { format: string }) => {
      const discovery = new OpenApiDiscovery();
      const envManager = new EnvManager();
      await envManager.init();
      const targetUrl = specPath || envManager.getActiveEnvironment().baseUrl;

      let spec;
      if (specPath && (specPath.endsWith('.json') || specPath.endsWith('.yaml') || specPath.endsWith('.yml'))) {
        spec = await discovery.importFromFile(specPath);
      } else {
        const res = await discovery.discover(targetUrl);
        spec = res?.spec;
      }

      if (!spec) {
        console.log(chalk.red('Could not locate an API specification to document.'));
        return;
      }

      if (options?.format === 'html') {
        console.log(DocsGenerator.generateHtml(spec));
      } else if (options?.format === 'json') {
        console.log(JSON.stringify(spec, null, 2));
      } else {
        console.log(DocsGenerator.generateMarkdown(spec));
      }
    });

  // apix generate <lang> <endpoint>
  program
    .command('generate <lang> <endpoint>')
    .description('Generate code snippet for an endpoint (curl, javascript, typescript, python, go, java, php, dart, csharp, rust)')
    .option('-X, --method <method>', 'HTTP method', 'GET')
    .action((lang: string, endpoint: string, options: { method: string }) => {
      const code = CodeGenerator.generate(lang as SupportedLanguage, {
        url: endpoint.startsWith('http') ? endpoint : `http://localhost:3000${endpoint}`,
        method: options.method.toUpperCase() as HttpMethod,
      });
      console.log(code);
    });

  // apix project init - Shareable .apix Projects
  program
    .command('project <cmd>')
    .description('Manage shareable Git-committed .apix projects (init)')
    .action(async (cmd: string) => {
      if (cmd === 'init') {
        const apixDir = await ProjectManager.initProject();
        console.log(chalk.green(`✓ Initialized shareable APiX project at ${apixDir}`));
        console.log(chalk.gray('Commit the .apix/ directory to Git to share API workflows and collections with your team.'));
      }
    });

  // apix save <name> & apix use <name> & apix list
  program
    .command('save <name>')
    .description('Save current connected API to local collection store')
    .action(async (name: string) => {
      const collectionManager = new CollectionManager();
      await collectionManager.init();
      collectionManager.createCollection(name);
      await collectionManager.save();
      console.log(chalk.green(`✓ Saved collection "${name}"`));
    });

  program
    .command('list')
    .description('List all saved APIs and collections')
    .action(async () => {
      const collectionManager = new CollectionManager();
      await collectionManager.init();
      const collections = collectionManager.getCollections();
      console.log(chalk.bold('\nSaved APIs & Collections:\n'));
      for (const c of collections) {
        console.log(`  ❯ ${chalk.cyan(c.name.padEnd(25))} (${c.requests.length} requests)`);
      }
      console.log('');
    });

  // apix import <type> <source>
  program
    .command('import <type> <source>')
    .description('Import an OpenAPI spec, Postman collection, or cURL command (openapi | curl | collection)')
    .action(async (type: string, source: string) => {
      if (type.toLowerCase() === 'curl') {
        const config = CurlParser.parse(source);
        console.log(boxen(
          `${chalk.green('✓ PARSED cURL COMMAND')}\n\n` +
            `Method:  ${chalk.bold(config.method)}\n` +
            `URL:     ${chalk.bold(config.url)}\n` +
            `Headers: ${Object.keys(config.headers || {}).length}\n` +
            `Body:    ${config.body ? 'Detected' : 'None'}`,
          { padding: 1, borderColor: 'green' }
        ));
      } else if (type.toLowerCase() === 'openapi') {
        const discovery = new OpenApiDiscovery();
        const spec = await discovery.importFromFile(source);
        console.log(chalk.green(`✓ Imported OpenAPI: ${spec.title} (${spec.endpoints.length} endpoints)`));
      } else if (type.toLowerCase() === 'collection') {
        const collectionManager = new CollectionManager();
        await collectionManager.init();
        const col = await collectionManager.importCollection(source);
        console.log(chalk.green(`✓ Imported Collection: ${col.name} (${col.requests.length} requests)`));
      } else {
        console.log(chalk.red(`Unknown import type: ${type}. Use "curl", "openapi", or "collection".`));
      }
    });

  // apix env [cmd] [name]
  program
    .command('env [cmd] [name]')
    .description('Manage environments (list, use, create)')
    .action(async (cmd?: string, name?: string) => {
      const envManager = new EnvManager();
      await envManager.init();

      if (!cmd || cmd === 'list') {
        const envs = envManager.getEnvironments();
        const active = envManager.getActiveEnvironment();
        console.log(chalk.bold('\nEnvironments:\n'));
        for (const e of envs) {
          const isActive = e.name === active.name;
          const mark = isActive ? chalk.green('● ') : '  ';
          const nameColored = e.isProduction ? chalk.red(e.name) : chalk.white(e.name);
          console.log(`${mark}${nameColored.padEnd(20)} ${e.baseUrl} ${isActive ? chalk.green('[ACTIVE]') : ''}`);
        }
        console.log('');
      } else if (cmd === 'use' && name) {
        try {
          const activated = envManager.setActiveEnvironment(name);
          await envManager.save();
          console.log(chalk.green(`✓ Switched active environment to [${activated.name}]`));
        } catch (e: any) {
          console.log(chalk.red(e.message));
        }
      }
    });

  // apix history [cmd]
  program
    .command('history [cmd] [id]')
    .description('View and replay past executed requests (list, show, replay, clear)')
    .action(async (cmd: string = 'list', id?: string) => {
      const historyManager = new HistoryManager();
      await historyManager.init();

      if (cmd === 'list') {
        const items = historyManager.getItems(20);
        console.log(chalk.bold(`\nRecent Request History (${items.length} items):\n`));
        for (const it of items) {
          const time = new Date(it.timestamp).toLocaleTimeString();
          const statusColor = it.status >= 200 && it.status < 300 ? chalk.green : chalk.red;
          console.log(`  ${it.id.padEnd(20)} ${time}  ${it.method.padEnd(6)} ${it.path.padEnd(30)} ${statusColor(it.status)} (${it.durationMs}ms)`);
        }
        console.log('');
      } else if (cmd === 'clear') {
        await historyManager.clear();
        console.log(chalk.green('✓ History cleared.'));
      }
    });

  // apix analyze [target]
  program
    .command('analyze [target]')
    .description('Analyze OpenAPI spec completeness and quality score')
    .action(async (target?: string) => {
      const envManager = new EnvManager();
      await envManager.init();
      const targetUrl = target || envManager.getActiveEnvironment().baseUrl;

      const discovery = new OpenApiDiscovery();
      const result = await discovery.discover(targetUrl);
      if (!result) {
        console.log(chalk.yellow('No OpenAPI spec found to analyze.'));
        return;
      }

      const report = QualityAnalyzer.analyze(result.spec);

      console.log(boxen(
        `${chalk.bold('API QUALITY SCORE')}: ${report.score >= 80 ? chalk.green(`${report.score}/100`) : chalk.yellow(`${report.score}/100`)}\n\n` +
          `Documentation Coverage:   ${report.documentationCoverage}%\n` +
          `Schema Coverage:          ${report.schemaCoverage}%\n` +
          `Error Definitions:        ${report.errorDefinitionCoverage}%\n` +
          `Example Coverage:         ${report.exampleCoverage}%\n` +
          `Total Endpoints:          ${report.totalEndpoints}`,
        { padding: 1, borderColor: 'cyan' }
      ));

      if (report.warnings.length > 0) {
        console.log(chalk.yellow('\nWarnings:'));
        for (const w of report.warnings) {
          console.log(`  ⚠ ${w}`);
        }
      }

      if (report.suggestions.length > 0) {
        console.log(chalk.cyan('\nSuggestions:'));
        for (const s of report.suggestions) {
          console.log(`  • ${s}`);
        }
      }
    });

  // apix mock <spec>
  program
    .command('mock <spec>')
    .description('Run a local mock server from an OpenAPI specification')
    .option('-p, --port <port>', 'Port number', '5050')
    .action(async (specPath: string, options: { port: string }) => {
      const discovery = new OpenApiDiscovery();
      const spec = await discovery.importFromFile(specPath);
      const port = parseInt(options.port, 10) || 5050;

      const mock = new MockServer(spec, port);
      const url = await mock.start();
      console.log(boxen(
        `${chalk.green('✓ MOCK API SERVER RUNNING')}\n\n` +
          `URL:       ${chalk.bold(url)}\n` +
          `Endpoints: ${spec.endpoints.length}\n` +
          `Title:     ${spec.title}\n\n` +
          `Press Ctrl+C to stop.`,
        { padding: 1, borderColor: 'green' }
      ));
    });

  // apix config [action] [key] [val]
  program
    .command('config [action] [key] [value]')
    .description('View or update user configuration (get, set, list)')
    .action(async (action: string = 'list', key?: string, value?: string) => {
      const configManager = new ConfigManager();
      await configManager.init();

      if (action === 'list') {
        console.log(JSON.stringify(configManager.getAll(), null, 2));
      } else if (action === 'get' && key) {
        console.log(configManager.get(key as any));
      } else if (action === 'set' && key && value !== undefined) {
        await configManager.set(key as any, value as any);
        console.log(chalk.green(`✓ Set config ${key} = ${value}`));
      }
    });

  return program;
}
