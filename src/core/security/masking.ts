const SENSITIVE_HEADER_REGEX = /^(authorization|proxy-authorization|x-api-key|api-key|apikey|token|x-auth-token|secret|x-secret|cookie|set-cookie)$/i;

export function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 6) return '******';
  return `${secret.slice(0, 3)}****${secret.slice(-3)}`;
}

export function maskHeaders(headers: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_REGEX.test(key)) {
      if (key.toLowerCase() === 'authorization' && value.toLowerCase().startsWith('bearer ')) {
        const token = value.slice(7);
        masked[key] = `Bearer ${maskSecret(token)}`;
      } else if (key.toLowerCase() === 'authorization' && value.toLowerCase().startsWith('basic ')) {
        masked[key] = 'Basic ******';
      } else {
        masked[key] = maskSecret(value);
      }
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

export function maskBody(body: any): any {
  if (!body) return body;
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(maskBody(parsed), null, 2);
    } catch {
      return body;
    }
  }
  if (typeof body !== 'object') return body;

  if (Array.isArray(body)) {
    return body.map(maskBody);
  }

  const result: Record<string, any> = {};
  const sensitiveKeys = ['password', 'secret', 'token', 'apiKey', 'access_token', 'refresh_token', 'private_key'];
  for (const [key, val] of Object.entries(body)) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      result[key] = typeof val === 'string' ? maskSecret(val) : '******';
    } else if (typeof val === 'object' && val !== null) {
      result[key] = maskBody(val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

// Regex to strip ANSI escape sequences, OSC codes, and terminal control chars
const ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

export function stripAnsi(text: string): string {
  if (!text) return '';
  return text.replace(ANSI_REGEX, '');
}

export function sanitizeTerminalOutput(text: string): string {
  if (!text) return '';
  return stripAnsi(text).replace(CONTROL_CHARS_REGEX, '');
}
