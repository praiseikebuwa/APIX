import { describe, it, expect } from 'vitest';
import { CodeGenerator } from '../src/core/generators/index.js';

describe('CodeGenerator', () => {
  const reqConfig = {
    url: 'https://api.example.com/users',
    method: 'POST' as const,
    headers: {
      Authorization: 'Bearer secret_token_123',
      'Content-Type': 'application/json',
    },
    body: {
      name: 'Praise',
      email: 'praise@example.com',
    },
  };

  it('generates cURL command', () => {
    const code = CodeGenerator.generate('curl', reqConfig);
    expect(code).toContain('-X POST');
    expect(code).toContain('"https://api.example.com/users"');
    expect(code).toContain('-H "Authorization: Bearer secret_token_123"');
    expect(code).toContain('-d "{\\"name\\":\\"Praise\\",\\"email\\":\\"praise@example.com\\"}"');
  });

  it('generates JavaScript fetch code', () => {
    const code = CodeGenerator.generate('javascript', reqConfig);
    expect(code).toContain('const url = "https://api.example.com/users";');
    expect(code).toContain('method: "POST"');
    expect(code).toContain('fetch(url, options)');
  });

  it('generates Python requests code', () => {
    const code = CodeGenerator.generate('python', reqConfig);
    expect(code).toContain('import requests');
    expect(code).toContain('requests.request(');
    expect(code).toContain('method="POST"');
  });

  it('generates Go net/http code', () => {
    const code = CodeGenerator.generate('go', reqConfig);
    expect(code).toContain('package main');
    expect(code).toContain('http.NewRequest("POST", url, body)');
  });

  it('generates Rust reqwest code', () => {
    const code = CodeGenerator.generate('rust', reqConfig);
    expect(code).toContain('use reqwest::header');
    expect(code).toContain('.post("https://api.example.com/users")');
  });
});
