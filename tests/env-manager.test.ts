import { describe, it, expect, beforeEach } from 'vitest';
import { EnvManager } from '../src/core/environments/env-manager.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('EnvManager', () => {
  let envManager: EnvManager;
  const testDir = path.join(os.tmpdir(), `apix_test_${Date.now()}`);

  beforeEach(async () => {
    envManager = new EnvManager(testDir);
    await envManager.init();
  });

  it('initializes default environments', () => {
    const envs = envManager.getEnvironments();
    expect(envs.length).toBeGreaterThan(0);
    expect(envs.some((e) => e.name === 'production')).toBe(true);
  });

  it('interpolates variables properly', () => {
    envManager.setVariable('local', 'userId', '42');
    const result = envManager.interpolate('https://api.example.com/users/{{userId}}');
    expect(result).toBe('https://api.example.com/users/42');
  });

  it('switches active environment', () => {
    envManager.setActiveEnvironment('staging');
    expect(envManager.getActiveEnvironment().name).toBe('staging');
  });
});
