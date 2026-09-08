import { describe, it, expect, beforeEach } from 'vitest';
import { NlRequestBuilder } from '../src/core/ai/nl-request-builder.js';
import { ProjectManager } from '../src/core/projects/project-manager.js';
import { SessionRecorder } from '../src/core/history/session-recorder.js';
import type { ApiSpec } from '../src/types/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('NlRequestBuilder', () => {
  const sampleSpec: ApiSpec = {
    title: 'Booking System API',
    version: '1.0.0',
    baseUrl: 'https://api.bookings.com',
    servers: ['https://api.bookings.com'],
    endpoints: [
      {
        id: 'listBookings',
        method: 'GET',
        path: '/bookings',
        summary: 'List all bookings',
        tags: ['bookings'],
        parameters: [
          { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } },
        ],
        responses: [],
        source: 'DOCUMENTED',
      },
      {
        id: 'createUser',
        method: 'POST',
        path: '/users',
        summary: 'Create a new user',
        tags: ['users'],
        parameters: [],
        requestBody: { contentType: 'application/json', example: { name: 'Sample' } },
        responses: [],
        source: 'DOCUMENTED',
      },
    ],
    schemas: {},
  };

  it('maps "get the first 10 bookings" to GET /bookings?limit=10', () => {
    const proposal = NlRequestBuilder.proposeRequest('get the first 10 bookings', sampleSpec);
    expect(proposal).not.toBeNull();
    expect(proposal?.method).toBe('GET');
    expect(proposal?.url).toBe('https://api.bookings.com/bookings');
    expect(proposal?.query).toEqual({ limit: 10 });
  });

  it('maps "Create a user named Praise" to POST /users with body payload', () => {
    const proposal = NlRequestBuilder.proposeRequest('Create a user named Praise with email praise@example.com', sampleSpec);
    expect(proposal).not.toBeNull();
    expect(proposal?.method).toBe('POST');
    expect(proposal?.url).toBe('https://api.bookings.com/users');
    expect(proposal?.body).toEqual({ name: 'Praise', email: 'praise@example.com' });
  });
});

describe('ProjectManager', () => {
  const testDir = path.join(os.tmpdir(), `apix_project_${Date.now()}`);

  it('initializes a shareable .apix project folder structure', async () => {
    const apixDir = await ProjectManager.initProject(testDir);
    expect(apixDir).toContain('.apix');

    const configStat = await fs.stat(path.join(apixDir, 'config.yaml'));
    expect(configStat.isFile()).toBe(true);

    const envStat = await fs.stat(path.join(apixDir, 'environments', 'local.json'));
    expect(envStat.isFile()).toBe(true);

    await fs.rm(testDir, { recursive: true, force: true });
  });
});
