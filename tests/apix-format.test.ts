import { describe, it, expect } from 'vitest';
import { ApixFormatParser } from '../src/core/format/apix-format.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('ApixFormatParser', () => {
  it('generates, parses, and converts sample .apix YAML file', () => {
    const yamlStr = ApixFormatParser.generateSampleApixYaml('Homely API');
    expect(yamlStr).toContain('name: Homely API');

    const parsed = ApixFormatParser.parseYaml(yamlStr);
    expect(parsed.name).toBe('Homely API');
    expect(parsed.requests?.length).toBe(3);

    const spec = ApixFormatParser.convertToApiSpec(parsed);
    expect(spec.title).toBe('Homely API');
    expect(spec.endpoints.length).toBe(3);
  });

  it('saves and loads .apix files from disk', async () => {
    const testFile = path.join(os.tmpdir(), `test_${Date.now()}.apix`);
    const yamlStr = ApixFormatParser.generateSampleApixYaml('Disk Test');
    
    await ApixFormatParser.saveFile(testFile, ApixFormatParser.parseYaml(yamlStr));
    const loaded = await ApixFormatParser.loadFile(testFile);

    expect(loaded.name).toBe('Disk Test');
    await fs.unlink(testFile);
  });
});
