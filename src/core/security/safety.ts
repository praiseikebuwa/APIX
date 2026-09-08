import readline from 'node:readline';
import type { HttpMethod } from '../../types/index.js';

export function isDangerousMethod(method: HttpMethod): boolean {
  return ['DELETE', 'PUT', 'PATCH'].includes(method.toUpperCase());
}

export function isProductionUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();

    // Local / private IP patterns are NOT production
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      return false;
    }

    // Production signals
    if (
      hostname.includes('prod') ||
      hostname.includes('production') ||
      hostname.includes('live') ||
      hostname.startsWith('api.') ||
      hostname.startsWith('app.')
    ) {
      return true;
    }

    // Any publicly routable HTTPS domain defaults to safe handling
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function shouldPromptConfirmation(
  method: HttpMethod,
  isProduction: boolean,
  force: boolean = false
): boolean {
  if (force) return false;
  return isDangerousMethod(method) && isProduction;
}

export async function promptCliConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<boolean>((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes');
    });
  });
}
