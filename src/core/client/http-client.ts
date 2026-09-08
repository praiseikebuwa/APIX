import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import type { HttpRequestConfig, HttpResponse, HttpTimingBreakdown } from '../../types/index.js';
import { sanitizeTerminalOutput } from '../security/masking.js';

export interface HttpClientError extends Error {
  code?: string;
  url?: string;
  statusCode?: number;
  details?: string;
}

export class HttpClient {
  private defaultTimeout: number = 20000;
  private maxBodySize: number = 10 * 1024 * 1024; // 10MB limit

  public async request(config: HttpRequestConfig): Promise<HttpResponse> {
    const urlObj = new URL(config.url);

    // Apply query parameters
    if (config.query) {
      for (const [k, v] of Object.entries(config.query)) {
        if (v !== undefined && v !== null) {
          urlObj.searchParams.set(k, String(v));
        }
      }
    }

    return this.executeWithRedirects(urlObj.toString(), config, 0);
  }

  private executeWithRedirects(
    currentUrl: string,
    config: HttpRequestConfig,
    redirectCount: number
  ): Promise<HttpResponse> {
    const maxRedirects = config.maxRedirects ?? 5;
    if (redirectCount > maxRedirects) {
      const err = new Error(`Exceeded maximum redirect limit of ${maxRedirects}`) as HttpClientError;
      err.code = 'ERR_TOO_MANY_REDIRECTS';
      return Promise.reject(err);
    }

    return new Promise<HttpResponse>((resolve, reject) => {
      const parsedUrl = new URL(currentUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const transport = isHttps ? https : http;

      const headers: Record<string, string> = {
        'User-Agent': 'APiX-Client/1.0.0',
        Accept: '*/*',
        ...(config.headers || {}),
      };

      let bodyData: string | Buffer | undefined = undefined;
      if (config.body !== undefined && config.body !== null) {
        if (typeof config.body === 'object') {
          bodyData = JSON.stringify(config.body);
          if (!headers['Content-Type'] && !headers['content-type']) {
            headers['Content-Type'] = 'application/json';
          }
        } else {
          bodyData = String(config.body);
        }
        headers['Content-Length'] = Buffer.byteLength(bodyData).toString();
      }

      const requestOptions: https.RequestOptions = {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: config.method,
        headers,
        timeout: config.timeoutMs ?? this.defaultTimeout,
        rejectUnauthorized: !config.allowInsecure,
      };

      const start = performance.now();
      let dnsStart = 0;
      let dnsTime = 0;
      let tcpStart = 0;
      let tcpTime = 0;
      let tlsStart = 0;
      let tlsTime = 0;
      let firstByteTime = 0;

      const req = transport.request(requestOptions);

      req.on('socket', (socket) => {
        socket.on('lookup', () => {
          dnsTime = Math.max(1, Math.round(performance.now() - start));
          tcpStart = performance.now();
        });

        socket.on('connect', () => {
          if (tcpStart > 0) {
            tcpTime = Math.max(1, Math.round(performance.now() - tcpStart));
          }
          tlsStart = performance.now();
        });

        socket.on('secureConnect', () => {
          if (tlsStart > 0) {
            tlsTime = Math.max(1, Math.round(performance.now() - tlsStart));
          }
        });
      });

      req.on('response', (res) => {
        firstByteTime = Math.max(1, Math.round(performance.now() - start));

        // Check for redirects
        if (
          res.statusCode &&
          [301, 302, 303, 307, 308].includes(res.statusCode) &&
          res.headers.location
        ) {
          req.destroy();
          const nextUrl = new URL(res.headers.location, currentUrl).toString();
          // For 303 or 301/302 from POST, change method to GET if needed
          const nextConfig = { ...config };
          if (res.statusCode === 303 || ((res.statusCode === 301 || res.statusCode === 302) && config.method === 'POST')) {
            nextConfig.method = 'GET';
            delete nextConfig.body;
          }
          this.executeWithRedirects(nextUrl, nextConfig, redirectCount + 1)
            .then(resolve)
            .catch(reject);
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        const limit = config.maxBodySize ?? this.maxBodySize;

        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > limit) {
            req.destroy();
            const err = new Error(`Response body exceeded limit of ${Math.round(limit / (1024 * 1024))}MB`) as HttpClientError;
            err.code = 'ERR_BODY_TOO_LARGE';
            reject(err);
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          const totalDuration = Math.max(1, Math.round(performance.now() - start));
          const downloadTime = Math.max(0, totalDuration - firstByteTime);
          const ttfb = Math.max(1, firstByteTime - (dnsTime + tcpTime + tlsTime));

          const timing: HttpTimingBreakdown = {
            dns: dnsTime,
            tcp: tcpTime,
            tls: tlsTime,
            ttfb: ttfb > 0 ? ttfb : firstByteTime,
            download: downloadTime,
            total: totalDuration,
          };

          const rawBuffer = Buffer.concat(chunks);
          const rawData = sanitizeTerminalOutput(rawBuffer.toString('utf-8'));
          const contentTypeHeader = (res.headers['content-type'] as string) || '';
          const contentType = contentTypeHeader.toLowerCase();

          let data: any = rawData;
          let isJson = false;
          let isHtml = false;
          let isXml = false;
          let isBinary = false;

          if (contentType.includes('application/json') || contentType.includes('+json')) {
            isJson = true;
            try {
              data = JSON.parse(rawData);
            } catch {
              // fallback to rawData
            }
          } else if (contentType.includes('text/html')) {
            isHtml = true;
          } else if (contentType.includes('xml')) {
            isXml = true;
          } else if (
            contentType.includes('octet-stream') ||
            contentType.includes('image/') ||
            contentType.includes('audio/') ||
            contentType.includes('video/') ||
            contentType.includes('pdf')
          ) {
            isBinary = true;
            data = `[Binary Data: ${rawBuffer.length} bytes]`;
          }

          const response: HttpResponse = {
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            headers: res.headers as Record<string, string | string[]>,
            data,
            rawData,
            contentType,
            sizeBytes: rawBuffer.length,
            timing,
            url: currentUrl,
            method: config.method,
            isJson,
            isHtml,
            isXml,
            isBinary,
          };

          resolve(response);
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const err = new Error(`Request timed out after ${config.timeoutMs ?? this.defaultTimeout}ms`) as HttpClientError;
        err.code = 'ETIMEDOUT';
        err.url = currentUrl;
        reject(err);
      });

      req.on('error', (e: any) => {
        const err = new Error(this.formatFriendlyErrorMessage(e, currentUrl)) as HttpClientError;
        err.code = e.code;
        err.url = currentUrl;
        err.details = e.stack;
        reject(err);
      });

      if (bodyData) {
        req.write(bodyData);
      }
      req.end();
    });
  }

  private formatFriendlyErrorMessage(err: any, url: string): string {
    const code = err.code || '';
    if (code === 'ECONNREFUSED') {
      return `Connection refused to ${url}. Is the API server running and listening on the specified port?`;
    }
    if (code === 'ENOTFOUND') {
      return `Hostname could not be resolved for ${url}. Please verify the domain name or check your DNS/network.`;
    }
    if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
      return `Connection to ${url} timed out. The server took too long to respond.`;
    }
    if (code === 'CERT_HAS_EXPIRED' || code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      return `TLS/SSL Certificate error for ${url}: ${err.message}. To connect anyway in development, pass --insecure.`;
    }
    return err.message || `Failed to connect to ${url}`;
  }
}
