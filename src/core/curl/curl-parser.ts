import type { HttpMethod, HttpRequestConfig } from '../../types/index.js';

export class CurlParser {
  public static parse(curlCmd: string): HttpRequestConfig {
    const trimmed = curlCmd.trim().replace(/^curl\s+/i, '');
    const tokens = this.tokenize(trimmed);

    let method: HttpMethod = 'GET';
    let url = '';
    const headers: Record<string, string> = {};
    let body: any = undefined;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token === '-X' || token === '--request') {
        const next = tokens[++i];
        if (next) method = next.toUpperCase() as HttpMethod;
      } else if (token === '-H' || token === '--header') {
        const headerStr = tokens[++i];
        if (headerStr) {
          const colonIdx = headerStr.indexOf(':');
          if (colonIdx > 0) {
            const key = headerStr.slice(0, colonIdx).trim();
            const val = headerStr.slice(colonIdx + 1).trim();
            headers[key] = val;
          }
        }
      } else if (
        token === '-d' ||
        token === '--data' ||
        token === '--data-raw' ||
        token === '--data-binary'
      ) {
        const dataStr = tokens[++i];
        if (dataStr) {
          if (method === 'GET') method = 'POST';
          try {
            body = JSON.parse(dataStr);
          } catch {
            body = dataStr;
          }
        }
      } else if (token === '--url') {
        const next = tokens[++i];
        if (next) url = next;
      } else if (!token.startsWith('-') && !url) {
        url = token;
      }
    }

    if (!url) {
      throw new Error('Could not parse target URL from curl command');
    }

    // Clean surrounding quotes from URL if any
    url = url.replace(/^['"]|['"]$/g, '');

    return {
      url,
      method,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body,
    };
  }

  private static tokenize(str: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let inQuote: "'" | '"' | null = null;
    let escape = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (escape) {
        current += char;
        escape = false;
        continue;
      }

      if (char === '\\') {
        escape = true;
        continue;
      }

      if (inQuote) {
        if (char === inQuote) {
          inQuote = null;
        } else {
          current += char;
        }
      } else {
        if (char === "'" || char === '"') {
          inQuote = char;
        } else if (/\s/.test(char)) {
          if (current) {
            tokens.push(current);
            current = '';
          }
        } else {
          current += char;
        }
      }
    }

    if (current) {
      tokens.push(current);
    }

    return tokens;
  }
}
