// src/cli/index.ts
import { Command } from "commander";
import chalk from "chalk";
import boxen from "boxen";
import Table from "cli-table3";
import { render } from "ink";
import React12 from "react";
import YAML3 from "yaml";

// src/tui/app.tsx
import { useState as useState11 } from "react";
import { Box as Box14, useInput as useInput12, useApp as useInkApp } from "ink";

// src/tui/context/app-context.tsx
import { createContext, useContext, useState, useEffect } from "react";

// src/core/client/http-client.ts
import http from "http";
import https from "https";
import { URL as URL2 } from "url";

// src/core/security/masking.ts
var SENSITIVE_HEADER_REGEX = /^(authorization|proxy-authorization|x-api-key|api-key|apikey|token|x-auth-token|secret|x-secret|cookie|set-cookie)$/i;
function maskSecret(secret) {
  if (!secret) return "";
  if (secret.length <= 6) return "******";
  return `${secret.slice(0, 3)}****${secret.slice(-3)}`;
}
function maskHeaders(headers) {
  const masked = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_REGEX.test(key)) {
      if (key.toLowerCase() === "authorization" && value.toLowerCase().startsWith("bearer ")) {
        const token = value.slice(7);
        masked[key] = `Bearer ${maskSecret(token)}`;
      } else if (key.toLowerCase() === "authorization" && value.toLowerCase().startsWith("basic ")) {
        masked[key] = "Basic ******";
      } else {
        masked[key] = maskSecret(value);
      }
    } else {
      masked[key] = value;
    }
  }
  return masked;
}
function maskBody(body) {
  if (!body) return body;
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(maskBody(parsed), null, 2);
    } catch {
      return body;
    }
  }
  if (typeof body !== "object") return body;
  if (Array.isArray(body)) {
    return body.map(maskBody);
  }
  const result2 = {};
  const sensitiveKeys = ["password", "secret", "token", "apiKey", "access_token", "refresh_token", "private_key"];
  for (const [key, val] of Object.entries(body)) {
    if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
      result2[key] = typeof val === "string" ? maskSecret(val) : "******";
    } else if (typeof val === "object" && val !== null) {
      result2[key] = maskBody(val);
    } else {
      result2[key] = val;
    }
  }
  return result2;
}
var ANSI_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
var CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
function stripAnsi(text) {
  if (!text) return "";
  return text.replace(ANSI_REGEX, "");
}
function sanitizeTerminalOutput(text) {
  if (!text) return "";
  return stripAnsi(text).replace(CONTROL_CHARS_REGEX, "");
}

// src/core/client/http-client.ts
var HttpClient = class {
  defaultTimeout = 2e4;
  maxBodySize = 10 * 1024 * 1024;
  // 10MB limit
  async request(config) {
    const urlObj = new URL2(config.url);
    if (config.query) {
      for (const [k, v] of Object.entries(config.query)) {
        if (v !== void 0 && v !== null) {
          urlObj.searchParams.set(k, String(v));
        }
      }
    }
    return this.executeWithRedirects(urlObj.toString(), config, 0);
  }
  executeWithRedirects(currentUrl, config, redirectCount) {
    const maxRedirects = config.maxRedirects ?? 5;
    if (redirectCount > maxRedirects) {
      const err = new Error(`Exceeded maximum redirect limit of ${maxRedirects}`);
      err.code = "ERR_TOO_MANY_REDIRECTS";
      return Promise.reject(err);
    }
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL2(currentUrl);
      const isHttps = parsedUrl.protocol === "https:";
      const transport = isHttps ? https : http;
      const headers = {
        "User-Agent": "APiX-Client/1.0.0",
        Accept: "*/*",
        ...config.headers || {}
      };
      let bodyData = void 0;
      if (config.body !== void 0 && config.body !== null) {
        if (typeof config.body === "object") {
          bodyData = JSON.stringify(config.body);
          if (!headers["Content-Type"] && !headers["content-type"]) {
            headers["Content-Type"] = "application/json";
          }
        } else {
          bodyData = String(config.body);
        }
        headers["Content-Length"] = Buffer.byteLength(bodyData).toString();
      }
      const requestOptions = {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: config.method,
        headers,
        timeout: config.timeoutMs ?? this.defaultTimeout,
        rejectUnauthorized: !config.allowInsecure
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
      req.on("socket", (socket) => {
        socket.on("lookup", () => {
          dnsTime = Math.max(1, Math.round(performance.now() - start));
          tcpStart = performance.now();
        });
        socket.on("connect", () => {
          if (tcpStart > 0) {
            tcpTime = Math.max(1, Math.round(performance.now() - tcpStart));
          }
          tlsStart = performance.now();
        });
        socket.on("secureConnect", () => {
          if (tlsStart > 0) {
            tlsTime = Math.max(1, Math.round(performance.now() - tlsStart));
          }
        });
      });
      req.on("response", (res) => {
        firstByteTime = Math.max(1, Math.round(performance.now() - start));
        if (res.statusCode && [301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          req.destroy();
          const nextUrl = new URL2(res.headers.location, currentUrl).toString();
          const nextConfig = { ...config };
          if (res.statusCode === 303 || (res.statusCode === 301 || res.statusCode === 302) && config.method === "POST") {
            nextConfig.method = "GET";
            delete nextConfig.body;
          }
          this.executeWithRedirects(nextUrl, nextConfig, redirectCount + 1).then(resolve).catch(reject);
          return;
        }
        const chunks = [];
        let totalBytes = 0;
        const limit = config.maxBodySize ?? this.maxBodySize;
        res.on("data", (chunk) => {
          totalBytes += chunk.length;
          if (totalBytes > limit) {
            req.destroy();
            const err = new Error(`Response body exceeded limit of ${Math.round(limit / (1024 * 1024))}MB`);
            err.code = "ERR_BODY_TOO_LARGE";
            reject(err);
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          const totalDuration = Math.max(1, Math.round(performance.now() - start));
          const downloadTime = Math.max(0, totalDuration - firstByteTime);
          const ttfb = Math.max(1, firstByteTime - (dnsTime + tcpTime + tlsTime));
          const timing = {
            dns: dnsTime,
            tcp: tcpTime,
            tls: tlsTime,
            ttfb: ttfb > 0 ? ttfb : firstByteTime,
            download: downloadTime,
            total: totalDuration
          };
          const rawBuffer = Buffer.concat(chunks);
          const rawData = sanitizeTerminalOutput(rawBuffer.toString("utf-8"));
          const contentTypeHeader = res.headers["content-type"] || "";
          const contentType = contentTypeHeader.toLowerCase();
          let data = rawData;
          let isJson = false;
          let isHtml = false;
          let isXml = false;
          let isBinary = false;
          if (contentType.includes("application/json") || contentType.includes("+json")) {
            isJson = true;
            try {
              data = JSON.parse(rawData);
            } catch {
            }
          } else if (contentType.includes("text/html")) {
            isHtml = true;
          } else if (contentType.includes("xml")) {
            isXml = true;
          } else if (contentType.includes("octet-stream") || contentType.includes("image/") || contentType.includes("audio/") || contentType.includes("video/") || contentType.includes("pdf")) {
            isBinary = true;
            data = `[Binary Data: ${rawBuffer.length} bytes]`;
          }
          const response = {
            status: res.statusCode || 0,
            statusText: res.statusMessage || "",
            headers: res.headers,
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
            isBinary
          };
          resolve(response);
        });
      });
      req.on("timeout", () => {
        req.destroy();
        const err = new Error(`Request timed out after ${config.timeoutMs ?? this.defaultTimeout}ms`);
        err.code = "ETIMEDOUT";
        err.url = currentUrl;
        reject(err);
      });
      req.on("error", (e) => {
        const err = new Error(this.formatFriendlyErrorMessage(e, currentUrl));
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
  formatFriendlyErrorMessage(err, url) {
    const code = err.code || "";
    if (code === "ECONNREFUSED") {
      return `Connection refused to ${url}. Is the API server running and listening on the specified port?`;
    }
    if (code === "ENOTFOUND") {
      return `Hostname could not be resolved for ${url}. Please verify the domain name or check your DNS/network.`;
    }
    if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT") {
      return `Connection to ${url} timed out. The server took too long to respond.`;
    }
    if (code === "CERT_HAS_EXPIRED" || code === "DEPTH_ZERO_SELF_SIGNED_CERT" || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
      return `TLS/SSL Certificate error for ${url}: ${err.message}. To connect anyway in development, pass --insecure.`;
    }
    return err.message || `Failed to connect to ${url}`;
  }
};

// src/core/discovery/openapi-discovery.ts
import fs from "fs/promises";
import path from "path";

// src/core/openapi/parser.ts
import YAML from "yaml";
var OpenApiParser = class {
  static parse(content, overrideBaseUrl) {
    let raw;
    try {
      raw = JSON.parse(content);
    } catch {
      try {
        raw = YAML.parse(content);
      } catch (e) {
        throw new Error(`Failed to parse specification as JSON or YAML: ${e.message}`);
      }
    }
    if (!raw || typeof raw !== "object") {
      throw new Error("Invalid specification: root must be an object");
    }
    const isSwagger2 = raw.swagger && String(raw.swagger).startsWith("2.");
    const isOpenApi3 = raw.openapi && (String(raw.openapi).startsWith("3.") || String(raw.openapi).startsWith("3.1"));
    if (!isSwagger2 && !isOpenApi3) {
      if (!raw.paths) {
        throw new Error("Unrecognized API specification format. Expected OpenAPI 3.x or Swagger 2.0.");
      }
    }
    return isSwagger2 ? this.parseSwagger2(raw, overrideBaseUrl) : this.parseOpenApi3(raw, overrideBaseUrl);
  }
  static parseOpenApi3(raw, overrideBaseUrl) {
    const title = raw.info?.title || "API";
    const version = raw.info?.version || "1.0.0";
    const description = raw.info?.description || "";
    const servers = [];
    if (Array.isArray(raw.servers) && raw.servers.length > 0) {
      for (const s of raw.servers) {
        if (s?.url) servers.push(s.url);
      }
    }
    const baseUrl = overrideBaseUrl || servers[0] || "http://localhost";
    const schemas = raw.components?.schemas || {};
    const securitySchemes = raw.components?.securitySchemes || {};
    const endpoints = [];
    const paths = raw.paths || {};
    for (const [pathStr, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== "object") continue;
      const commonParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
      const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
      for (const method of methods) {
        const op = pathItem[method.toLowerCase()];
        if (!op) continue;
        const endpointParams = [];
        const allParams = [...commonParams, ...Array.isArray(op.parameters) ? op.parameters : []];
        for (const p of allParams) {
          const resolvedParam = this.resolveRef(p, raw);
          if (resolvedParam && resolvedParam.name && resolvedParam.in) {
            endpointParams.push({
              name: resolvedParam.name,
              in: resolvedParam.in,
              required: Boolean(resolvedParam.required || resolvedParam.in === "path"),
              description: resolvedParam.description,
              schema: resolvedParam.schema ? this.resolveRef(resolvedParam.schema, raw) : void 0,
              example: resolvedParam.example || resolvedParam.schema?.example,
              defaultValue: resolvedParam.schema?.default
            });
          }
        }
        let requestBody = void 0;
        if (op.requestBody) {
          const resolvedBody = this.resolveRef(op.requestBody, raw);
          const content = resolvedBody?.content || {};
          const firstContentType = Object.keys(content)[0] || "application/json";
          const contentObj = content[firstContentType] || {};
          requestBody = {
            description: resolvedBody?.description,
            required: Boolean(resolvedBody?.required),
            contentType: firstContentType,
            schema: contentObj.schema ? this.resolveRef(contentObj.schema, raw) : void 0,
            example: contentObj.example || contentObj.schema?.example
          };
        }
        const responses = [];
        const opResponses = op.responses || {};
        for (const [code, respObj] of Object.entries(opResponses)) {
          const resolvedResp = this.resolveRef(respObj, raw);
          const content = resolvedResp?.content || {};
          const firstContentType = Object.keys(content)[0];
          const contentObj = firstContentType ? content[firstContentType] : void 0;
          responses.push({
            statusCode: code,
            description: resolvedResp?.description || "",
            contentType: firstContentType,
            schema: contentObj?.schema ? this.resolveRef(contentObj.schema, raw) : void 0,
            example: contentObj?.example || contentObj?.schema?.example,
            headers: resolvedResp?.headers
          });
        }
        const security = [];
        const opSec = op.security || raw.security || [];
        if (Array.isArray(opSec)) {
          for (const secReq of opSec) {
            for (const [schemeName, scopes] of Object.entries(secReq)) {
              const schemeDef = securitySchemes[schemeName];
              if (schemeDef) {
                security.push({
                  type: schemeDef.type === "http" && schemeDef.scheme === "bearer" ? "bearer" : schemeDef.type,
                  name: schemeDef.name || schemeName,
                  in: schemeDef.in,
                  scheme: schemeDef.scheme,
                  scopes: Array.isArray(scopes) ? scopes : []
                });
              } else {
                security.push({
                  type: "custom",
                  name: schemeName,
                  scopes: Array.isArray(scopes) ? scopes : []
                });
              }
            }
          }
        }
        const tags = Array.isArray(op.tags) && op.tags.length > 0 ? op.tags : ["General"];
        const id = op.operationId || `${method.toLowerCase()}_${pathStr.replace(/[^a-zA-Z0-9]/g, "_")}`;
        endpoints.push({
          id,
          method,
          path: pathStr,
          summary: op.summary || `${method} ${pathStr}`,
          description: op.description,
          tags,
          parameters: endpointParams,
          requestBody,
          responses,
          security: security.length > 0 ? security : void 0,
          source: "DOCUMENTED"
        });
      }
    }
    return {
      title,
      version,
      description,
      baseUrl,
      servers,
      endpoints,
      schemas,
      securitySchemes,
      rawSpec: raw
    };
  }
  static parseSwagger2(raw, overrideBaseUrl) {
    const title = raw.info?.title || "Swagger API";
    const version = raw.info?.version || "1.0.0";
    const description = raw.info?.description || "";
    const host = raw.host || "localhost";
    const basePath = raw.basePath || "";
    const schemes = Array.isArray(raw.schemes) && raw.schemes.length > 0 ? raw.schemes : ["http"];
    const calculatedBaseUrl = `${schemes[0]}://${host}${basePath.replace(/\/$/, "")}`;
    const baseUrl = overrideBaseUrl || calculatedBaseUrl;
    const schemas = raw.definitions || {};
    const securitySchemes = raw.securityDefinitions || {};
    const endpoints = [];
    const paths = raw.paths || {};
    for (const [pathStr, pathItem] of Object.entries(paths)) {
      if (!pathItem || typeof pathItem !== "object") continue;
      const commonParams = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];
      const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
      for (const method of methods) {
        const op = pathItem[method.toLowerCase()];
        if (!op) continue;
        const endpointParams = [];
        let requestBody = void 0;
        const allParams = [...commonParams, ...Array.isArray(op.parameters) ? op.parameters : []];
        for (const p of allParams) {
          const resolvedParam = this.resolveRef(p, raw);
          if (!resolvedParam) continue;
          if (resolvedParam.in === "body") {
            requestBody = {
              description: resolvedParam.description,
              required: Boolean(resolvedParam.required),
              contentType: raw.consumes && raw.consumes[0] || "application/json",
              schema: resolvedParam.schema ? this.resolveRef(resolvedParam.schema, raw) : void 0,
              example: resolvedParam.schema?.example
            };
          } else if (resolvedParam.name && resolvedParam.in) {
            endpointParams.push({
              name: resolvedParam.name,
              in: resolvedParam.in,
              required: Boolean(resolvedParam.required || resolvedParam.in === "path"),
              description: resolvedParam.description,
              schema: resolvedParam.type ? { type: resolvedParam.type, format: resolvedParam.format } : void 0,
              example: resolvedParam.example,
              defaultValue: resolvedParam.default
            });
          }
        }
        const responses = [];
        const opResponses = op.responses || {};
        for (const [code, respObj] of Object.entries(opResponses)) {
          const resolvedResp = this.resolveRef(respObj, raw);
          responses.push({
            statusCode: code,
            description: resolvedResp?.description || "",
            contentType: raw.produces && raw.produces[0] || "application/json",
            schema: resolvedResp?.schema ? this.resolveRef(resolvedResp.schema, raw) : void 0,
            example: resolvedResp?.schema?.example,
            headers: resolvedResp?.headers
          });
        }
        const tags = Array.isArray(op.tags) && op.tags.length > 0 ? op.tags : ["General"];
        const id = op.operationId || `${method.toLowerCase()}_${pathStr.replace(/[^a-zA-Z0-9]/g, "_")}`;
        endpoints.push({
          id,
          method,
          path: pathStr,
          summary: op.summary || `${method} ${pathStr}`,
          description: op.description,
          tags,
          parameters: endpointParams,
          requestBody,
          responses,
          source: "DOCUMENTED"
        });
      }
    }
    return {
      title,
      version,
      description,
      baseUrl,
      servers: [baseUrl],
      endpoints,
      schemas,
      securitySchemes,
      rawSpec: raw
    };
  }
  static resolveRef(obj, root) {
    if (!obj || typeof obj !== "object") return obj;
    if (!obj.$ref) return obj;
    const ref = obj.$ref;
    if (typeof ref === "string" && ref.startsWith("#/")) {
      const parts = ref.substring(2).split("/");
      let current = root;
      for (const part of parts) {
        if (!current || typeof current !== "object") return obj;
        current = current[part];
      }
      return current || obj;
    }
    return obj;
  }
};

// src/core/discovery/openapi-discovery.ts
var OpenApiDiscovery = class _OpenApiDiscovery {
  client;
  static COMMON_OPENAPI_PATHS = [
    "/openapi.json",
    "/openapi.yaml",
    "/swagger.json",
    "/swagger.yaml",
    "/api-docs",
    "/api-docs/openapi.json",
    "/docs/openapi.json",
    "/v2/api-docs",
    "/v3/api-docs"
  ];
  constructor(client) {
    this.client = client || new HttpClient();
  }
  async discover(targetUrl, explicitLocation, insecure = false) {
    if (explicitLocation) {
      if (explicitLocation.startsWith("http://") || explicitLocation.startsWith("https://")) {
        const resp = await this.client.request({
          url: explicitLocation,
          method: "GET",
          allowInsecure: insecure,
          timeoutMs: 1e4
        });
        if (resp.status >= 200 && resp.status < 300) {
          const spec = OpenApiParser.parse(resp.rawData, targetUrl);
          return { spec, location: explicitLocation };
        }
      } else {
        const resolvedPath = path.resolve(explicitLocation);
        const content = await fs.readFile(resolvedPath, "utf-8");
        const spec = OpenApiParser.parse(content, targetUrl);
        return { spec, location: resolvedPath };
      }
    }
    const baseUrl = targetUrl.replace(/\/$/, "");
    for (const p of _OpenApiDiscovery.COMMON_OPENAPI_PATHS) {
      const probeUrl = `${baseUrl}${p}`;
      try {
        const resp = await this.client.request({
          url: probeUrl,
          method: "GET",
          allowInsecure: insecure,
          timeoutMs: 4e3
        });
        if (resp.status >= 200 && resp.status < 300) {
          const text = resp.rawData.trim();
          if (text.includes('"openapi"') || text.includes('"swagger"') || text.startsWith("openapi:") || text.startsWith("swagger:") || resp.isJson && (resp.data?.paths || resp.data?.openapi || resp.data?.swagger)) {
            try {
              const spec = OpenApiParser.parse(text, baseUrl);
              if (spec.endpoints.length > 0 || spec.rawSpec?.paths) {
                return { spec, location: probeUrl };
              }
            } catch {
            }
          }
        }
      } catch {
      }
    }
    return null;
  }
  async importFromFile(filePath, overrideBaseUrl) {
    const resolvedPath = path.resolve(filePath);
    const content = await fs.readFile(resolvedPath, "utf-8");
    return OpenApiParser.parse(content, overrideBaseUrl);
  }
};

// src/core/discovery/probing.ts
var SafeProber = class _SafeProber {
  client;
  static SAFE_PROBE_PATHS = [
    "/",
    "/health",
    "/healthz",
    "/status",
    "/ping",
    "/info",
    "/metrics",
    "/api",
    "/api/v1",
    "/v1",
    "/api/v2",
    "/v2",
    "/users",
    "/user",
    "/api/users",
    "/auth",
    "/login",
    "/register",
    "/items",
    "/products",
    "/orders",
    "/posts",
    "/comments",
    "/docs"
  ];
  constructor(client) {
    this.client = client || new HttpClient();
  }
  getDefaultResponses(method) {
    switch (method) {
      case "POST":
        return [
          { statusCode: 201, description: "Created", contentType: "application/json" },
          { statusCode: 400, description: "Bad Request", contentType: "application/json" }
        ];
      case "PUT":
      case "PATCH":
        return [
          { statusCode: 200, description: "OK", contentType: "application/json" },
          { statusCode: 400, description: "Bad Request", contentType: "application/json" }
        ];
      case "DELETE":
        return [
          { statusCode: 204, description: "No Content" },
          { statusCode: 404, description: "Not Found" }
        ];
      default:
        return [
          { statusCode: 200, description: "OK", contentType: "application/json" },
          { statusCode: 404, description: "Not Found", contentType: "application/json" }
        ];
    }
  }
  async probe(baseUrlStr, insecure = false) {
    const baseUrl = baseUrlStr.replace(/\/$/, "");
    const isHttps = baseUrl.startsWith("https://");
    let isReachable = false;
    let latencyMs = 0;
    let serverHeader;
    let poweredByHeader;
    let healthStatus;
    const discoveredEndpoints = [];
    try {
      const optionsResp = await this.client.request({
        url: baseUrl,
        method: "OPTIONS",
        allowInsecure: insecure,
        timeoutMs: 4e3
      });
      if (optionsResp.status > 0) {
        isReachable = true;
        latencyMs = optionsResp.timing.total;
        serverHeader = optionsResp.headers["server"];
        poweredByHeader = optionsResp.headers["x-powered-by"];
        const allowHeader = optionsResp.headers["allow"] || optionsResp.headers["access-control-allow-methods"];
        if (allowHeader) {
          const methods = allowHeader.split(",").map((m) => m.trim().toUpperCase());
          for (const m of methods) {
            if (["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].includes(m)) {
              discoveredEndpoints.push({
                id: `${m.toLowerCase()}_root`,
                method: m,
                path: "/",
                summary: `${m} Root Endpoint`,
                tags: ["Discovered"],
                parameters: [],
                responses: this.getDefaultResponses(m),
                source: "DISCOVERED"
              });
            }
          }
        }
      }
    } catch {
    }
    for (const p of _SafeProber.SAFE_PROBE_PATHS) {
      try {
        const resp = await this.client.request({
          url: `${baseUrl}${p}`,
          method: "GET",
          allowInsecure: insecure,
          timeoutMs: 3e3
        });
        if (resp.status >= 200 && resp.status < 500) {
          isReachable = true;
          if (latencyMs === 0) latencyMs = resp.timing.total;
          if (!serverHeader && resp.headers["server"]) {
            serverHeader = resp.headers["server"];
          }
          if (!poweredByHeader && resp.headers["x-powered-by"]) {
            poweredByHeader = resp.headers["x-powered-by"];
          }
          if (p === "/health" || p === "/healthz" || p === "/status" || p === "/ping") {
            healthStatus = `HTTP ${resp.status} ${resp.statusText}`;
          }
          const segments = p.split("/").filter(Boolean);
          const tag = segments.length > 0 ? segments[0].charAt(0).toUpperCase() + segments[0].slice(1) : "Discovered";
          const exists = discoveredEndpoints.some((e) => e.path === p && e.method === "GET");
          if (!exists) {
            const isListEndpoint = Array.isArray(resp.data);
            const queryParams = isListEndpoint ? [
              { name: "limit", in: "query", required: false, description: "Max items to return", schema: { type: "integer" } },
              { name: "page", in: "query", required: false, description: "Page number", schema: { type: "integer" } }
            ] : [];
            discoveredEndpoints.push({
              id: `get_${p.replace(/[^a-zA-Z0-9]/g, "_")}`,
              method: "GET",
              path: p,
              summary: `${p === "/" ? "Root" : p} Endpoint`,
              tags: [tag],
              parameters: queryParams,
              responses: [
                {
                  statusCode: resp.status,
                  description: resp.statusText || "OK",
                  contentType: resp.contentType || "application/json",
                  example: resp.isJson ? resp.data : void 0
                }
              ],
              source: "DISCOVERED"
            });
            if (segments.length === 1 && !["health", "status", "ping", "docs", "metrics", "info"].includes(segments[0])) {
              const singular = segments[0];
              if (!discoveredEndpoints.some((e) => e.path === p && e.method === "POST")) {
                let sampleBody = {};
                if (isListEndpoint && resp.data.length > 0 && typeof resp.data[0] === "object") {
                  const { id, _id, createdAt, updatedAt, ...rest } = resp.data[0];
                  sampleBody = rest;
                }
                discoveredEndpoints.push({
                  id: `post_${singular}`,
                  method: "POST",
                  path: p,
                  summary: `Create ${singular}`,
                  tags: [tag],
                  parameters: [],
                  requestBody: {
                    contentType: "application/json",
                    description: `Payload for creating ${singular}`,
                    example: sampleBody
                  },
                  responses: this.getDefaultResponses("POST"),
                  source: "DISCOVERED"
                });
              }
              const itemPath = `${p}/{id}`;
              if (!discoveredEndpoints.some((e) => e.path === itemPath && e.method === "GET")) {
                discoveredEndpoints.push({
                  id: `get_${singular}_by_id`,
                  method: "GET",
                  path: itemPath,
                  summary: `Get ${singular} by ID`,
                  tags: [tag],
                  parameters: [
                    { name: "id", in: "path", required: true, description: `${singular} identifier`, schema: { type: "string" } }
                  ],
                  responses: this.getDefaultResponses("GET"),
                  source: "DISCOVERED"
                });
              }
            }
          }
        }
      } catch {
      }
    }
    return {
      url: baseUrl,
      isReachable,
      latencyMs,
      serverHeader,
      poweredByHeader,
      tlsStatus: isHttps,
      discoveredEndpoints,
      healthStatus
    };
  }
  createInferredSpec(probeResult) {
    return {
      title: `Discovered API (${new URL(probeResult.url).hostname})`,
      version: "Inferred",
      description: `Discovered without formal OpenAPI specification. Server: ${probeResult.serverHeader || "Unknown"}, Latency: ${probeResult.latencyMs}ms.`,
      baseUrl: probeResult.url,
      servers: [probeResult.url],
      endpoints: probeResult.discoveredEndpoints,
      schemas: {}
    };
  }
};

// src/core/environments/env-manager.ts
import fs2 from "fs/promises";
import os from "os";
import path2 from "path";

// src/core/security/safety.ts
import readline from "readline";
function isDangerousMethod(method) {
  return ["DELETE", "PUT", "PATCH"].includes(method.toUpperCase());
}
function isProductionUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.startsWith("192.168.") || hostname.startsWith("10.") || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) {
      return false;
    }
    if (hostname.includes("prod") || hostname.includes("production") || hostname.includes("live") || hostname.startsWith("api.") || hostname.startsWith("app.")) {
      return true;
    }
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}
async function promptCliConfirmation(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes");
    });
  });
}

// src/core/environments/env-manager.ts
var EnvManager = class {
  configDir;
  envFilePath;
  environments = [];
  activeEnvName = "local";
  constructor(customDir) {
    this.configDir = customDir || path2.join(os.homedir(), ".apix");
    this.envFilePath = path2.join(this.configDir, "environments.json");
  }
  async init() {
    try {
      await fs2.mkdir(this.configDir, { recursive: true });
      const data = await fs2.readFile(this.envFilePath, "utf-8");
      const parsed = JSON.parse(data);
      this.environments = parsed.environments || [];
      this.activeEnvName = parsed.activeEnvName || "local";
    } catch {
      this.environments = [
        {
          name: "local",
          baseUrl: "http://localhost:3000",
          variables: {
            baseUrl: "http://localhost:3000"
          },
          isProduction: false,
          isDefault: true
        },
        {
          name: "development",
          baseUrl: "http://localhost:4000",
          variables: {
            baseUrl: "http://localhost:4000"
          },
          isProduction: false
        },
        {
          name: "staging",
          baseUrl: "",
          variables: {
            baseUrl: ""
          },
          isProduction: false
        },
        {
          name: "production",
          baseUrl: "",
          variables: {
            baseUrl: ""
          },
          isProduction: true
        }
      ];
      await this.save();
    }
  }
  async save() {
    await fs2.mkdir(this.configDir, { recursive: true });
    await fs2.writeFile(
      this.envFilePath,
      JSON.stringify(
        {
          activeEnvName: this.activeEnvName,
          environments: this.environments
        },
        null,
        2
      ),
      "utf-8"
    );
  }
  getEnvironments() {
    return [...this.environments];
  }
  getActiveEnvironment() {
    const env = this.environments.find((e) => e.name === this.activeEnvName);
    if (env) return env;
    return this.environments[0] || {
      name: "local",
      baseUrl: "http://localhost:3000",
      variables: {},
      isProduction: false
    };
  }
  setActiveEnvironment(name) {
    const target = this.environments.find((e) => e.name.toLowerCase() === name.toLowerCase());
    if (!target) {
      throw new Error(`Environment "${name}" not found. Available: ${this.environments.map((e) => e.name).join(", ")}`);
    }
    this.activeEnvName = target.name;
    return target;
  }
  addEnvironment(env) {
    const index = this.environments.findIndex((e) => e.name.toLowerCase() === env.name.toLowerCase());
    if (index >= 0) {
      this.environments[index] = env;
    } else {
      this.environments.push(env);
    }
  }
  setVariable(envName, key, value) {
    const env = this.environments.find((e) => e.name.toLowerCase() === envName.toLowerCase());
    if (!env) {
      throw new Error(`Environment "${envName}" not found`);
    }
    env.variables[key] = value;
    if (key.toLowerCase() === "baseurl" || key.toLowerCase() === "api_url") {
      env.baseUrl = value;
      env.isProduction = isProductionUrl(value) || env.name.toLowerCase().includes("prod");
    }
  }
  /**
   * Replaces {{variableName}} templates using active environment variables and process.env
   */
  interpolate(text, extraVariables) {
    if (!text || typeof text !== "string") return text;
    const activeEnv = this.getActiveEnvironment();
    const allVars = {
      baseUrl: activeEnv.baseUrl,
      ...activeEnv.variables,
      ...extraVariables || {}
    };
    return text.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, varName) => {
      if (allVars[varName] !== void 0 && allVars[varName] !== null) {
        return String(allVars[varName]);
      }
      if (process.env[varName] !== void 0) {
        return process.env[varName];
      }
      return match;
    });
  }
  interpolateObject(obj, extraVariables) {
    if (!obj) return obj;
    if (typeof obj === "string") {
      return this.interpolate(obj, extraVariables);
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.interpolateObject(item, extraVariables));
    }
    if (typeof obj === "object") {
      const result2 = {};
      for (const [k, v] of Object.entries(obj)) {
        result2[k] = this.interpolateObject(v, extraVariables);
      }
      return result2;
    }
    return obj;
  }
};

// src/core/auth/auth-manager.ts
import fs3 from "fs/promises";
import os2 from "os";
import path3 from "path";
var AuthManager = class {
  configDir;
  authFilePath;
  profiles = [];
  constructor(customDir) {
    this.configDir = customDir || path3.join(os2.homedir(), ".apix");
    this.authFilePath = path3.join(this.configDir, "auth.json");
  }
  async init() {
    try {
      await fs3.mkdir(this.configDir, { recursive: true });
      const data = await fs3.readFile(this.authFilePath, "utf-8");
      const parsed = JSON.parse(data);
      this.profiles = parsed.profiles || [];
    } catch {
      this.profiles = [];
      await this.save();
    }
  }
  async save() {
    await fs3.mkdir(this.configDir, { recursive: true });
    await fs3.writeFile(
      this.authFilePath,
      JSON.stringify({ profiles: this.profiles }, null, 2),
      "utf-8"
    );
  }
  getProfiles() {
    return [...this.profiles];
  }
  getProfile(idOrName) {
    return this.profiles.find(
      (p) => p.id === idOrName || p.name.toLowerCase() === idOrName.toLowerCase()
    );
  }
  getDefaultProfile() {
    return this.profiles.find((p) => p.isDefault) || this.profiles[0];
  }
  addProfile(profile) {
    const existingIndex = this.profiles.findIndex(
      (p) => p.id === profile.id || p.name.toLowerCase() === profile.name.toLowerCase()
    );
    if (profile.isDefault) {
      for (const p of this.profiles) {
        p.isDefault = false;
      }
    }
    if (existingIndex >= 0) {
      this.profiles[existingIndex] = profile;
    } else {
      this.profiles.push(profile);
    }
  }
  deleteProfile(idOrName) {
    const prevLen = this.profiles.length;
    this.profiles = this.profiles.filter(
      (p) => p.id !== idOrName && p.name.toLowerCase() !== idOrName.toLowerCase()
    );
    return this.profiles.length < prevLen;
  }
  applyAuth(config, profileIdOrName) {
    const profile = profileIdOrName ? this.getProfile(profileIdOrName) : this.getDefaultProfile();
    if (!profile) return config;
    const headers = { ...config.headers || {} };
    const query = { ...config.query || {} };
    switch (profile.type) {
      case "bearer":
        if (profile.config.token) {
          headers["Authorization"] = `Bearer ${profile.config.token}`;
        }
        break;
      case "api-key": {
        const keyName = profile.config.paramName || profile.config.headerName || "X-API-Key";
        const keyVal = profile.config.apiKey || profile.config.token || "";
        if (profile.config.paramLocation === "query") {
          query[keyName] = keyVal;
        } else {
          headers[keyName] = keyVal;
        }
        break;
      }
      case "basic":
        if (profile.config.username) {
          const user = profile.config.username;
          const pass = profile.config.password || "";
          const b64 = Buffer.from(`${user}:${pass}`).toString("base64");
          headers["Authorization"] = `Basic ${b64}`;
        }
        break;
      case "custom-header":
        if (profile.config.headerName && profile.config.headerValue) {
          headers[profile.config.headerName] = profile.config.headerValue;
        }
        break;
      case "oauth2":
        if (profile.config.token) {
          headers["Authorization"] = `Bearer ${profile.config.token}`;
        }
        break;
    }
    return {
      ...config,
      headers,
      query
    };
  }
  getMaskedProfile(profile) {
    const masked = {
      id: profile.id,
      name: profile.name,
      type: profile.type,
      isDefault: profile.isDefault
    };
    if (profile.config.token) {
      masked.token = maskSecret(profile.config.token);
    }
    if (profile.config.apiKey) {
      masked.apiKey = maskSecret(profile.config.apiKey);
    }
    if (profile.config.username) {
      masked.username = profile.config.username;
      masked.password = "******";
    }
    if (profile.config.headerName) {
      masked.headerName = profile.config.headerName;
      masked.headerValue = maskSecret(profile.config.headerValue || "");
    }
    return masked;
  }
};

// src/core/history/history-manager.ts
import fs4 from "fs/promises";
import os3 from "os";
import path4 from "path";
var HistoryManager = class {
  configDir;
  historyFilePath;
  items = [];
  maxItems = 500;
  enabled = true;
  constructor(customDir) {
    this.configDir = customDir || path4.join(os3.homedir(), ".apix");
    this.historyFilePath = path4.join(this.configDir, "history.json");
  }
  async init() {
    try {
      await fs4.mkdir(this.configDir, { recursive: true });
      const data = await fs4.readFile(this.historyFilePath, "utf-8");
      const parsed = JSON.parse(data);
      this.items = parsed.items || [];
      if (parsed.enabled !== void 0) {
        this.enabled = parsed.enabled;
      }
    } catch {
      this.items = [];
      await this.save();
    }
  }
  async save() {
    await fs4.mkdir(this.configDir, { recursive: true });
    await fs4.writeFile(
      this.historyFilePath,
      JSON.stringify(
        {
          enabled: this.enabled,
          items: this.items.slice(0, this.maxItems)
        },
        null,
        2
      ),
      "utf-8"
    );
  }
  async record(config, response, environmentName) {
    if (!this.enabled) return null;
    let pathOnly = "/";
    try {
      pathOnly = new URL(config.url).pathname;
    } catch {
      pathOnly = config.url;
    }
    let preview = "";
    if (response.isJson && typeof response.data === "object") {
      preview = JSON.stringify(response.data).slice(0, 150);
    } else if (response.rawData) {
      preview = response.rawData.slice(0, 150);
    }
    const item = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      method: config.method,
      url: config.url,
      path: pathOnly,
      status: response.status,
      statusText: response.statusText,
      durationMs: response.timing.total,
      sizeBytes: response.sizeBytes,
      environment: environmentName,
      request: {
        headers: maskHeaders(config.headers || {}),
        query: config.query,
        params: config.params,
        body: maskBody(config.body)
      },
      responsePreview: preview
    };
    this.items.unshift(item);
    if (this.items.length > this.maxItems) {
      this.items = this.items.slice(0, this.maxItems);
    }
    await this.save();
    return item;
  }
  getItems(limit = 50) {
    return this.items.slice(0, limit);
  }
  getItem(id) {
    return this.items.find((item) => item.id === id);
  }
  async deleteItem(id) {
    const prev = this.items.length;
    this.items = this.items.filter((item) => item.id !== id);
    if (this.items.length < prev) {
      await this.save();
      return true;
    }
    return false;
  }
  async clear() {
    this.items = [];
    await this.save();
  }
  setEnabled(enabled) {
    this.enabled = enabled;
  }
  isEnabled() {
    return this.enabled;
  }
};

// src/core/collections/collection-manager.ts
import fs5 from "fs/promises";
import os4 from "os";
import path5 from "path";
var CollectionManager = class {
  configDir;
  collectionsFilePath;
  collections = [];
  constructor(customDir) {
    this.configDir = customDir || path5.join(os4.homedir(), ".apix");
    this.collectionsFilePath = path5.join(this.configDir, "collections.json");
  }
  async init() {
    try {
      await fs5.mkdir(this.configDir, { recursive: true });
      const data = await fs5.readFile(this.collectionsFilePath, "utf-8");
      const parsed = JSON.parse(data);
      this.collections = parsed.collections || [];
    } catch {
      this.collections = [];
      await this.save();
    }
  }
  async save() {
    await fs5.mkdir(this.configDir, { recursive: true });
    await fs5.writeFile(
      this.collectionsFilePath,
      JSON.stringify({ collections: this.collections }, null, 2),
      "utf-8"
    );
  }
  getCollections() {
    return [...this.collections];
  }
  getCollection(idOrName) {
    return this.collections.find(
      (c) => c.id === idOrName || c.name.toLowerCase() === idOrName.toLowerCase()
    );
  }
  createCollection(name, description) {
    const existing = this.getCollection(name);
    if (existing) {
      throw new Error(`Collection "${name}" already exists`);
    }
    const col = {
      id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      description,
      requests: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.collections.push(col);
    return col;
  }
  addRequest(collectionIdOrName, request) {
    const col = this.getCollection(collectionIdOrName);
    if (!col) {
      throw new Error(`Collection "${collectionIdOrName}" not found`);
    }
    const savedReq = {
      ...request,
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now()
    };
    col.requests.push(savedReq);
    col.updatedAt = Date.now();
    return savedReq;
  }
  deleteRequest(collectionIdOrName, requestId) {
    const col = this.getCollection(collectionIdOrName);
    if (!col) return false;
    const prev = col.requests.length;
    col.requests = col.requests.filter((r) => r.id !== requestId);
    if (col.requests.length < prev) {
      col.updatedAt = Date.now();
      return true;
    }
    return false;
  }
  deleteCollection(idOrName) {
    const prev = this.collections.length;
    this.collections = this.collections.filter(
      (c) => c.id !== idOrName && c.name.toLowerCase() !== idOrName.toLowerCase()
    );
    return this.collections.length < prev;
  }
  async exportCollection(idOrName, targetPath) {
    const col = this.getCollection(idOrName);
    if (!col) throw new Error(`Collection "${idOrName}" not found`);
    const exportData = {
      apixVersion: "1.0.0",
      type: "collection",
      collection: col
    };
    await fs5.writeFile(path5.resolve(targetPath), JSON.stringify(exportData, null, 2), "utf-8");
  }
  async importCollection(filePath) {
    const content = await fs5.readFile(path5.resolve(filePath), "utf-8");
    const parsed = JSON.parse(content);
    const colData = parsed.collection || parsed;
    if (!colData.name || !Array.isArray(colData.requests)) {
      throw new Error('Invalid APiX collection format. Expected "name" and "requests" array.');
    }
    const col = {
      id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: colData.name,
      description: colData.description,
      requests: colData.requests,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.collections.push(col);
    await this.save();
    return col;
  }
};

// src/tui/context/app-context.tsx
import { jsx } from "react/jsx-runtime";
var AppContext = createContext(null);
var AppProvider = ({ initialUrl, children }) => {
  const [client] = useState(() => new HttpClient());
  const [envManager] = useState(() => new EnvManager());
  const [authManager] = useState(() => new AuthManager());
  const [historyManager] = useState(() => new HistoryManager());
  const [collectionManager] = useState(() => new CollectionManager());
  const [openApiDiscovery] = useState(() => new OpenApiDiscovery(client));
  const [safeProber] = useState(() => new SafeProber(client));
  const [screen, setScreenState] = useState("dashboard");
  const [prevScreen, setPrevScreen] = useState("dashboard");
  const [spec, setSpec] = useState(null);
  const [activeEndpoint, setActiveEndpoint] = useState(null);
  const [environments, setEnvironments] = useState([]);
  const [activeEnv, setActiveEnv] = useState({
    name: "local",
    baseUrl: "http://localhost:3000",
    variables: {},
    isProduction: false
  });
  const [historyItems, setHistoryItems] = useState([]);
  const [lastResponse, setLastResponse] = useState(null);
  const [lastRequestConfig, setLastRequestConfig] = useState(null);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [loading, setLoading] = useState(false);
  const [warningModal, setWarningModal] = useState(null);
  const [builderParams, setBuilderParams] = useState({});
  const [builderQuery, setBuilderQuery] = useState({});
  const [builderHeaders, setBuilderHeaders] = useState({});
  const [builderBody, setBuilderBody] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const setScreen = (nextScreen) => {
    setPrevScreen(screen);
    setScreenState(nextScreen);
  };
  useEffect(() => {
    async function initManagers() {
      await envManager.init();
      await authManager.init();
      await historyManager.init();
      await collectionManager.init();
      setEnvironments(envManager.getEnvironments());
      setActiveEnv(envManager.getActiveEnvironment());
      setHistoryItems(historyManager.getItems(50));
      if (initialUrl) {
        await connectToUrl(initialUrl);
      }
    }
    initManagers().catch(console.error);
  }, []);
  const switchEnvironment = (name) => {
    try {
      const env = envManager.setActiveEnvironment(name);
      setActiveEnv(env);
      envManager.save().catch(console.error);
      setStatusMessage(`Switched environment to [${env.name}]`);
    } catch (e) {
      setStatusMessage(`Failed to switch environment: ${e.message}`);
    }
  };
  const connectToUrl = async (targetUrl, explicitSpec) => {
    setLoading(true);
    setStatusMessage(`Connecting to ${targetUrl}...`);
    try {
      const openApiResult = await openApiDiscovery.discover(targetUrl, explicitSpec);
      if (openApiResult) {
        setSpec(openApiResult.spec);
        setStatusMessage(`Connected! Detected OpenAPI (${openApiResult.spec.endpoints.length} endpoints)`);
        setScreenState("explorer");
        setLoading(false);
        return true;
      }
      const probeResult = await safeProber.probe(targetUrl);
      if (probeResult.isReachable) {
        const inferredSpec = safeProber.createInferredSpec(probeResult);
        setSpec(inferredSpec);
        setStatusMessage(`Connected! Discovered ${inferredSpec.endpoints.length} endpoints via probing.`);
        setScreenState("explorer");
        setLoading(false);
        return true;
      }
      setStatusMessage(`Unable to connect to ${targetUrl}. Is the server running?`);
      setLoading(false);
      return false;
    } catch (err) {
      setStatusMessage(`Connection error: ${err.message}`);
      setLoading(false);
      return false;
    }
  };
  const executeRequest = async (overrideConfig) => {
    if (!activeEndpoint && !overrideConfig) return null;
    const method = overrideConfig?.method || activeEndpoint.method;
    let urlPath = overrideConfig?.url || activeEndpoint.path;
    for (const [k, v] of Object.entries(builderParams)) {
      urlPath = urlPath.replace(`{${k}}`, encodeURIComponent(v)).replace(`:${k}`, encodeURIComponent(v));
    }
    const baseUrl = activeEnv.baseUrl || spec?.baseUrl || "http://localhost";
    const fullUrl = urlPath.startsWith("http") ? urlPath : `${baseUrl.replace(/\/$/, "")}${urlPath}`;
    let parsedBody = void 0;
    if (builderBody.trim()) {
      try {
        parsedBody = JSON.parse(builderBody);
      } catch {
        parsedBody = builderBody;
      }
    }
    const reqConfig = overrideConfig || {
      url: fullUrl,
      method,
      headers: { ...builderHeaders },
      query: { ...builderQuery },
      body: parsedBody
    };
    const authedConfig = authManager.applyAuth(reqConfig);
    const isProd = activeEnv.isProduction || isProductionUrl(fullUrl);
    if (isDangerousMethod(method) && isProd) {
      return new Promise((resolve) => {
        setWarningModal({
          message: `DANGEROUS OPERATION: You are about to execute ${method} ${fullUrl} in PRODUCTION. Continue?`,
          onConfirm: async () => {
            setWarningModal(null);
            const resp = await performExecute(authedConfig);
            resolve(resp);
          },
          onCancel: () => {
            setWarningModal(null);
            setStatusMessage("Request canceled.");
            resolve(null);
          }
        });
      });
    }
    return performExecute(authedConfig);
  };
  const performExecute = async (config) => {
    setLoading(true);
    setStatusMessage(`Sending ${config.method} ${config.url}...`);
    try {
      const response = await client.request(config);
      setLastResponse(response);
      setLastRequestConfig(config);
      setScreenState("response");
      setStatusMessage(`Completed: ${response.status} ${response.statusText} (${response.timing.total}ms)`);
      await historyManager.record(config, response, activeEnv.name);
      setHistoryItems(historyManager.getItems(50));
      setLoading(false);
      return response;
    } catch (err) {
      setStatusMessage(`Request failed: ${err.message}`);
      setLoading(false);
      return null;
    }
  };
  return /* @__PURE__ */ jsx(
    AppContext.Provider,
    {
      value: {
        screen,
        prevScreen,
        setScreen,
        spec,
        setSpec,
        activeEndpoint,
        setActiveEndpoint,
        environments,
        activeEnv,
        switchEnvironment,
        historyItems,
        lastResponse,
        lastRequestConfig,
        statusMessage,
        setStatusMessage,
        loading,
        setLoading,
        warningModal,
        setWarningModal,
        builderParams,
        setBuilderParams,
        builderQuery,
        setBuilderQuery,
        builderHeaders,
        setBuilderHeaders,
        builderBody,
        setBuilderBody,
        searchQuery,
        setSearchQuery,
        connectToUrl,
        executeRequest,
        client,
        envManager,
        authManager,
        historyManager,
        collectionManager
      },
      children
    }
  );
};
var useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};

// src/tui/components/Header.tsx
import { Box, Text } from "ink";
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var Header = () => {
  const { spec, activeEnv, loading } = useApp();
  const isConnected = Boolean(spec);
  const isProd = activeEnv.isProduction;
  return /* @__PURE__ */ jsxs(Box, { flexDirection: "column", borderStyle: "round", borderColor: "cyan", paddingX: 1, marginBottom: 1, children: [
    /* @__PURE__ */ jsxs(Box, { justifyContent: "space-between", children: [
      /* @__PURE__ */ jsxs(Box, { children: [
        /* @__PURE__ */ jsx2(Text, { bold: true, color: "cyan", children: "APiX" }),
        /* @__PURE__ */ jsx2(Text, { color: "gray", children: " \u2502 Universal Terminal API Platform" })
      ] }),
      /* @__PURE__ */ jsx2(Box, { children: /* @__PURE__ */ jsx2(Text, { color: "gray", children: "v1.0.0" }) })
    ] }),
    /* @__PURE__ */ jsxs(Box, { justifyContent: "space-between", marginTop: 1, children: [
      /* @__PURE__ */ jsxs(Box, { children: [
        isConnected ? /* @__PURE__ */ jsx2(Text, { color: "green", children: "\u25CF CONNECTED " }) : /* @__PURE__ */ jsx2(Text, { color: "yellow", children: "\u25CB DISCONNECTED " }),
        /* @__PURE__ */ jsx2(Text, { bold: true, color: "white", children: spec ? spec.title || spec.baseUrl : "No API connected" }),
        spec && /* @__PURE__ */ jsxs(Text, { color: "gray", children: [
          " (",
          spec.baseUrl,
          ")"
        ] })
      ] }),
      /* @__PURE__ */ jsxs(Box, { children: [
        /* @__PURE__ */ jsx2(Text, { children: "Env: " }),
        isProd ? /* @__PURE__ */ jsxs(Text, { bold: true, color: "red", backgroundColor: "black", children: [
          "[",
          activeEnv.name.toUpperCase(),
          "]"
        ] }) : /* @__PURE__ */ jsxs(Text, { bold: true, color: "magenta", children: [
          "[",
          activeEnv.name,
          "]"
        ] })
      ] })
    ] }),
    spec && /* @__PURE__ */ jsx2(Box, { marginTop: 0, children: /* @__PURE__ */ jsxs(Text, { color: "gray", children: [
      "Endpoints: ",
      /* @__PURE__ */ jsx2(Text, { color: "white", children: spec.endpoints.length }),
      " \u2502 Schemas:",
      " ",
      /* @__PURE__ */ jsx2(Text, { color: "white", children: Object.keys(spec.schemas || {}).length }),
      " \u2502 Source:",
      " ",
      /* @__PURE__ */ jsx2(Text, { color: "cyan", children: spec.endpoints[0]?.source || "DOCUMENTED" }),
      loading ? /* @__PURE__ */ jsx2(Text, { color: "yellow", children: " \u2502 [Busy...]" }) : null
    ] }) })
  ] });
};

// src/tui/components/StatusBar.tsx
import { Box as Box2, Text as Text2 } from "ink";
import { Fragment, jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var StatusBar = () => {
  const { statusMessage, screen } = useApp();
  return /* @__PURE__ */ jsxs2(Box2, { flexDirection: "column", marginTop: 1, children: [
    statusMessage && /* @__PURE__ */ jsx3(Box2, { paddingX: 1, children: /* @__PURE__ */ jsxs2(Text2, { color: "yellow", children: [
      "\u2139 ",
      statusMessage
    ] }) }),
    /* @__PURE__ */ jsxs2(
      Box2,
      {
        borderStyle: "single",
        borderColor: "gray",
        paddingX: 1,
        justifyContent: "space-between",
        children: [
          /* @__PURE__ */ jsxs2(Box2, { children: [
            /* @__PURE__ */ jsx3(Text2, { color: "cyan", children: "\u2191\u2193" }),
            /* @__PURE__ */ jsx3(Text2, { color: "gray", children: " Nav " }),
            /* @__PURE__ */ jsx3(Text2, { color: "cyan", children: "Enter" }),
            /* @__PURE__ */ jsx3(Text2, { color: "gray", children: " Select " }),
            /* @__PURE__ */ jsx3(Text2, { color: "cyan", children: "Esc" }),
            /* @__PURE__ */ jsx3(Text2, { color: "gray", children: " Back " }),
            /* @__PURE__ */ jsx3(Text2, { color: "cyan", children: "/" }),
            /* @__PURE__ */ jsx3(Text2, { color: "gray", children: " Search " }),
            /* @__PURE__ */ jsx3(Text2, { color: "cyan", children: "^P" }),
            /* @__PURE__ */ jsx3(Text2, { color: "gray", children: " Palette " }),
            screen === "builder" && /* @__PURE__ */ jsxs2(Fragment, { children: [
              /* @__PURE__ */ jsx3(Text2, { color: "green", children: "^R" }),
              /* @__PURE__ */ jsx3(Text2, { color: "gray", children: " Run " })
            ] }),
            /* @__PURE__ */ jsx3(Text2, { color: "cyan", children: "q" }),
            /* @__PURE__ */ jsx3(Text2, { color: "gray", children: " Quit" })
          ] }),
          /* @__PURE__ */ jsxs2(Box2, { children: [
            /* @__PURE__ */ jsx3(Text2, { color: "gray", children: "Screen: " }),
            /* @__PURE__ */ jsx3(Text2, { bold: true, color: "white", children: screen.toUpperCase() })
          ] })
        ]
      }
    )
  ] });
};

// src/tui/components/CommandPalette.tsx
import { useState as useState2 } from "react";
import { Box as Box3, Text as Text3, useInput } from "ink";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var CommandPalette = ({ onClose }) => {
  const {
    setScreen,
    switchEnvironment,
    environments,
    spec,
    activeEndpoint
  } = useApp();
  const [query, setQuery] = useState2("");
  const [selectedIndex, setSelectedIndex] = useState2(0);
  const commands = [
    {
      id: "connect",
      title: "Connect to API (URL)",
      category: "Navigation",
      action: () => {
        setScreen("dashboard");
        onClose();
      }
    },
    {
      id: "explore",
      title: "Explore Endpoints & Schemas",
      category: "Navigation",
      action: () => {
        setScreen("explorer");
        onClose();
      }
    },
    {
      id: "history",
      title: "View Request History",
      category: "Navigation",
      action: () => {
        setScreen("history");
        onClose();
      }
    },
    {
      id: "collections",
      title: "View Collections & Saved Requests",
      category: "Navigation",
      action: () => {
        setScreen("collections");
        onClose();
      }
    },
    {
      id: "environments",
      title: "Manage Environments",
      category: "Navigation",
      action: () => {
        setScreen("environments");
        onClose();
      }
    },
    {
      id: "gen-curl",
      title: "Generate cURL Command",
      category: "Code Generation",
      action: () => {
        setScreen("code-gen");
        onClose();
      }
    },
    {
      id: "gen-js",
      title: "Generate JavaScript (Fetch)",
      category: "Code Generation",
      action: () => {
        setScreen("code-gen");
        onClose();
      }
    },
    {
      id: "gen-py",
      title: "Generate Python (Requests)",
      category: "Code Generation",
      action: () => {
        setScreen("code-gen");
        onClose();
      }
    },
    {
      id: "quit",
      title: "Quit APiX",
      category: "System",
      action: () => {
        process.exit(0);
      }
    }
  ];
  const filtered = commands.filter(
    (c) => c.title.toLowerCase().includes(query.toLowerCase()) || c.category.toLowerCase().includes(query.toLowerCase())
  );
  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => prev > 0 ? prev - 1 : filtered.length - 1);
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => prev < filtered.length - 1 ? prev + 1 : 0);
      return;
    }
    if (key.return) {
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
      return;
    }
    if (key.backspace || key.delete) {
      setQuery((prev) => prev.slice(0, -1));
      setSelectedIndex(0);
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setQuery((prev) => prev + input);
      setSelectedIndex(0);
    }
  });
  return /* @__PURE__ */ jsxs3(
    Box3,
    {
      flexDirection: "column",
      borderStyle: "double",
      borderColor: "magenta",
      padding: 1,
      width: 70,
      children: [
        /* @__PURE__ */ jsxs3(Box3, { marginBottom: 1, justifyContent: "space-between", children: [
          /* @__PURE__ */ jsx4(Text3, { bold: true, color: "magenta", children: "\u26A1 Command Palette" }),
          /* @__PURE__ */ jsx4(Text3, { color: "gray", children: "Esc to close" })
        ] }),
        /* @__PURE__ */ jsxs3(Box3, { borderStyle: "single", borderColor: "cyan", paddingX: 1, marginBottom: 1, children: [
          /* @__PURE__ */ jsx4(Text3, { color: "cyan", children: "> " }),
          /* @__PURE__ */ jsx4(Text3, { bold: true, children: query }),
          /* @__PURE__ */ jsx4(Text3, { color: "gray", children: "_" })
        ] }),
        /* @__PURE__ */ jsx4(Box3, { flexDirection: "column", children: filtered.length === 0 ? /* @__PURE__ */ jsx4(Text3, { color: "gray", children: "No matching commands found." }) : filtered.slice(0, 8).map((cmd, i) => {
          const isSelected = i === selectedIndex;
          return /* @__PURE__ */ jsxs3(Box3, { justifyContent: "space-between", children: [
            /* @__PURE__ */ jsxs3(Text3, { color: isSelected ? "cyan" : "white", bold: isSelected, children: [
              isSelected ? "\u276F " : "  ",
              cmd.title
            ] }),
            /* @__PURE__ */ jsxs3(Text3, { color: "gray", children: [
              "[",
              cmd.category,
              "]"
            ] })
          ] }, cmd.id);
        }) })
      ]
    }
  );
};

// src/tui/components/ProductionWarning.tsx
import { Box as Box4, Text as Text4, useInput as useInput2 } from "ink";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var ProductionWarning = ({
  message,
  onConfirm,
  onCancel
}) => {
  useInput2((input, key) => {
    if (key.escape || input.toLowerCase() === "n") {
      onCancel();
    } else if (input.toLowerCase() === "y" || key.return && input.toLowerCase() === "y") {
      onConfirm();
    }
  });
  return /* @__PURE__ */ jsxs4(
    Box4,
    {
      flexDirection: "column",
      borderStyle: "double",
      borderColor: "red",
      padding: 1,
      width: 65,
      children: [
        /* @__PURE__ */ jsx5(Box4, { marginBottom: 1, children: /* @__PURE__ */ jsx5(Text4, { bold: true, color: "red", backgroundColor: "black", children: "\u26A0 PRODUCTION SAFETY WARNING" }) }),
        /* @__PURE__ */ jsx5(Box4, { marginBottom: 1, children: /* @__PURE__ */ jsx5(Text4, { color: "yellow", children: message }) }),
        /* @__PURE__ */ jsx5(Box4, { marginBottom: 1, children: /* @__PURE__ */ jsx5(Text4, { color: "red", children: "This operation may permanently modify or delete remote data in PRODUCTION." }) }),
        /* @__PURE__ */ jsx5(Box4, { borderStyle: "single", borderColor: "gray", paddingX: 1, justifyContent: "space-between", children: /* @__PURE__ */ jsxs4(Text4, { bold: true, color: "white", children: [
          "Press ",
          /* @__PURE__ */ jsx5(Text4, { color: "green", children: "[y]" }),
          " to confirm, or ",
          /* @__PURE__ */ jsx5(Text4, { color: "red", children: "[n / Esc]" }),
          " to cancel."
        ] }) })
      ]
    }
  );
};

// src/tui/screens/DashboardScreen.tsx
import { useState as useState3 } from "react";
import { Box as Box5, Text as Text5, useInput as useInput3 } from "ink";
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
var DashboardScreen = () => {
  const { setScreen, connectToUrl, spec, loading } = useApp();
  const [urlInput, setUrlInput] = useState3("http://localhost:3000");
  const [isEditingUrl, setIsEditingUrl] = useState3(false);
  const [selectedIndex, setSelectedIndex] = useState3(0);
  const menuItems = [
    { label: "Connect to URL", action: () => setIsEditingUrl(true) },
    { label: "Explore API Endpoints", action: () => setScreen("explorer"), disabled: !spec },
    { label: "Request History", action: () => setScreen("history") },
    { label: "Collections", action: () => setScreen("collections") },
    { label: "Environments", action: () => setScreen("environments") },
    { label: "Generate Code", action: () => setScreen("code-gen"), disabled: !spec }
  ];
  useInput3((input, key) => {
    if (isEditingUrl) {
      if (key.return) {
        setIsEditingUrl(false);
        if (urlInput.trim()) {
          connectToUrl(urlInput.trim());
        }
        return;
      }
      if (key.escape) {
        setIsEditingUrl(false);
        return;
      }
      if (key.backspace || key.delete) {
        setUrlInput((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setUrlInput((prev) => prev + input);
      }
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => prev > 0 ? prev - 1 : menuItems.length - 1);
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => prev < menuItems.length - 1 ? prev + 1 : 0);
      return;
    }
    if (key.return) {
      const item = menuItems[selectedIndex];
      if (item && (!item.disabled || item.label === "Connect to URL")) {
        item.action();
      }
    }
  });
  return /* @__PURE__ */ jsxs5(Box5, { flexDirection: "column", paddingX: 1, children: [
    /* @__PURE__ */ jsxs5(Box5, { marginBottom: 1, flexDirection: "column", children: [
      /* @__PURE__ */ jsx6(Text5, { bold: true, color: "white", children: "Universal API Explorer & Development Platform" }),
      /* @__PURE__ */ jsx6(Text5, { color: "gray", children: "Connect to any REST or OpenAPI endpoint to inspect, execute, and test APIs." })
    ] }),
    /* @__PURE__ */ jsxs5(
      Box5,
      {
        borderStyle: "single",
        borderColor: isEditingUrl ? "green" : "cyan",
        paddingX: 1,
        marginBottom: 1,
        flexDirection: "column",
        children: [
          /* @__PURE__ */ jsx6(Text5, { color: "gray", children: "API Target URL (Press Enter to edit/connect):" }),
          /* @__PURE__ */ jsxs5(Box5, { children: [
            /* @__PURE__ */ jsx6(Text5, { color: "cyan", children: "> " }),
            /* @__PURE__ */ jsx6(Text5, { bold: true, color: "white", children: urlInput }),
            isEditingUrl && /* @__PURE__ */ jsx6(Text5, { color: "green", children: " \u2588 (Typing... Press Enter to connect)" })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxs5(Box5, { flexDirection: "column", borderStyle: "single", borderColor: "gray", paddingX: 1, marginBottom: 1, children: [
      /* @__PURE__ */ jsx6(Text5, { bold: true, color: "cyan", marginBottom: 1, children: "Actions" }),
      menuItems.map((item, index) => {
        const isSelected = index === selectedIndex && !isEditingUrl;
        return /* @__PURE__ */ jsxs5(Box5, { children: [
          /* @__PURE__ */ jsxs5(
            Text5,
            {
              color: item.disabled ? "gray" : isSelected ? "cyan" : "white",
              bold: isSelected,
              children: [
                isSelected ? "\u276F " : "  ",
                item.label
              ]
            }
          ),
          item.disabled && /* @__PURE__ */ jsx6(Text5, { color: "gray", children: " (requires connected API)" })
        ] }, item.label);
      })
    ] })
  ] });
};

// src/tui/screens/ExplorerScreen.tsx
import { useState as useState4 } from "react";
import { Box as Box6, Text as Text6, useInput as useInput4 } from "ink";
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
var ExplorerScreen = () => {
  const { spec, setActiveEndpoint, setScreen } = useApp();
  const [filter, setFilter] = useState4("");
  const [isFiltering, setIsFiltering] = useState4(false);
  const [selectedIndex, setSelectedIndex] = useState4(0);
  if (!spec || spec.endpoints.length === 0) {
    return /* @__PURE__ */ jsx7(Box6, { flexDirection: "column", padding: 1, children: /* @__PURE__ */ jsx7(Text6, { color: "yellow", children: "No endpoints available. Connect to an API first." }) });
  }
  const filteredEndpoints = spec.endpoints.filter((ep) => {
    if (!filter) return true;
    const term = filter.toLowerCase();
    return ep.path.toLowerCase().includes(term) || ep.method.toLowerCase().includes(term) || ep.summary && ep.summary.toLowerCase().includes(term) || ep.tags.some((t) => t.toLowerCase().includes(term));
  });
  useInput4((input, key) => {
    if (isFiltering) {
      if (key.return) {
        setIsFiltering(false);
        return;
      }
      if (key.escape) {
        setIsFiltering(false);
        setFilter("");
        return;
      }
      if (key.backspace || key.delete) {
        setFilter((prev) => prev.slice(0, -1));
        setSelectedIndex(0);
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setFilter((prev) => prev + input);
        setSelectedIndex(0);
      }
      return;
    }
    if (input === "/") {
      setIsFiltering(true);
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => prev > 0 ? prev - 1 : filteredEndpoints.length - 1);
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => prev < filteredEndpoints.length - 1 ? prev + 1 : 0);
      return;
    }
    if (key.return) {
      const selected = filteredEndpoints[selectedIndex];
      if (selected) {
        setActiveEndpoint(selected);
        setScreen("details");
      }
      return;
    }
    if (key.escape) {
      setScreen("dashboard");
    }
  });
  const getMethodColor = (method) => {
    switch (method) {
      case "GET":
        return "green";
      case "POST":
        return "blue";
      case "PUT":
        return "yellow";
      case "DELETE":
        return "red";
      case "PATCH":
        return "magenta";
      default:
        return "cyan";
    }
  };
  return /* @__PURE__ */ jsxs6(Box6, { flexDirection: "column", paddingX: 1, children: [
    /* @__PURE__ */ jsxs6(Box6, { justifyContent: "space-between", marginBottom: 1, children: [
      /* @__PURE__ */ jsxs6(Text6, { bold: true, color: "cyan", children: [
        "API Explorer (",
        filteredEndpoints.length,
        " of ",
        spec.endpoints.length,
        " endpoints)"
      ] }),
      /* @__PURE__ */ jsx7(Text6, { color: "gray", children: isFiltering ? /* @__PURE__ */ jsxs6(Text6, { color: "green", children: [
        "Filter: ",
        filter,
        "\u2588 (Enter to finish)"
      ] }) : /* @__PURE__ */ jsxs6(Text6, { children: [
        "Press ",
        /* @__PURE__ */ jsx7(Text6, { color: "cyan", children: "/" }),
        " to search"
      ] }) })
    ] }),
    /* @__PURE__ */ jsx7(
      Box6,
      {
        flexDirection: "column",
        borderStyle: "single",
        borderColor: "gray",
        paddingX: 1,
        minHeight: 12,
        children: filteredEndpoints.length === 0 ? /* @__PURE__ */ jsxs6(Text6, { color: "gray", children: [
          'No endpoints match filter "',
          filter,
          '".'
        ] }) : filteredEndpoints.slice(0, 15).map((ep, i) => {
          const isSelected = i === selectedIndex;
          return /* @__PURE__ */ jsxs6(Box6, { justifyContent: "space-between", children: [
            /* @__PURE__ */ jsxs6(Box6, { children: [
              /* @__PURE__ */ jsx7(Text6, { color: isSelected ? "cyan" : "white", bold: isSelected, children: isSelected ? "\u276F " : "  " }),
              /* @__PURE__ */ jsx7(Text6, { bold: true, color: getMethodColor(ep.method), children: ep.method.padEnd(7) }),
              /* @__PURE__ */ jsx7(Text6, { color: isSelected ? "cyan" : "white", bold: isSelected, children: ep.path })
            ] }),
            /* @__PURE__ */ jsxs6(Box6, { children: [
              /* @__PURE__ */ jsx7(Text6, { color: "gray", children: ep.summary ? ep.summary.slice(0, 30) : "" }),
              /* @__PURE__ */ jsxs6(Text6, { color: "gray", children: [
                " [",
                ep.tags[0] || "General",
                "]"
              ] })
            ] })
          ] }, `${ep.method}_${ep.path}_${i}`);
        })
      }
    )
  ] });
};

// src/tui/screens/EndpointDetailScreen.tsx
import { Box as Box7, Text as Text7, useInput as useInput5 } from "ink";

// src/core/generators/index.ts
var CodeGenerator = class {
  static generate(lang, config) {
    const fullUrl = this.buildFullUrl(config);
    switch (lang.toLowerCase()) {
      case "curl":
        return this.generateCurl(config, fullUrl);
      case "javascript":
        return this.generateJavaScript(config, fullUrl);
      case "typescript":
        return this.generateTypeScript(config, fullUrl);
      case "python":
        return this.generatePython(config, fullUrl);
      case "go":
        return this.generateGo(config, fullUrl);
      case "java":
        return this.generateJava(config, fullUrl);
      case "php":
        return this.generatePhp(config, fullUrl);
      case "dart":
        return this.generateDart(config, fullUrl);
      case "csharp":
        return this.generateCSharp(config, fullUrl);
      case "rust":
        return this.generateRust(config, fullUrl);
      default:
        return this.generateCurl(config, fullUrl);
    }
  }
  static buildFullUrl(config) {
    try {
      const url = new URL(config.url);
      if (config.query) {
        for (const [k, v] of Object.entries(config.query)) {
          if (v !== void 0 && v !== null) {
            url.searchParams.set(k, String(v));
          }
        }
      }
      return url.toString();
    } catch {
      return config.url;
    }
  }
  static generateCurl(config, fullUrl) {
    const parts = ["curl"];
    if (config.method !== "GET") {
      parts.push(`-X ${config.method}`);
    }
    parts.push(`"${fullUrl}"`);
    if (config.headers) {
      for (const [k, v] of Object.entries(config.headers)) {
        parts.push(`-H "${k}: ${v}"`);
      }
    }
    if (config.body && config.method !== "GET") {
      const bodyStr = typeof config.body === "object" ? JSON.stringify(config.body) : String(config.body);
      const escaped = bodyStr.replace(/"/g, '\\"');
      parts.push(`-d "${escaped}"`);
    }
    return parts.join(" \\\n  ");
  }
  static generateJavaScript(config, fullUrl) {
    const hasBody = config.body && config.method !== "GET";
    const bodyStr = hasBody ? typeof config.body === "object" ? JSON.stringify(config.body, null, 2) : JSON.stringify(config.body) : "";
    return `const url = "${fullUrl}";
const options = {
  method: "${config.method}",
  headers: ${JSON.stringify(config.headers || {}, null, 2)}${hasBody ? `,
  body: JSON.stringify(${bodyStr.split("\n").join("\n  ")})` : ""}
};

try {
  const response = await fetch(url, options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error("Request failed:", error);
}`;
  }
  static generateTypeScript(config, fullUrl) {
    const hasBody = config.body && config.method !== "GET";
    const bodyStr = hasBody ? typeof config.body === "object" ? JSON.stringify(config.body, null, 2) : JSON.stringify(config.body) : "";
    return `interface ApiResponse<T = any> {
  data: T;
  status: number;
}

async function executeRequest<T = any>(): Promise<T> {
  const url = "${fullUrl}";
  const response = await fetch(url, {
    method: "${config.method}",
    headers: ${JSON.stringify(config.headers || {}, null, 4)}${hasBody ? `,
    body: JSON.stringify(${bodyStr.split("\n").join("\n    ")})` : ""}
  });

  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }

  return response.json() as Promise<T>;
}

executeRequest().then(console.log).catch(console.error);`;
  }
  static generatePython(config, fullUrl) {
    const hasBody = config.body && config.method !== "GET";
    const bodyJson = hasBody ? JSON.stringify(config.body, null, 4) : "";
    return `import requests

url = "${fullUrl}"
headers = ${JSON.stringify(config.headers || {}, null, 4)}
${hasBody ? `payload = ${bodyJson}
` : ""}
response = requests.request(
    method="${config.method}",
    url=url,
    headers=headers,
    ${hasBody ? "json=payload," : ""}
    timeout=30
)

print(f"Status: {response.status_code}")
print(response.json() if "application/json" in response.headers.get("content-type", "") else response.text)`;
  }
  static generateGo(config, fullUrl) {
    const hasBody = config.body && config.method !== "GET";
    const bodyJson = hasBody ? JSON.stringify(config.body) : "";
    return `package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
)

func main() {
	url := "${fullUrl}"
	${hasBody ? `var body = bytes.NewBuffer([]byte(\`${bodyJson}\`))` : `var body io.Reader = nil`}

	req, err := http.NewRequest("${config.method}", url, body)
	if err != nil {
		panic(err)
	}

${Object.entries(config.headers || {}).map(([k, v]) => `	req.Header.Set("${k}", "${v}")`).join("\n")}

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	fmt.Println("Status:", resp.Status)
	fmt.Println("Response:", string(respBody))
}`;
  }
  static generateJava(config, fullUrl) {
    const hasBody = config.body && config.method !== "GET";
    const bodyJson = hasBody ? JSON.stringify(config.body) : "";
    return `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class ApiRequest {
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();

        HttpRequest.Builder builder = HttpRequest.newBuilder()
            .uri(URI.create("${fullUrl}"))
            .method("${config.method}", ${hasBody ? `HttpRequest.BodyPublishers.ofString("${bodyJson.replace(/"/g, '\\"')}")` : "HttpRequest.BodyPublishers.noBody()"});

${Object.entries(config.headers || {}).map(([k, v]) => `        builder.header("${k}", "${v}");`).join("\n")}

        HttpRequest request = builder.build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println("Status: " + response.statusCode());
        System.out.println("Body: " + response.body());
    }
}`;
  }
  static generatePhp(config, fullUrl) {
    const hasBody = config.body && config.method !== "GET";
    const bodyJson = hasBody ? JSON.stringify(config.body) : "";
    return `<?php

$curl = curl_init();

$headers = [
${Object.entries(config.headers || {}).map(([k, v]) => `    "${k}: ${v}",`).join("\n")}
];

curl_setopt_array($curl, [
    CURLOPT_URL => "${fullUrl}",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => "${config.method}",
    CURLOPT_HTTPHEADER => $headers,
${hasBody ? `    CURLOPT_POSTFIELDS => '${bodyJson}',
` : ""}]);

$response = curl_exec($curl);
$httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

echo "Status: $httpCode\\n";
echo "Response: $response\\n";
`;
  }
  static generateDart(config, fullUrl) {
    const hasBody = config.body && config.method !== "GET";
    const bodyJson = hasBody ? JSON.stringify(config.body) : "";
    return `import 'dart:convert';
import 'package:http/http.dart' as http;

void main() async {
  final url = Uri.parse('${fullUrl}');
  final headers = <String, String>{
${Object.entries(config.headers || {}).map(([k, v]) => `    '${k}': '${v}',`).join("\n")}
  };

  final response = await http.${config.method.toLowerCase()}(
    url,
    headers: headers,
    ${hasBody ? `body: jsonEncode(${bodyJson}),` : ""}
  );

  print('Status: \${response.statusCode}');
  print('Body: \${response.body}');
}`;
  }
  static generateCSharp(config, fullUrl) {
    const hasBody = config.body && config.method !== "GET";
    const bodyJson = hasBody ? JSON.stringify(config.body) : "";
    return `using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

class Program {
    static async Task Main() {
        using var client = new HttpClient();
        var request = new HttpRequestMessage(HttpMethod.${capitalize(config.method.toLowerCase())}, "${fullUrl}");

${Object.entries(config.headers || {}).map(([k, v]) => `        request.Headers.TryAddWithoutValidation("${k}", "${v}");`).join("\n")}

${hasBody ? `        request.Content = new StringContent("${bodyJson.replace(/"/g, '\\"')}", Encoding.UTF8, "application/json");
` : ""}
        var response = await client.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();

        Console.WriteLine($"Status: {(int)response.StatusCode}");
        Console.WriteLine($"Response: {content}");
    }
}`;
  }
  static generateRust(config, fullUrl) {
    const hasBody = config.body && config.method !== "GET";
    const bodyJson = hasBody ? JSON.stringify(config.body) : "";
    return `use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use std::error::Error;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let client = reqwest::Client::new();
    let mut headers = HeaderMap::new();

${Object.entries(config.headers || {}).map(
      ([k, v]) => `    headers.insert(HeaderName::from_static("${k.toLowerCase()}"), HeaderValue::from_static("${v}"));`
    ).join("\n")}

    let response = client
        .${config.method.toLowerCase()}("${fullUrl}")
        .headers(headers)
        ${hasBody ? `.body(r#"${bodyJson}"#)` : ""}
        .send()
        .await?;

    println!("Status: {}", response.status());
    println!("Body: {}", response.text().await?);

    Ok(())
}`;
  }
};
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// src/tui/screens/EndpointDetailScreen.tsx
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
var EndpointDetailScreen = () => {
  const { activeEndpoint, setScreen, spec } = useApp();
  if (!activeEndpoint) {
    return /* @__PURE__ */ jsx8(Box7, { padding: 1, children: /* @__PURE__ */ jsx8(Text7, { color: "yellow", children: "No endpoint selected." }) });
  }
  useInput5((input, key) => {
    if (key.escape) {
      setScreen("explorer");
      return;
    }
    if (key.return || input === "r") {
      setScreen("builder");
      return;
    }
    if (input === "c") {
      setScreen("code-gen");
    }
  });
  const getMethodColor = (m) => {
    switch (m) {
      case "GET":
        return "green";
      case "POST":
        return "blue";
      case "PUT":
        return "yellow";
      case "DELETE":
        return "red";
      case "PATCH":
        return "magenta";
      default:
        return "cyan";
    }
  };
  const curlPreview = CodeGenerator.generate("curl", {
    url: `${spec?.baseUrl || "http://localhost"}${activeEndpoint.path}`,
    method: activeEndpoint.method,
    body: activeEndpoint.requestBody?.example
  });
  return /* @__PURE__ */ jsxs7(Box7, { flexDirection: "column", paddingX: 1, children: [
    /* @__PURE__ */ jsxs7(Box7, { borderStyle: "single", borderColor: "cyan", paddingX: 1, marginBottom: 1, justifyContent: "space-between", children: [
      /* @__PURE__ */ jsxs7(Box7, { children: [
        /* @__PURE__ */ jsxs7(Text7, { bold: true, color: getMethodColor(activeEndpoint.method), children: [
          activeEndpoint.method,
          " "
        ] }),
        /* @__PURE__ */ jsx8(Text7, { bold: true, color: "white", children: activeEndpoint.path })
      ] }),
      /* @__PURE__ */ jsxs7(Box7, { children: [
        /* @__PURE__ */ jsx8(Text7, { color: "gray", children: "Source: " }),
        /* @__PURE__ */ jsx8(Text7, { color: "cyan", children: activeEndpoint.source })
      ] })
    ] }),
    activeEndpoint.description && /* @__PURE__ */ jsx8(Box7, { marginBottom: 1, children: /* @__PURE__ */ jsx8(Text7, { color: "white", children: activeEndpoint.description }) }),
    /* @__PURE__ */ jsxs7(Box7, { flexDirection: "column", marginBottom: 1, children: [
      /* @__PURE__ */ jsxs7(Text7, { bold: true, color: "cyan", children: [
        "Parameters (",
        activeEndpoint.parameters.length,
        "):"
      ] }),
      activeEndpoint.parameters.length === 0 ? /* @__PURE__ */ jsx8(Text7, { color: "gray", children: "  None required" }) : activeEndpoint.parameters.map((p, idx) => /* @__PURE__ */ jsxs7(Box7, { children: [
        /* @__PURE__ */ jsx8(Text7, { color: "white", children: "  \u2022 " }),
        /* @__PURE__ */ jsx8(Text7, { bold: true, color: "yellow", children: p.name }),
        /* @__PURE__ */ jsxs7(Text7, { color: "gray", children: [
          " (",
          p.in,
          ") "
        ] }),
        p.required ? /* @__PURE__ */ jsx8(Text7, { color: "red", children: "required " }) : /* @__PURE__ */ jsx8(Text7, { color: "gray", children: "optional " }),
        p.description && /* @__PURE__ */ jsxs7(Text7, { color: "gray", children: [
          "- ",
          p.description
        ] })
      ] }, `${p.name}_${idx}`))
    ] }),
    activeEndpoint.requestBody && /* @__PURE__ */ jsxs7(Box7, { flexDirection: "column", marginBottom: 1, children: [
      /* @__PURE__ */ jsxs7(Text7, { bold: true, color: "cyan", children: [
        "Request Body (",
        activeEndpoint.requestBody.contentType,
        "):"
      ] }),
      activeEndpoint.requestBody.description && /* @__PURE__ */ jsxs7(Text7, { color: "gray", children: [
        "  ",
        activeEndpoint.requestBody.description
      ] }),
      activeEndpoint.requestBody.example && /* @__PURE__ */ jsx8(Box7, { borderStyle: "single", borderColor: "gray", paddingX: 1, children: /* @__PURE__ */ jsx8(Text7, { color: "green", children: JSON.stringify(activeEndpoint.requestBody.example, null, 2).slice(0, 200) }) })
    ] }),
    /* @__PURE__ */ jsxs7(Box7, { flexDirection: "column", marginBottom: 1, children: [
      /* @__PURE__ */ jsx8(Text7, { bold: true, color: "cyan", children: "Responses:" }),
      activeEndpoint.responses.map((r, i) => /* @__PURE__ */ jsxs7(Box7, { children: [
        /* @__PURE__ */ jsxs7(Text7, { color: String(r.statusCode).startsWith("2") ? "green" : "yellow", children: [
          "  ",
          "[",
          r.statusCode,
          "]"
        ] }),
        /* @__PURE__ */ jsxs7(Text7, { color: "gray", children: [
          " ",
          r.description || "Response"
        ] })
      ] }, `${r.statusCode}_${i}`))
    ] }),
    /* @__PURE__ */ jsxs7(Box7, { borderStyle: "single", borderColor: "green", paddingX: 1, justifyContent: "space-between", children: [
      /* @__PURE__ */ jsx8(Text7, { bold: true, color: "green", children: "Press [Enter] to Build & Run Request" }),
      /* @__PURE__ */ jsx8(Text7, { color: "gray", children: "[c] Code Generator \u2502 [Esc] Back" })
    ] })
  ] });
};

// src/tui/screens/RequestBuilderScreen.tsx
import { useState as useState5 } from "react";
import { Box as Box8, Text as Text8, useInput as useInput6 } from "ink";
import { jsx as jsx9, jsxs as jsxs8 } from "react/jsx-runtime";
var RequestBuilderScreen = () => {
  const {
    activeEndpoint,
    setScreen,
    executeRequest,
    builderParams,
    setBuilderParams,
    builderQuery,
    setBuilderQuery,
    builderHeaders,
    setBuilderHeaders,
    builderBody,
    setBuilderBody
  } = useApp();
  const [activeField, setActiveField] = useState5("params");
  const [paramKey, setParamKey] = useState5("");
  const [paramVal, setParamVal] = useState5("");
  const [bodyText, setBodyText] = useState5(
    builderBody || (activeEndpoint?.requestBody?.example ? JSON.stringify(activeEndpoint.requestBody.example, null, 2) : "")
  );
  const [isEditingBody, setIsEditingBody] = useState5(false);
  const [jsonError, setJsonError] = useState5(null);
  if (!activeEndpoint) {
    return /* @__PURE__ */ jsx9(Box8, { padding: 1, children: /* @__PURE__ */ jsx9(Text8, { color: "yellow", children: "No endpoint selected." }) });
  }
  useInput6((input, key) => {
    if (isEditingBody) {
      if (key.escape) {
        setIsEditingBody(false);
        if (bodyText.trim()) {
          try {
            JSON.parse(bodyText);
            setJsonError(null);
            setBuilderBody(bodyText);
          } catch (e) {
            setJsonError(`Invalid JSON: ${e.message}`);
          }
        }
        return;
      }
      if (key.return) {
        setBodyText((prev) => prev + "\n");
        return;
      }
      if (key.backspace || key.delete) {
        setBodyText((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setBodyText((prev) => prev + input);
      }
      return;
    }
    if (key.escape) {
      setScreen("details");
      return;
    }
    if (key.ctrl && input === "r") {
      triggerExecute();
      return;
    }
    if (key.upArrow) {
      if (activeField === "execute") setActiveField("body");
      else if (activeField === "body") setActiveField("params");
      return;
    }
    if (key.downArrow) {
      if (activeField === "params") setActiveField("body");
      else if (activeField === "body") setActiveField("execute");
      return;
    }
    if (key.return) {
      if (activeField === "body") {
        setIsEditingBody(true);
      } else if (activeField === "execute") {
        triggerExecute();
      }
    }
  });
  const triggerExecute = () => {
    if (bodyText.trim()) {
      try {
        JSON.parse(bodyText);
        setBuilderBody(bodyText);
      } catch (e) {
        setJsonError(`Cannot execute: invalid JSON body (${e.message})`);
        return;
      }
    }
    executeRequest();
  };
  return /* @__PURE__ */ jsxs8(Box8, { flexDirection: "column", paddingX: 1, children: [
    /* @__PURE__ */ jsxs8(Box8, { borderStyle: "single", borderColor: "cyan", paddingX: 1, marginBottom: 1, justifyContent: "space-between", children: [
      /* @__PURE__ */ jsx9(Box8, { children: /* @__PURE__ */ jsxs8(Text8, { bold: true, color: "cyan", children: [
        "Request Builder: ",
        activeEndpoint.method,
        " ",
        activeEndpoint.path
      ] }) }),
      /* @__PURE__ */ jsx9(Box8, { children: /* @__PURE__ */ jsx9(Text8, { color: "green", children: "Press Ctrl+R to Execute" }) })
    ] }),
    activeEndpoint.parameters.length > 0 && /* @__PURE__ */ jsxs8(Box8, { flexDirection: "column", marginBottom: 1, children: [
      /* @__PURE__ */ jsx9(Text8, { bold: true, color: "yellow", children: "Parameters:" }),
      activeEndpoint.parameters.map((p, idx) => /* @__PURE__ */ jsxs8(Box8, { children: [
        /* @__PURE__ */ jsxs8(Text8, { color: "gray", children: [
          "  ",
          p.in,
          ": "
        ] }),
        /* @__PURE__ */ jsxs8(Text8, { bold: true, color: "white", children: [
          p.name,
          " =",
          " "
        ] }),
        /* @__PURE__ */ jsx9(Text8, { color: "cyan", children: builderParams[p.name] || p.defaultValue || "(default)" })
      ] }, `${p.name}_${idx}`))
    ] }),
    ["POST", "PUT", "PATCH"].includes(activeEndpoint.method) && /* @__PURE__ */ jsxs8(Box8, { flexDirection: "column", marginBottom: 1, children: [
      /* @__PURE__ */ jsxs8(Box8, { justifyContent: "space-between", children: [
        /* @__PURE__ */ jsxs8(Text8, { bold: true, color: activeField === "body" ? "cyan" : "white", children: [
          activeField === "body" ? "\u276F " : "  ",
          "Request Body (JSON):"
        ] }),
        /* @__PURE__ */ jsx9(Text8, { color: "gray", children: isEditingBody ? /* @__PURE__ */ jsx9(Text8, { color: "green", children: "Editing... (Press Esc when done)" }) : "Press Enter to edit" })
      ] }),
      /* @__PURE__ */ jsx9(
        Box8,
        {
          borderStyle: "single",
          borderColor: isEditingBody ? "green" : activeField === "body" ? "cyan" : "gray",
          paddingX: 1,
          minHeight: 5,
          children: /* @__PURE__ */ jsxs8(Text8, { color: jsonError ? "red" : "white", children: [
            bodyText || "(empty JSON body)",
            isEditingBody && /* @__PURE__ */ jsx9(Text8, { color: "green", children: "\u2588" })
          ] })
        }
      ),
      jsonError && /* @__PURE__ */ jsx9(Box8, { children: /* @__PURE__ */ jsxs8(Text8, { color: "red", children: [
        "\u26A0 ",
        jsonError
      ] }) })
    ] }),
    /* @__PURE__ */ jsx9(
      Box8,
      {
        borderStyle: "double",
        borderColor: activeField === "execute" ? "green" : "gray",
        paddingX: 2,
        marginTop: 1,
        justifyContent: "center",
        children: /* @__PURE__ */ jsx9(Text8, { bold: true, color: activeField === "execute" ? "green" : "white", children: activeField === "execute" ? "\u276F [ EXECUTE REQUEST ] \u276E" : "[ Execute Request ]" })
      }
    )
  ] });
};

// src/tui/screens/ResponseViewerScreen.tsx
import { useState as useState6 } from "react";
import { Box as Box9, Text as Text9, useInput as useInput7 } from "ink";
import { jsx as jsx10, jsxs as jsxs9 } from "react/jsx-runtime";
var ResponseViewerScreen = () => {
  const { lastResponse, lastRequestConfig, setScreen } = useApp();
  const [activeTab, setActiveTab] = useState6("pretty");
  if (!lastResponse) {
    return /* @__PURE__ */ jsx10(Box9, { padding: 1, children: /* @__PURE__ */ jsx10(Text9, { color: "yellow", children: "No response available yet. Execute a request first." }) });
  }
  useInput7((input, key) => {
    if (key.escape) {
      setScreen("builder");
      return;
    }
    if (key.leftArrow) {
      if (activeTab === "timeline") setActiveTab("headers");
      else if (activeTab === "headers") setActiveTab("raw");
      else if (activeTab === "raw") setActiveTab("pretty");
      return;
    }
    if (key.rightArrow) {
      if (activeTab === "pretty") setActiveTab("raw");
      else if (activeTab === "raw") setActiveTab("headers");
      else if (activeTab === "headers") setActiveTab("timeline");
      return;
    }
    if (input === "1") setActiveTab("pretty");
    if (input === "2") setActiveTab("raw");
    if (input === "3") setActiveTab("headers");
    if (input === "4") setActiveTab("timeline");
    if (input === "c") setScreen("code-gen");
  });
  const getStatusColor = (status) => {
    if (status >= 200 && status < 300) return "green";
    if (status >= 300 && status < 400) return "cyan";
    if (status >= 400 && status < 500) return "yellow";
    return "red";
  };
  const renderTimelineBar = (label, ms, total) => {
    const maxChars = 20;
    const count = total > 0 ? Math.max(1, Math.round(ms / total * maxChars)) : 1;
    const bar = "\u2588".repeat(count);
    return /* @__PURE__ */ jsxs9(Box9, { justifyContent: "space-between", width: 40, children: [
      /* @__PURE__ */ jsx10(Text9, { color: "gray", children: label.padEnd(10) }),
      /* @__PURE__ */ jsx10(Text9, { color: "cyan", children: bar }),
      /* @__PURE__ */ jsxs9(Text9, { bold: true, color: "white", children: [
        " ",
        ms,
        "ms"
      ] })
    ] }, label);
  };
  return /* @__PURE__ */ jsxs9(Box9, { flexDirection: "column", paddingX: 1, children: [
    /* @__PURE__ */ jsxs9(
      Box9,
      {
        borderStyle: "single",
        borderColor: getStatusColor(lastResponse.status),
        paddingX: 1,
        justifyContent: "space-between",
        children: [
          /* @__PURE__ */ jsxs9(Box9, { children: [
            /* @__PURE__ */ jsxs9(Text9, { bold: true, color: getStatusColor(lastResponse.status), children: [
              lastResponse.status,
              " ",
              lastResponse.statusText || "OK"
            ] }),
            /* @__PURE__ */ jsx10(Text9, { color: "gray", children: " \u2502 Time: " }),
            /* @__PURE__ */ jsxs9(Text9, { bold: true, color: "white", children: [
              lastResponse.timing.total,
              "ms"
            ] }),
            /* @__PURE__ */ jsx10(Text9, { color: "gray", children: " \u2502 Size: " }),
            /* @__PURE__ */ jsxs9(Text9, { bold: true, color: "white", children: [
              (lastResponse.sizeBytes / 1024).toFixed(2),
              " KB"
            ] })
          ] }),
          /* @__PURE__ */ jsx10(Box9, { children: /* @__PURE__ */ jsxs9(Text9, { color: "gray", children: [
            "URL: ",
            lastResponse.url.slice(0, 35)
          ] }) })
        ]
      }
    ),
    /* @__PURE__ */ jsxs9(Box9, { marginY: 1, children: [
      /* @__PURE__ */ jsxs9(
        Text9,
        {
          color: activeTab === "pretty" ? "cyan" : "gray",
          bold: activeTab === "pretty",
          children: [
            "[1 Pretty]",
            " "
          ]
        }
      ),
      /* @__PURE__ */ jsxs9(
        Text9,
        {
          color: activeTab === "raw" ? "cyan" : "gray",
          bold: activeTab === "raw",
          children: [
            "[2 Raw]",
            " "
          ]
        }
      ),
      /* @__PURE__ */ jsxs9(
        Text9,
        {
          color: activeTab === "headers" ? "cyan" : "gray",
          bold: activeTab === "headers",
          children: [
            "[3 Headers]",
            " "
          ]
        }
      ),
      /* @__PURE__ */ jsx10(
        Text9,
        {
          color: activeTab === "timeline" ? "cyan" : "gray",
          bold: activeTab === "timeline",
          children: "[4 Timeline]"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs9(
      Box9,
      {
        borderStyle: "single",
        borderColor: "gray",
        paddingX: 1,
        minHeight: 10,
        flexDirection: "column",
        children: [
          activeTab === "pretty" && /* @__PURE__ */ jsx10(Box9, { flexDirection: "column", children: lastResponse.isJson && typeof lastResponse.data === "object" ? /* @__PURE__ */ jsxs9(Text9, { color: "white", children: [
            JSON.stringify(lastResponse.data, null, 2).slice(0, 1500),
            JSON.stringify(lastResponse.data).length > 1500 && /* @__PURE__ */ jsxs9(Text9, { color: "gray", children: [
              "\n",
              "... [Truncated for display; switch to Raw or export for full body]"
            ] })
          ] }) : /* @__PURE__ */ jsx10(Text9, { color: "white", children: lastResponse.rawData.slice(0, 1e3) }) }),
          activeTab === "raw" && /* @__PURE__ */ jsx10(Box9, { flexDirection: "column", children: /* @__PURE__ */ jsx10(Text9, { color: "gray", children: lastResponse.rawData.slice(0, 1500) }) }),
          activeTab === "headers" && /* @__PURE__ */ jsx10(Box9, { flexDirection: "column", children: Object.entries(lastResponse.headers).map(([k, v]) => /* @__PURE__ */ jsxs9(Box9, { children: [
            /* @__PURE__ */ jsxs9(Text9, { bold: true, color: "cyan", children: [
              k,
              ":",
              " "
            ] }),
            /* @__PURE__ */ jsx10(Text9, { color: "white", children: Array.isArray(v) ? v.join(", ") : v })
          ] }, k)) }),
          activeTab === "timeline" && /* @__PURE__ */ jsxs9(Box9, { flexDirection: "column", children: [
            /* @__PURE__ */ jsx10(Text9, { bold: true, color: "cyan", marginBottom: 1, children: "Request Latency Breakdown" }),
            renderTimelineBar("DNS", lastResponse.timing.dns, lastResponse.timing.total),
            renderTimelineBar("Connect", lastResponse.timing.tcp, lastResponse.timing.total),
            renderTimelineBar("TLS", lastResponse.timing.tls, lastResponse.timing.total),
            renderTimelineBar("Server TTFB", lastResponse.timing.ttfb, lastResponse.timing.total),
            renderTimelineBar("Download", lastResponse.timing.download, lastResponse.timing.total),
            /* @__PURE__ */ jsx10(Box9, { borderStyle: "single", borderColor: "gray", width: 40, marginTop: 1, paddingX: 1, children: /* @__PURE__ */ jsxs9(Text9, { bold: true, color: "green", children: [
              "Total Latency: ",
              lastResponse.timing.total,
              "ms"
            ] }) })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ jsxs9(Box9, { justifyContent: "space-between", marginTop: 1, children: [
      /* @__PURE__ */ jsx10(Text9, { color: "gray", children: "Use \u2190 \u2192 or 1-4 to switch tabs \u2502 [Esc] Back to Builder" }),
      /* @__PURE__ */ jsx10(Text9, { color: "gray", children: "[c] Code Generator" })
    ] })
  ] });
};

// src/tui/screens/HistoryScreen.tsx
import { useState as useState7 } from "react";
import { Box as Box10, Text as Text10, useInput as useInput8 } from "ink";
import { jsx as jsx11, jsxs as jsxs10 } from "react/jsx-runtime";
var HistoryScreen = () => {
  const { historyItems, setScreen, executeRequest } = useApp();
  const [selectedIndex, setSelectedIndex] = useState7(0);
  if (historyItems.length === 0) {
    return /* @__PURE__ */ jsxs10(Box10, { flexDirection: "column", padding: 1, children: [
      /* @__PURE__ */ jsx11(Text10, { color: "yellow", children: "No request history recorded yet." }),
      /* @__PURE__ */ jsx11(Text10, { color: "gray", children: "Execute requests from the Explorer to build history." })
    ] });
  }
  useInput8((input, key) => {
    if (key.escape) {
      setScreen("dashboard");
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => prev > 0 ? prev - 1 : historyItems.length - 1);
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => prev < historyItems.length - 1 ? prev + 1 : 0);
      return;
    }
    if (key.return || input === "r") {
      const item = historyItems[selectedIndex];
      if (item) {
        executeRequest({
          url: item.url,
          method: item.method,
          headers: item.request.headers,
          query: item.request.query,
          body: item.request.body
        });
      }
    }
  });
  const getStatusColor = (s) => {
    if (s >= 200 && s < 300) return "green";
    if (s >= 400 && s < 500) return "yellow";
    return "red";
  };
  return /* @__PURE__ */ jsxs10(Box10, { flexDirection: "column", paddingX: 1, children: [
    /* @__PURE__ */ jsxs10(Box10, { justifyContent: "space-between", marginBottom: 1, children: [
      /* @__PURE__ */ jsxs10(Text10, { bold: true, color: "cyan", children: [
        "Request History (",
        historyItems.length,
        " items)"
      ] }),
      /* @__PURE__ */ jsx11(Text10, { color: "gray", children: "Press Enter to Replay \u2502 Esc to Back" })
    ] }),
    /* @__PURE__ */ jsx11(
      Box10,
      {
        flexDirection: "column",
        borderStyle: "single",
        borderColor: "gray",
        paddingX: 1,
        minHeight: 12,
        children: historyItems.slice(0, 15).map((item, i) => {
          const isSelected = i === selectedIndex;
          const timeStr = new Date(item.timestamp).toLocaleTimeString();
          return /* @__PURE__ */ jsxs10(Box10, { justifyContent: "space-between", children: [
            /* @__PURE__ */ jsxs10(Box10, { children: [
              /* @__PURE__ */ jsx11(Text10, { color: isSelected ? "cyan" : "white", bold: isSelected, children: isSelected ? "\u276F " : "  " }),
              /* @__PURE__ */ jsxs10(Text10, { color: "gray", children: [
                timeStr,
                " "
              ] }),
              /* @__PURE__ */ jsx11(Text10, { bold: true, color: "cyan", children: item.method.padEnd(7) }),
              /* @__PURE__ */ jsx11(Text10, { color: "white", children: item.path.slice(0, 35) })
            ] }),
            /* @__PURE__ */ jsxs10(Box10, { children: [
              /* @__PURE__ */ jsxs10(Text10, { bold: true, color: getStatusColor(item.status), children: [
                item.status,
                " "
              ] }),
              /* @__PURE__ */ jsxs10(Text10, { color: "gray", children: [
                "(",
                item.durationMs,
                "ms)"
              ] })
            ] })
          ] }, item.id);
        })
      }
    )
  ] });
};

// src/tui/screens/EnvironmentsScreen.tsx
import { useState as useState8 } from "react";
import { Box as Box11, Text as Text11, useInput as useInput9 } from "ink";
import { jsx as jsx12, jsxs as jsxs11 } from "react/jsx-runtime";
var EnvironmentsScreen = () => {
  const { environments, activeEnv, switchEnvironment, setScreen } = useApp();
  const [selectedIndex, setSelectedIndex] = useState8(0);
  useInput9((input, key) => {
    if (key.escape) {
      setScreen("dashboard");
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => prev > 0 ? prev - 1 : environments.length - 1);
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => prev < environments.length - 1 ? prev + 1 : 0);
      return;
    }
    if (key.return) {
      const selected = environments[selectedIndex];
      if (selected) {
        switchEnvironment(selected.name);
      }
    }
  });
  return /* @__PURE__ */ jsxs11(Box11, { flexDirection: "column", paddingX: 1, children: [
    /* @__PURE__ */ jsxs11(Box11, { justifyContent: "space-between", marginBottom: 1, children: [
      /* @__PURE__ */ jsxs11(Text11, { bold: true, color: "cyan", children: [
        "Environments (",
        environments.length,
        ")"
      ] }),
      /* @__PURE__ */ jsx12(Text11, { color: "gray", children: "Press Enter to Activate \u2502 Esc to Back" })
    ] }),
    /* @__PURE__ */ jsx12(
      Box11,
      {
        flexDirection: "column",
        borderStyle: "single",
        borderColor: "gray",
        paddingX: 1,
        minHeight: 10,
        children: environments.map((env, i) => {
          const isSelected = i === selectedIndex;
          const isActive = env.name === activeEnv.name;
          return /* @__PURE__ */ jsxs11(Box11, { justifyContent: "space-between", marginY: 0, children: [
            /* @__PURE__ */ jsxs11(Box11, { children: [
              /* @__PURE__ */ jsx12(Text11, { color: isSelected ? "cyan" : "white", bold: isSelected, children: isSelected ? "\u276F " : "  " }),
              /* @__PURE__ */ jsx12(Text11, { bold: true, color: env.isProduction ? "red" : "green", children: env.name.padEnd(15) }),
              /* @__PURE__ */ jsx12(Text11, { color: "white", children: env.baseUrl })
            ] }),
            /* @__PURE__ */ jsx12(Box11, { children: isActive ? /* @__PURE__ */ jsx12(Text11, { bold: true, color: "green", children: "[ACTIVE]" }) : /* @__PURE__ */ jsx12(Text11, { color: "gray", children: "[Inactive]" }) })
          ] }, env.name);
        })
      }
    )
  ] });
};

// src/tui/screens/CollectionsScreen.tsx
import { useState as useState9 } from "react";
import { Box as Box12, Text as Text12, useInput as useInput10 } from "ink";
import { jsx as jsx13, jsxs as jsxs12 } from "react/jsx-runtime";
var CollectionsScreen = () => {
  const { collectionManager, setScreen, executeRequest } = useApp();
  const [collections] = useState9(() => collectionManager.getCollections());
  const [selectedIndex, setSelectedIndex] = useState9(0);
  if (collections.length === 0) {
    return /* @__PURE__ */ jsxs12(Box12, { flexDirection: "column", padding: 1, children: [
      /* @__PURE__ */ jsx13(Text12, { color: "yellow", children: "No collections found." }),
      /* @__PURE__ */ jsx13(Text12, { color: "gray", children: 'Create collections with: apix collection create "My API"' })
    ] });
  }
  useInput10((input, key) => {
    if (key.escape) {
      setScreen("dashboard");
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((prev) => prev > 0 ? prev - 1 : collections.length - 1);
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => prev < collections.length - 1 ? prev + 1 : 0);
      return;
    }
  });
  return /* @__PURE__ */ jsxs12(Box12, { flexDirection: "column", paddingX: 1, children: [
    /* @__PURE__ */ jsxs12(Box12, { justifyContent: "space-between", marginBottom: 1, children: [
      /* @__PURE__ */ jsxs12(Text12, { bold: true, color: "cyan", children: [
        "Collections (",
        collections.length,
        ")"
      ] }),
      /* @__PURE__ */ jsx13(Text12, { color: "gray", children: "Esc to Back" })
    ] }),
    /* @__PURE__ */ jsx13(
      Box12,
      {
        flexDirection: "column",
        borderStyle: "single",
        borderColor: "gray",
        paddingX: 1,
        minHeight: 10,
        children: collections.map((col, i) => {
          const isSelected = i === selectedIndex;
          return /* @__PURE__ */ jsxs12(Box12, { justifyContent: "space-between", children: [
            /* @__PURE__ */ jsxs12(Box12, { children: [
              /* @__PURE__ */ jsx13(Text12, { color: isSelected ? "cyan" : "white", bold: isSelected, children: isSelected ? "\u276F " : "  " }),
              /* @__PURE__ */ jsx13(Text12, { bold: true, color: "white", children: col.name }),
              /* @__PURE__ */ jsxs12(Text12, { color: "gray", children: [
                " (",
                col.requests.length,
                " requests)"
              ] })
            ] }),
            /* @__PURE__ */ jsx13(Box12, { children: /* @__PURE__ */ jsx13(Text12, { color: "gray", children: col.description || "" }) })
          ] }, col.id);
        })
      }
    )
  ] });
};

// src/tui/screens/CodeGenScreen.tsx
import { useState as useState10 } from "react";
import { Box as Box13, Text as Text13, useInput as useInput11 } from "ink";
import { jsx as jsx14, jsxs as jsxs13 } from "react/jsx-runtime";
var CodeGenScreen = () => {
  const { activeEndpoint, spec, setScreen } = useApp();
  const languages = [
    "curl",
    "javascript",
    "typescript",
    "python",
    "go",
    "java",
    "php",
    "dart",
    "csharp",
    "rust"
  ];
  const [selectedLangIndex, setSelectedLangIndex] = useState10(0);
  if (!activeEndpoint) {
    return /* @__PURE__ */ jsx14(Box13, { padding: 1, children: /* @__PURE__ */ jsx14(Text13, { color: "yellow", children: "No endpoint selected to generate code for." }) });
  }
  const currentLang = languages[selectedLangIndex];
  const fullUrl = `${spec?.baseUrl || "http://localhost"}${activeEndpoint.path}`;
  const code = CodeGenerator.generate(currentLang, {
    url: fullUrl,
    method: activeEndpoint.method,
    body: activeEndpoint.requestBody?.example
  });
  useInput11((input, key) => {
    if (key.escape) {
      setScreen("details");
      return;
    }
    if (key.leftArrow || key.upArrow) {
      setSelectedLangIndex((prev) => prev > 0 ? prev - 1 : languages.length - 1);
      return;
    }
    if (key.rightArrow || key.downArrow) {
      setSelectedLangIndex((prev) => prev < languages.length - 1 ? prev + 1 : 0);
      return;
    }
  });
  return /* @__PURE__ */ jsxs13(Box13, { flexDirection: "column", paddingX: 1, children: [
    /* @__PURE__ */ jsxs13(Box13, { justifyContent: "space-between", marginBottom: 1, children: [
      /* @__PURE__ */ jsxs13(Text13, { bold: true, color: "cyan", children: [
        "Code Generator: ",
        activeEndpoint.method,
        " ",
        activeEndpoint.path
      ] }),
      /* @__PURE__ */ jsx14(Text13, { color: "gray", children: "\u2190 \u2192 to change language \u2502 Esc to Back" })
    ] }),
    /* @__PURE__ */ jsx14(Box13, { marginBottom: 1, flexWrap: "wrap", children: languages.map((lang, i) => {
      const isSelected = i === selectedLangIndex;
      return /* @__PURE__ */ jsx14(Box13, { marginRight: 1, children: /* @__PURE__ */ jsxs13(
        Text13,
        {
          color: isSelected ? "black" : "cyan",
          backgroundColor: isSelected ? "cyan" : void 0,
          bold: isSelected,
          children: [
            " ",
            "[",
            lang.toUpperCase(),
            "]",
            " "
          ]
        }
      ) }, lang);
    }) }),
    /* @__PURE__ */ jsx14(
      Box13,
      {
        borderStyle: "single",
        borderColor: "gray",
        paddingX: 1,
        minHeight: 12,
        flexDirection: "column",
        children: /* @__PURE__ */ jsx14(Text13, { color: "white", children: code })
      }
    )
  ] });
};

// src/tui/app.tsx
import { jsx as jsx15, jsxs as jsxs14 } from "react/jsx-runtime";
var TuiMain = () => {
  const { screen, warningModal } = useApp();
  const { exit } = useInkApp();
  const [showPalette, setShowPalette] = useState11(false);
  useInput12((input, key) => {
    if (key.ctrl && input === "p") {
      setShowPalette((prev) => !prev);
      return;
    }
    if (!showPalette && !warningModal && input === "q") {
      exit();
      process.exit(0);
    }
  });
  return /* @__PURE__ */ jsxs14(Box14, { flexDirection: "column", minHeight: 20, padding: 1, children: [
    /* @__PURE__ */ jsx15(Header, {}),
    /* @__PURE__ */ jsxs14(Box14, { flexDirection: "column", flexGrow: 1, children: [
      screen === "dashboard" && /* @__PURE__ */ jsx15(DashboardScreen, {}),
      screen === "explorer" && /* @__PURE__ */ jsx15(ExplorerScreen, {}),
      screen === "details" && /* @__PURE__ */ jsx15(EndpointDetailScreen, {}),
      screen === "builder" && /* @__PURE__ */ jsx15(RequestBuilderScreen, {}),
      screen === "response" && /* @__PURE__ */ jsx15(ResponseViewerScreen, {}),
      screen === "history" && /* @__PURE__ */ jsx15(HistoryScreen, {}),
      screen === "environments" && /* @__PURE__ */ jsx15(EnvironmentsScreen, {}),
      screen === "collections" && /* @__PURE__ */ jsx15(CollectionsScreen, {}),
      screen === "code-gen" && /* @__PURE__ */ jsx15(CodeGenScreen, {})
    ] }),
    showPalette && /* @__PURE__ */ jsx15(Box14, { position: "absolute", marginTop: 3, marginLeft: 4, children: /* @__PURE__ */ jsx15(CommandPalette, { onClose: () => setShowPalette(false) }) }),
    warningModal && /* @__PURE__ */ jsx15(Box14, { position: "absolute", marginTop: 4, marginLeft: 6, children: /* @__PURE__ */ jsx15(
      ProductionWarning,
      {
        message: warningModal.message,
        onConfirm: warningModal.onConfirm,
        onCancel: warningModal.onCancel
      }
    ) }),
    /* @__PURE__ */ jsx15(StatusBar, {})
  ] });
};
var App = ({ initialUrl }) => {
  return /* @__PURE__ */ jsx15(AppProvider, { initialUrl, children: /* @__PURE__ */ jsx15(TuiMain, {}) });
};

// src/core/diff/api-diff.ts
var ApiDiffer = class {
  static diff(specA, specB) {
    const mapA = /* @__PURE__ */ new Map();
    const mapB = /* @__PURE__ */ new Map();
    for (const ep of specA.endpoints) {
      mapA.set(`${ep.method.toUpperCase()} ${ep.path}`, ep);
    }
    for (const ep of specB.endpoints) {
      mapB.set(`${ep.method.toUpperCase()} ${ep.path}`, ep);
    }
    const addedEndpoints = [];
    const removedEndpoints = [];
    const modifiedEndpoints = [];
    for (const [key, epB] of mapB.entries()) {
      const epA = mapA.get(key);
      if (!epA) {
        addedEndpoints.push({
          method: epB.method,
          path: epB.path,
          summary: epB.summary
        });
      } else {
        const changes = [];
        let isBreaking = false;
        const paramsA = new Map(epA.parameters.map((p) => [p.name, p]));
        const paramsB = new Map(epB.parameters.map((p) => [p.name, p]));
        for (const [pName, pB] of paramsB.entries()) {
          const pA = paramsA.get(pName);
          if (!pA) {
            changes.push(`Added parameter: ${pName} (${pB.in}, ${pB.required ? "required" : "optional"})`);
            if (pB.required) isBreaking = true;
          } else if (!pA.required && pB.required) {
            changes.push(`Parameter ${pName} changed from optional to required`);
            isBreaking = true;
          }
        }
        for (const [pName, pA] of paramsA.entries()) {
          if (!paramsB.has(pName)) {
            changes.push(`Removed parameter: ${pName} (${pA.in})`);
            if (pA.required) isBreaking = true;
          }
        }
        if (!epA.requestBody && epB.requestBody?.required) {
          changes.push("Added required request body");
          isBreaking = true;
        } else if (epA.requestBody?.required && !epB.requestBody) {
          changes.push("Removed request body");
        }
        const codesA = new Set(epA.responses.map((r) => String(r.statusCode)));
        const codesB = new Set(epB.responses.map((r) => String(r.statusCode)));
        for (const code of codesB) {
          if (!codesA.has(code)) {
            changes.push(`Added response status: ${code}`);
          }
        }
        for (const code of codesA) {
          if (!codesB.has(code) && code.startsWith("2")) {
            changes.push(`Removed success response status: ${code}`);
            isBreaking = true;
          }
        }
        if (changes.length > 0) {
          modifiedEndpoints.push({
            method: epB.method,
            path: epB.path,
            changes,
            breaking: isBreaking
          });
        }
      }
    }
    for (const [key, epA] of mapA.entries()) {
      if (!mapB.has(key)) {
        removedEndpoints.push({
          method: epA.method,
          path: epA.path,
          summary: epA.summary
        });
      }
    }
    const schemaChanges = [];
    const schemasA = specA.schemas || {};
    const schemasB = specB.schemas || {};
    for (const sName of Object.keys(schemasB)) {
      if (!schemasA[sName]) {
        schemaChanges.push(`Added schema: ${sName}`);
      }
    }
    for (const sName of Object.keys(schemasA)) {
      if (!schemasB[sName]) {
        schemaChanges.push(`Removed schema: ${sName}`);
      }
    }
    return {
      addedEndpoints,
      removedEndpoints,
      modifiedEndpoints,
      schemaChanges
    };
  }
};

// src/core/docs/docs-generator.ts
var DocsGenerator = class {
  static generateMarkdown(spec) {
    const lines = [];
    lines.push(`# ${spec.title} (v${spec.version})`);
    if (spec.description) lines.push(`
${spec.description}
`);
    lines.push(`**Base URL:** \`${spec.baseUrl}\`
`);
    lines.push(`## Endpoints
`);
    const groups = {};
    for (const ep of spec.endpoints) {
      const tag = ep.tags[0] || "General";
      if (!groups[tag]) groups[tag] = [];
      groups[tag].push(ep);
    }
    for (const [tag, endpoints] of Object.entries(groups)) {
      lines.push(`### ${tag}
`);
      for (const ep of endpoints) {
        lines.push(`#### \`${ep.method}\` ${ep.path}`);
        if (ep.summary) lines.push(`*${ep.summary}*`);
        if (ep.description) lines.push(`
${ep.description}
`);
        if (ep.parameters.length > 0) {
          lines.push("\n**Parameters:**");
          lines.push("| Name | Location | Required | Description |");
          lines.push("| :--- | :--- | :--- | :--- |");
          for (const p of ep.parameters) {
            lines.push(
              `| \`${p.name}\` | ${p.in} | ${p.required ? "**Yes**" : "No"} | ${p.description || "-"} |`
            );
          }
          lines.push("");
        }
        if (ep.requestBody) {
          lines.push(`**Request Body (${ep.requestBody.contentType}):**`);
          if (ep.requestBody.description) lines.push(`*${ep.requestBody.description}*`);
          if (ep.requestBody.example) {
            lines.push("```json");
            lines.push(JSON.stringify(ep.requestBody.example, null, 2));
            lines.push("```\n");
          }
        }
        lines.push("**Responses:**");
        for (const resp of ep.responses) {
          lines.push(`- **${resp.statusCode}**: ${resp.description || "Response"}`);
          if (resp.example) {
            lines.push("  ```json");
            lines.push("  " + JSON.stringify(resp.example, null, 2).split("\n").join("\n  "));
            lines.push("  ```");
          }
        }
        const curl = CodeGenerator.generate("curl", {
          url: `${spec.baseUrl}${ep.path}`,
          method: ep.method,
          body: ep.requestBody?.example
        });
        lines.push("\n**cURL Example:**");
        lines.push("```bash");
        lines.push(curl);
        lines.push("```\n");
        lines.push("---\n");
      }
    }
    return lines.join("\n");
  }
  static generateHtml(spec) {
    const md = this.generateMarkdown(spec);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${spec.title} - APiX Documentation</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #38bdf8;
      --accent: #818cf8;
      --border: #334155;
      --badge-get: #10b981;
      --badge-post: #3b82f6;
      --badge-put: #f59e0b;
      --badge-delete: #ef4444;
      --badge-patch: #8b5cf6;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      margin: 0;
      padding: 2rem;
    }
    .container { max-width: 960px; margin: 0 auto; }
    h1 { color: var(--primary); border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; }
    h2 { color: var(--accent); margin-top: 2rem; }
    h3 { margin-top: 1.5rem; color: #cbd5e1; }
    .endpoint { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .method-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: bold; font-size: 0.85rem; color: white; margin-right: 0.5rem; }
    .method-GET { background: var(--badge-get); }
    .method-POST { background: var(--badge-post); }
    .method-PUT { background: var(--badge-put); }
    .method-DELETE { background: var(--badge-delete); }
    .method-PATCH { background: var(--badge-patch); }
    pre { background: #020617; padding: 1rem; border-radius: 6px; overflow-x: auto; color: #e2e8f0; font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 0.9rem; }
    th, td { border: 1px solid var(--border); padding: 0.6rem; text-align: left; }
    th { background: #020617; color: var(--primary); }
  </style>
</head>
<body>
  <div class="container">
    <h1>${spec.title} <small style="font-size:0.5em;color:var(--text-muted)">v${spec.version}</small></h1>
    <p>${spec.description || "API Documentation generated by APiX."}</p>
    <p><strong>Base URL:</strong> <code>${spec.baseUrl}</code></p>
    <h2>Endpoints (${spec.endpoints.length})</h2>
    ${spec.endpoints.map(
      (ep) => `
      <div class="endpoint">
        <div>
          <span class="method-badge method-${ep.method}">${ep.method}</span>
          <strong style="font-size:1.1rem">${ep.path}</strong>
        </div>
        <p style="color:var(--text-muted);margin:0.5rem 0;">${ep.summary || ""}</p>
        ${ep.parameters.length > 0 ? `<h4>Parameters</h4>
            <table>
              <tr><th>Name</th><th>In</th><th>Required</th><th>Description</th></tr>
              ${ep.parameters.map(
        (p) => `<tr><td><code>${p.name}</code></td><td>${p.in}</td><td>${p.required ? "Yes" : "No"}</td><td>${p.description || "-"}</td></tr>`
      ).join("")}
            </table>` : ""}
        <h4>cURL</h4>
        <pre><code>${CodeGenerator.generate("curl", { url: `${spec.baseUrl}${ep.path}`, method: ep.method, body: ep.requestBody?.example })}</code></pre>
      </div>`
    ).join("")}
  </div>
</body>
</html>`;
  }
};

// src/core/mock/mock-server.ts
import http2 from "http";
var MockServer = class {
  spec;
  server = null;
  port = 5050;
  constructor(spec, port = 5050) {
    this.spec = spec;
    this.port = port;
  }
  start() {
    return new Promise((resolve, reject) => {
      this.server = http2.createServer((req, res) => {
        const method = (req.method || "GET").toUpperCase();
        const reqUrl = new URL(req.url || "/", `http://localhost:${this.port}`);
        const pathname = reqUrl.pathname;
        const match = this.findMatchingEndpoint(method, pathname);
        if (!match) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Not Found",
              message: `No mock route matched for ${method} ${pathname}`,
              availableEndpoints: this.spec.endpoints.map((e) => `${e.method} ${e.path}`)
            })
          );
          return;
        }
        const responseDef = match.responses.find((r) => String(r.statusCode).startsWith("2")) || match.responses[0];
        const statusCode = responseDef ? parseInt(String(responseDef.statusCode), 10) || 200 : 200;
        const contentType = responseDef?.contentType || "application/json";
        let bodyPayload = null;
        if (responseDef?.example !== void 0) {
          bodyPayload = responseDef.example;
        } else if (responseDef?.schema) {
          bodyPayload = this.generateSampleFromSchema(responseDef.schema);
        } else {
          bodyPayload = {
            message: `Mock response for ${method} ${pathname}`,
            status: statusCode
          };
        }
        res.writeHead(statusCode, {
          "Content-Type": contentType,
          "X-APiX-Mock": "true",
          "Access-Control-Allow-Origin": "*"
        });
        if (typeof bodyPayload === "object") {
          res.end(JSON.stringify(bodyPayload, null, 2));
        } else {
          res.end(String(bodyPayload));
        }
      });
      this.server.on("error", reject);
      this.server.listen(this.port, () => {
        resolve(`http://localhost:${this.port}`);
      });
    });
  }
  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
  findMatchingEndpoint(method, pathname) {
    for (const ep of this.spec.endpoints) {
      if (ep.method.toUpperCase() !== method) continue;
      const regexStr = "^" + ep.path.replace(/\{([a-zA-Z0-9_-]+)\}/g, "([^/]+)").replace(/:([a-zA-Z0-9_-]+)/g, "([^/]+)") + "$";
      const regex = new RegExp(regexStr);
      if (regex.test(pathname)) {
        return ep;
      }
    }
    return void 0;
  }
  generateSampleFromSchema(schema) {
    if (!schema || typeof schema !== "object") return null;
    if (schema.example !== void 0) return schema.example;
    if (schema.default !== void 0) return schema.default;
    switch (schema.type) {
      case "string":
        if (schema.enum && schema.enum.length > 0) return schema.enum[0];
        if (schema.format === "date-time") return (/* @__PURE__ */ new Date()).toISOString();
        if (schema.format === "email") return "developer@example.com";
        if (schema.format === "uri") return "https://example.com";
        return "sample_text";
      case "integer":
      case "number":
        return 42;
      case "boolean":
        return true;
      case "array": {
        const itemSchema = schema.items || {};
        return [this.generateSampleFromSchema(itemSchema)];
      }
      case "object":
      default: {
        const obj = {};
        const props = schema.properties || {};
        for (const [propName, propSchema] of Object.entries(props)) {
          obj[propName] = this.generateSampleFromSchema(propSchema);
        }
        return obj;
      }
    }
  }
};

// src/core/analyze/quality-analyzer.ts
var QualityAnalyzer = class {
  static analyze(spec) {
    const totalEndpoints = spec.endpoints.length;
    if (totalEndpoints === 0) {
      return {
        score: 0,
        documentationCoverage: 0,
        schemaCoverage: 0,
        errorDefinitionCoverage: 0,
        exampleCoverage: 0,
        totalEndpoints: 0,
        endpointsWithoutDescriptions: [],
        endpointsWithoutSchemas: [],
        endpointsWithoutErrors: [],
        endpointsWithoutExamples: [],
        warnings: ["No endpoints found in API specification"],
        suggestions: ["Define paths and operations in your OpenAPI document."]
      };
    }
    const withoutDescriptions = [];
    const withoutSchemas = [];
    const withoutErrors = [];
    const withoutExamples = [];
    let documentedCount = 0;
    let schemaCount = 0;
    let errorCount = 0;
    let exampleCount = 0;
    for (const ep of spec.endpoints) {
      const epLabel = `${ep.method} ${ep.path}`;
      if (ep.description || ep.summary && ep.summary !== epLabel) {
        documentedCount++;
      } else {
        withoutDescriptions.push(epLabel);
      }
      const hasResponseSchema = ep.responses.some((r) => Boolean(r.schema));
      const hasBodySchema = ep.requestBody ? Boolean(ep.requestBody.schema) : true;
      if (hasResponseSchema && hasBodySchema) {
        schemaCount++;
      } else {
        withoutSchemas.push(epLabel);
      }
      const hasErrorDef = ep.responses.some((r) => {
        const code = String(r.statusCode);
        return code.startsWith("4") || code.startsWith("5") || code === "default";
      });
      if (hasErrorDef) {
        errorCount++;
      } else {
        withoutErrors.push(epLabel);
      }
      const hasExamples = ep.parameters.some((p) => p.example !== void 0) || Boolean(ep.requestBody?.example) || ep.responses.some((r) => r.example !== void 0);
      if (hasExamples) {
        exampleCount++;
      } else {
        withoutExamples.push(epLabel);
      }
    }
    const docPct = Math.round(documentedCount / totalEndpoints * 100);
    const schemaPct = Math.round(schemaCount / totalEndpoints * 100);
    const errorPct = Math.round(errorCount / totalEndpoints * 100);
    const examplePct = Math.round(exampleCount / totalEndpoints * 100);
    const overallScore = Math.round(docPct * 0.3 + schemaPct * 0.35 + errorPct * 0.2 + examplePct * 0.15);
    const warnings = [];
    const suggestions = [];
    if (withoutDescriptions.length > 0) {
      warnings.push(`${withoutDescriptions.length} endpoint(s) lack descriptions or summaries`);
      suggestions.push("Add descriptive summaries and detailed descriptions to all operations.");
    }
    if (withoutSchemas.length > 0) {
      warnings.push(`${withoutSchemas.length} endpoint(s) have missing request/response schemas`);
      suggestions.push("Specify explicit JSON schemas for responses and request bodies.");
    }
    if (withoutErrors.length > 0) {
      warnings.push(`${withoutErrors.length} endpoint(s) do not document error responses (4xx/5xx)`);
      suggestions.push("Document standard error payloads (e.g. 400 Bad Request, 401 Unauthorized, 404 Not Found).");
    }
    if (withoutExamples.length > 0) {
      warnings.push(`${withoutExamples.length} endpoint(s) have no request/response examples`);
      suggestions.push("Include realistic JSON examples in request bodies and responses.");
    }
    return {
      score: overallScore,
      documentationCoverage: docPct,
      schemaCoverage: schemaPct,
      errorDefinitionCoverage: errorPct,
      exampleCoverage: examplePct,
      totalEndpoints,
      endpointsWithoutDescriptions: withoutDescriptions,
      endpointsWithoutSchemas: withoutSchemas,
      endpointsWithoutErrors: withoutErrors,
      endpointsWithoutExamples: withoutExamples,
      warnings,
      suggestions
    };
  }
};

// src/core/analyze/api-explainer.ts
var ApiExplainer = class {
  static async explain(spec, client) {
    const http3 = client || new HttpClient();
    const resources = {};
    for (const ep of spec.endpoints) {
      const tag = ep.tags[0] || "General";
      if (!resources[tag]) resources[tag] = [];
      resources[tag].push({
        method: ep.method,
        path: ep.path,
        summary: ep.summary
      });
    }
    const potentialIssues = [];
    let undocSchemas = 0;
    let undocErrors = 0;
    for (const ep of spec.endpoints) {
      if (ep.method === "DELETE" && !ep.responses.some((r) => Boolean(r.schema))) {
        undocSchemas++;
      }
      if (!ep.responses.some((r) => String(r.statusCode).startsWith("4"))) {
        undocErrors++;
      }
    }
    if (undocSchemas > 0) {
      potentialIssues.push(`\u26A0 ${undocSchemas} DELETE/PUT operation(s) have no documented response schema`);
    }
    if (undocErrors > 0) {
      potentialIssues.push(`\u26A0 ${undocErrors} endpoint(s) lack 4xx/5xx error definitions`);
    }
    const hasAuth = spec.endpoints.some((e) => Boolean(e.security && e.security.length > 0));
    if (hasAuth) {
      potentialIssues.push("\u2713 Authentication requirements defined across endpoints");
    }
    let healthStatus = "Unknown";
    try {
      const healthResp = await http3.request({
        url: `${spec.baseUrl}/health`,
        method: "GET",
        timeoutMs: 3e3
      });
      if (healthResp.status >= 200 && healthResp.status < 300) {
        healthStatus = `\u2713 Health check online (${healthResp.timing.total}ms)`;
      } else {
        healthStatus = `\u26A0 Health check returned HTTP ${healthResp.status}`;
      }
    } catch {
      healthStatus = "\u25CB No explicit /health endpoint detected";
    }
    return {
      name: spec.title || "API",
      version: spec.version || "1.0.0",
      protocol: spec.baseUrl.startsWith("https") ? "HTTPS (REST)" : "HTTP (REST)",
      docFormat: spec.rawSpec?.openapi ? `OpenAPI ${spec.rawSpec.openapi}` : spec.rawSpec?.swagger ? `Swagger ${spec.rawSpec.swagger}` : "Inferred Spec",
      endpointCount: spec.endpoints.length,
      schemaCount: Object.keys(spec.schemas || {}).length,
      authType: hasAuth ? "Defined" : "None / Public",
      resources,
      potentialIssues,
      healthStatus
    };
  }
};

// src/core/config/config-manager.ts
import fs6 from "fs/promises";
import os5 from "os";
import path6 from "path";
var DEFAULT_CONFIG = {
  theme: "dark",
  timeoutMs: 2e4,
  historyEnabled: true,
  maxHistoryItems: 500,
  allowInsecureTls: false
};
var ConfigManager = class {
  configDir;
  configFilePath;
  config = { ...DEFAULT_CONFIG };
  constructor(customDir) {
    this.configDir = customDir || path6.join(os5.homedir(), ".apix");
    this.configFilePath = path6.join(this.configDir, "config.json");
  }
  async init() {
    try {
      await fs6.mkdir(this.configDir, { recursive: true });
      const data = await fs6.readFile(this.configFilePath, "utf-8");
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch {
      this.config = { ...DEFAULT_CONFIG };
      await this.save();
    }
  }
  async save() {
    await fs6.mkdir(this.configDir, { recursive: true });
    await fs6.writeFile(this.configFilePath, JSON.stringify(this.config, null, 2), "utf-8");
  }
  get(key) {
    return this.config[key];
  }
  async set(key, value) {
    this.config[key] = value;
    await this.save();
  }
  getAll() {
    return { ...this.config };
  }
};

// src/core/ai/nl-request-builder.ts
var NlRequestBuilder = class {
  static proposeRequest(query, spec) {
    const text = query.toLowerCase();
    let inferredMethod = "GET";
    if (text.includes("create") || text.includes("add") || text.includes("post") || text.includes("new")) {
      inferredMethod = "POST";
    } else if (text.includes("update") || text.includes("modify") || text.includes("put") || text.includes("patch")) {
      inferredMethod = "PUT";
    } else if (text.includes("delete") || text.includes("remove")) {
      inferredMethod = "DELETE";
    }
    let bestEndpoint = null;
    let maxScore = -1;
    for (const ep of spec.endpoints) {
      let score = 0;
      if (ep.method === inferredMethod) score += 5;
      const pathParts = ep.path.toLowerCase().split(/[\/-_]/).filter(Boolean);
      for (const part of pathParts) {
        if (part !== "api" && part !== "v1" && part !== "v2" && text.includes(part)) {
          score += 10;
        }
      }
      if (ep.summary && ep.summary.toLowerCase().split(/\s+/).some((w) => w.length > 3 && text.includes(w))) {
        score += 8;
      }
      if (score > maxScore) {
        maxScore = score;
        bestEndpoint = ep;
      }
    }
    if (!bestEndpoint || maxScore <= 0) {
      bestEndpoint = spec.endpoints.find((e) => e.method === inferredMethod) || spec.endpoints[0];
    }
    if (!bestEndpoint) return null;
    const extractedQuery = {};
    const limitMatch = text.match(/(?:limit|first|top|size)\s*=?\s*(\d+)/i) || text.match(/(\d+)\s+(?:items|results|bookings|users|products)/i);
    if (limitMatch) {
      const limitVal = parseInt(limitMatch[1], 10);
      const limitParam = bestEndpoint.parameters.find(
        (p) => p.name.toLowerCase().includes("limit") || p.name.toLowerCase().includes("size") || p.name.toLowerCase().includes("count")
      );
      if (limitParam) {
        extractedQuery[limitParam.name] = limitVal;
      } else {
        extractedQuery["limit"] = limitVal;
      }
    }
    let extractedBody = void 0;
    if (bestEndpoint.method === "POST" || bestEndpoint.method === "PUT" || bestEndpoint.method === "PATCH") {
      extractedBody = {};
      const emailMatch = query.match(/(?:email|mail)\s+["']?([a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+)["']?/i);
      if (emailMatch) {
        extractedBody["email"] = emailMatch[1].trim();
      }
      const nameMatch = query.match(/(?:named|name|called)\s+["']?([a-zA-Z0-9_]+)["']?/i);
      if (nameMatch) {
        extractedBody["name"] = nameMatch[1].trim();
      }
      if (Object.keys(extractedBody).length === 0) {
        extractedBody = bestEndpoint.requestBody?.example || { name: "Sample" };
      }
    }
    const fullUrl = `${spec.baseUrl.replace(/\/$/, "")}${bestEndpoint.path}`;
    return {
      endpoint: bestEndpoint,
      method: bestEndpoint.method,
      url: fullUrl,
      query: extractedQuery,
      params: {},
      body: extractedBody,
      explanation: `Mapped "${query}" to ${bestEndpoint.method} ${bestEndpoint.path} based on endpoint tags and parameter schema.`
    };
  }
};

// src/core/benchmark/benchmarker.ts
var Benchmarker = class {
  client;
  constructor(client) {
    this.client = client || new HttpClient();
  }
  async runBenchmark(options) {
    const total = Math.max(1, options.totalRequests);
    const concurrency = Math.max(1, Math.min(options.concurrency, total));
    const latencies = [];
    let successful = 0;
    let failed = 0;
    const startOverall = performance.now();
    let remaining = total;
    const worker = async () => {
      while (remaining > 0) {
        remaining--;
        const reqConfig = {
          url: options.url,
          method: options.method,
          headers: options.headers,
          body: options.body,
          timeoutMs: options.timeoutMs ?? 1e4
        };
        try {
          const resp = await this.client.request(reqConfig);
          latencies.push(resp.timing.total);
          if (resp.status >= 200 && resp.status < 400) {
            successful++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }
    };
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker());
    }
    await Promise.all(workers);
    const totalTimeMs = Math.max(1, performance.now() - startOverall);
    latencies.sort((a, b) => a - b);
    const count = latencies.length || 1;
    const sum = latencies.reduce((acc, v) => acc + v, 0);
    const avgMs = Math.round(sum / count);
    const minMs = latencies[0] || 0;
    const maxMs = latencies[latencies.length - 1] || 0;
    const percentile = (p) => {
      if (latencies.length === 0) return 0;
      const idx = Math.min(latencies.length - 1, Math.floor(p / 100 * latencies.length));
      return latencies[idx];
    };
    const rps = parseFloat((total / totalTimeMs * 1e3).toFixed(2));
    return {
      url: options.url,
      method: options.method,
      totalRequests: total,
      successful,
      failed,
      totalTimeMs: Math.round(totalTimeMs),
      requestsPerSecond: rps,
      avgMs,
      minMs,
      maxMs,
      p50Ms: percentile(50),
      p90Ms: percentile(90),
      p95Ms: percentile(95),
      p99Ms: percentile(99)
    };
  }
};

// src/core/graphql/graphql-client.ts
var GraphQlClient = class {
  client;
  constructor(client) {
    this.client = client || new HttpClient();
  }
  async introspect(endpointUrl, headers) {
    const introspectionQuery = `
      query IntrospectSchema {
        __schema {
          queryType { name }
          mutationType { name }
          types {
            name
            kind
            fields {
              name
              type { name kind ofType { name kind } }
              args { name type { name kind } }
            }
          }
        }
      }
    `;
    const resp = await this.client.request({
      url: endpointUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers || {}
      },
      body: { query: introspectionQuery }
    });
    if (resp.status >= 400 || !resp.data?.data?.__schema) {
      throw new Error(`GraphQL introspection failed (HTTP ${resp.status}): ${resp.rawData.slice(0, 100)}`);
    }
    const schema = resp.data.data.__schema;
    const queryTypeName = schema.queryType?.name || "Query";
    const mutationTypeName = schema.mutationType?.name || "Mutation";
    const queries = [];
    const mutations = [];
    const types = [];
    if (Array.isArray(schema.types)) {
      for (const t of schema.types) {
        if (!t.name || t.name.startsWith("__")) continue;
        types.push(t.name);
        if (t.name === queryTypeName && Array.isArray(t.fields)) {
          for (const f of t.fields) {
            queries.push({
              name: f.name,
              kind: "query",
              args: Array.isArray(f.args) ? f.args.map((a) => ({ name: a.name, type: a.type?.name || "String" })) : [],
              returnType: f.type?.name || f.type?.ofType?.name || "Object"
            });
          }
        }
        if (t.name === mutationTypeName && Array.isArray(t.fields)) {
          for (const f of t.fields) {
            mutations.push({
              name: f.name,
              kind: "mutation",
              args: Array.isArray(f.args) ? f.args.map((a) => ({ name: a.name, type: a.type?.name || "String" })) : [],
              returnType: f.type?.name || f.type?.ofType?.name || "Object"
            });
          }
        }
      }
    }
    return {
      types,
      queries,
      mutations
    };
  }
  async query(endpointUrl, queryStr, variables, headers) {
    return this.client.request({
      url: endpointUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers || {}
      },
      body: {
        query: queryStr,
        variables
      }
    });
  }
};

// src/core/plugins/plugin-manager.ts
import fs7 from "fs/promises";
import os6 from "os";
import path7 from "path";
var PluginManager = class {
  pluginDir;
  plugins = [];
  constructor(customDir) {
    this.pluginDir = customDir || path7.join(os6.homedir(), ".apix", "plugins");
  }
  async init() {
    try {
      await fs7.mkdir(this.pluginDir, { recursive: true });
      this.plugins = [
        {
          id: "rest-openapi",
          name: "OpenAPI REST Discovery Plugin",
          version: "1.0.0",
          description: "Default REST & OpenAPI 3.x/2.0 auto-discovery engine",
          protocol: "rest",
          enabled: true
        },
        {
          id: "graphql-inspector",
          name: "GraphQL Introspection Plugin",
          version: "1.0.0",
          description: "GraphQL schema introspection and query execution",
          protocol: "graphql",
          enabled: true
        },
        {
          id: "code-gen-multi",
          name: "10-Language Code Generator",
          version: "1.0.0",
          description: "Multi-language code generator for cURL, JS, TS, Python, Go, Rust, etc.",
          enabled: true
        }
      ];
    } catch {
      this.plugins = [];
    }
  }
  getPlugins() {
    return [...this.plugins];
  }
  async installPlugin(nameOrUrl) {
    const plugin = {
      id: `plugin-${Date.now()}`,
      name: nameOrUrl,
      version: "1.0.0",
      description: `User-installed plugin from ${nameOrUrl}`,
      enabled: true
    };
    this.plugins.push(plugin);
    return plugin;
  }
};

// src/core/format/apix-format.ts
import YAML2 from "yaml";
import fs8 from "fs/promises";
import path8 from "path";
var ApixFormatParser = class {
  static parseYaml(content) {
    try {
      const parsed = YAML2.parse(content);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid .apix file content: Root must be a YAML object");
      }
      return parsed;
    } catch (e) {
      throw new Error(`Failed to parse .apix YAML format: ${e.message}`);
    }
  }
  static async loadFile(filePath) {
    const resolvedPath = path8.resolve(filePath);
    const content = await fs8.readFile(resolvedPath, "utf-8");
    return this.parseYaml(content);
  }
  static async saveFile(filePath, schema) {
    const resolvedPath = path8.resolve(filePath);
    const yamlStr = YAML2.stringify(schema);
    await fs8.writeFile(resolvedPath, yamlStr, "utf-8");
  }
  static convertToApiSpec(apixData) {
    const endpoints = (apixData.requests || []).map((req, i) => {
      const assertions = (req.tests || []).map((t, idx) => ({
        id: `ast_${idx}`,
        type: t.expect.status ? "status" : "jsonpath",
        expression: t.expect.status ? "status" : t.expect.path || "status",
        operator: t.expect.status ? "equals" : "exists",
        expected: t.expect.status || t.expect.equals
      }));
      return {
        id: req.name.toLowerCase().replace(/[^a-z0-9]/g, "_") || `req_${i}`,
        method: req.method,
        path: req.path,
        summary: req.summary || req.name,
        tags: ["General"],
        parameters: [],
        requestBody: req.body ? { contentType: "application/json", example: req.body } : void 0,
        responses: [
          {
            statusCode: 200,
            description: "OK"
          }
        ],
        source: "DOCUMENTED"
      };
    });
    return {
      title: apixData.name || "APiX Project",
      version: String(apixData.version || "1.0.0"),
      description: apixData.description,
      baseUrl: apixData.baseUrl || "http://localhost:3000",
      servers: [apixData.baseUrl || "http://localhost:3000"],
      endpoints,
      schemas: {}
    };
  }
  static generateSampleApixYaml(name = "gas API") {
    const sample = {
      version: 1,
      name,
      description: "Executable APiX project format specification",
      baseUrl: "{{baseUrl}}",
      environments: {
        development: {
          baseUrl: "http://localhost:4000",
          variables: {
            baseUrl: "http://localhost:4000"
          }
        },
        production: {
          baseUrl: "https://api.example.com",
          isProduction: true,
          variables: {
            baseUrl: "https://api.example.com"
          }
        }
      },
      auth: {
        type: "bearer",
        token: "{{API_TOKEN}}"
      },
      requests: [
        {
          name: "List Users",
          method: "GET",
          path: "/users",
          summary: "Retrieve all users",
          query: { limit: 10, page: 1 },
          tests: [
            {
              expect: {
                status: 200
              }
            }
          ]
        },
        {
          name: "Get User By ID",
          method: "GET",
          path: "/users/{id}",
          summary: "Retrieve user by ID"
        },
        {
          name: "Create User",
          method: "POST",
          path: "/users",
          summary: "Create a new user",
          body: {
            name: "{{name}}",
            email: "{{email}}"
          },
          tests: [
            {
              expect: {
                status: 201
              }
            }
          ]
        }
      ],
      workflows: [
        {
          name: "User Onboarding Flow",
          description: "Authenticate and fetch user details",
          steps: [
            {
              request: "Create User",
              save: {
                userId: "response.id"
              }
            },
            {
              request: "Get User By ID",
              variables: {
                id: "{{userId}}"
              }
            }
          ]
        }
      ]
    };
    return YAML2.stringify(sample);
  }
};

// src/cli/index.ts
function createCli() {
  const program = new Command();
  program.name("apix").description("APiX: Universal terminal-native API exploration, testing, and automation platform").version("1.0.0");
  program.argument("[target]", "Target API URL or .apix file to open").action(async (targetArg) => {
    if (targetArg && targetArg.endsWith(".apix")) {
      const apixData = await ApixFormatParser.loadFile(targetArg);
      const spec = ApixFormatParser.convertToApiSpec(apixData);
      console.log(chalk.green(`\u2713 Opened .apix project: ${spec.title} (${spec.endpoints.length} requests)`));
      render(React12.createElement(App, { initialUrl: spec.baseUrl }));
    } else if (targetArg && (targetArg.startsWith("http://") || targetArg.startsWith("https://"))) {
      render(React12.createElement(App, { initialUrl: targetArg }));
    } else {
      render(React12.createElement(App, {}));
    }
  });
  program.command("open <file>").description("Open an executable .apix project file").action(async (file) => {
    const apixData = await ApixFormatParser.loadFile(file);
    const spec = ApixFormatParser.convertToApiSpec(apixData);
    console.log(chalk.green(`\u2713 Loaded .apix file: ${spec.title}`));
    render(React12.createElement(App, { initialUrl: spec.baseUrl }));
  });
  program.command("init [file]").description("Initialize a human-readable .apix YAML project file (e.g. api.apix)").action(async (file = "api.apix") => {
    const target = file.endsWith(".apix") ? file : `${file}.apix`;
    const yamlStr = ApixFormatParser.generateSampleApixYaml(file.replace(".apix", ""));
    await ApixFormatParser.saveFile(target, YAML3.parse(yamlStr));
    console.log(boxen(
      `${chalk.green("\u2713 CREATED .apix PROJECT FILE")}

File: ${chalk.bold(target)}

Commit this file to Git for version-controlled API requests, tests, and workflows.`,
      { padding: 1, borderColor: "green" }
    ));
  });
  program.command("benchmark <endpoint>").description("Run load benchmarking against an endpoint (measures RPS, P50, P95, P99 latencies)").option("-X, --method <method>", "HTTP method", "GET").option("-n, --requests <number>", "Total number of requests", "100").option("-c, --concurrency <number>", "Concurrency level", "5").option("--force", "Bypass production safety warning").action(async (endpoint, options) => {
    const envManager = new EnvManager();
    await envManager.init();
    const activeEnv = envManager.getActiveEnvironment();
    const method = options.method.toUpperCase();
    const fullUrl = endpoint.startsWith("http") ? endpoint : `${activeEnv.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    if (isProductionUrl(fullUrl) && !options.force) {
      const confirm = await promptCliConfirmation(
        chalk.red(`\u26A0 WARNING: About to run load benchmark against PRODUCTION [${fullUrl}]. Continue?`)
      );
      if (!confirm) {
        console.log(chalk.yellow("Benchmark canceled."));
        process.exit(0);
      }
    }
    const totalRequests = parseInt(options.requests, 10) || 100;
    const concurrency = parseInt(options.concurrency, 10) || 5;
    console.log(chalk.cyan(`Running load benchmark: ${totalRequests} requests against ${method} ${fullUrl} (concurrency: ${concurrency})...
`));
    const benchmarker = new Benchmarker();
    const res = await benchmarker.runBenchmark({
      url: fullUrl,
      method,
      totalRequests,
      concurrency
    });
    console.log(boxen(
      `${chalk.bold("BENCHMARK RESULTS")}

Target:       ${chalk.bold(res.url)}
Requests:     ${res.totalRequests} total (${chalk.green(`${res.successful} successful`)}, ${res.failed > 0 ? chalk.red(`${res.failed} failed`) : "0 failed"})
Total Duration: ${res.totalTimeMs}ms
Throughput:   ${chalk.green(`${res.requestsPerSecond} req/sec`)}

Latency Distribution:
  Average:    ${res.avgMs}ms
  Min:        ${res.minMs}ms
  P50:        ${chalk.cyan(`${res.p50Ms}ms`)}
  P90:        ${res.p90Ms}ms
  P95:        ${chalk.yellow(`${res.p95Ms}ms`)}
  P99:        ${chalk.red(`${res.p99Ms}ms`)}
  Max:        ${res.maxMs}ms`,
      { padding: 1, borderColor: "cyan", borderStyle: "round" }
    ));
  });
  program.command("graphql <url>").description("Introspect and query a GraphQL API endpoint").option("-q, --query <query>", "GraphQL query string").action(async (urlStr, options) => {
    const gqlClient = new GraphQlClient();
    if (options.query) {
      console.log(chalk.cyan(`Executing GraphQL Query against ${urlStr}...`));
      const resp = await gqlClient.query(urlStr, options.query);
      console.log(`
Status: ${resp.status} ${resp.statusText}
`);
      console.log(JSON.stringify(resp.data, null, 2));
    } else {
      console.log(chalk.cyan(`Introspecting GraphQL schema at ${urlStr}...`));
      try {
        const info = await gqlClient.introspect(urlStr);
        console.log(boxen(
          `${chalk.bold("GRAPHQL SCHEMA INTROSPECTION")}

Queries:   ${info.queries.length}
Mutations: ${info.mutations.length}
Types:     ${info.types.length}`,
          { padding: 1, borderColor: "magenta" }
        ));
        if (info.queries.length > 0) {
          console.log(chalk.bold("\nQueries:\n"));
          for (const q of info.queries) {
            console.log(`  \u2022 ${chalk.cyan(q.name)} (${q.args.map((a) => `${a.name}: ${a.type}`).join(", ")}): ${q.returnType}`);
          }
        }
      } catch (e) {
        console.error(chalk.red(`GraphQL Introspection error: ${e.message}`));
      }
    }
  });
  program.command("plugin [cmd] [name]").description("Manage APiX plugins (list, install)").action(async (cmd = "list", name) => {
    const pluginManager = new PluginManager();
    await pluginManager.init();
    if (cmd === "list") {
      const plugins = pluginManager.getPlugins();
      console.log(chalk.bold("\nInstalled APiX Plugins:\n"));
      for (const p of plugins) {
        console.log(`  \u276F ${chalk.cyan(p.name.padEnd(30))} (v${p.version}) - ${chalk.gray(p.description)}`);
      }
      console.log("");
    } else if (cmd === "install" && name) {
      const p = await pluginManager.installPlugin(name);
      console.log(chalk.green(`\u2713 Installed plugin "${p.name}"`));
    }
  });
  program.command("explain [url]").description("Analyze connected API and output intelligence report (resources, schemas, health, potential issues)").action(async (urlArg) => {
    const envManager = new EnvManager();
    await envManager.init();
    const targetUrl = urlArg || envManager.getActiveEnvironment().baseUrl;
    const discovery = new OpenApiDiscovery();
    const openApiResult = await discovery.discover(targetUrl);
    let targetSpec = openApiResult?.spec || null;
    if (!targetSpec) {
      const prober = new SafeProber();
      const probeResult = await prober.probe(targetUrl);
      if (probeResult.isReachable) {
        targetSpec = prober.createInferredSpec(probeResult);
      }
    }
    if (!targetSpec) {
      console.log(chalk.yellow(`Could not connect to target API at ${targetUrl}. Is the server running?`));
      return;
    }
    const report = await ApiExplainer.explain(targetSpec);
    console.log(boxen(
      `${chalk.bold("API ANALYSIS REPORT")}
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

Name:           ${chalk.bold(report.name)}
Version:        ${report.version}
Protocol:       ${report.protocol}
Documentation:  ${report.docFormat}
Endpoints:      ${report.endpointCount}
Schemas:        ${report.schemaCount}
Authentication: ${report.authType}
Health:         ${report.healthStatus}`,
      { padding: 1, borderColor: "cyan", borderStyle: "round" }
    ));
    console.log(chalk.bold("\nResources:\n"));
    for (const [tag, items] of Object.entries(report.resources)) {
      console.log(chalk.cyan(`  ${tag}`));
      for (const item of items) {
        console.log(`   \u251C\u2500\u2500 ${chalk.bold(item.method.padEnd(6))} ${item.path}`);
      }
      console.log("");
    }
    if (report.potentialIssues.length > 0) {
      console.log(chalk.bold("Potential Issues:\n"));
      for (const issue of report.potentialIssues) {
        console.log(`  ${issue}`);
      }
    }
  });
  ["GET", "POST", "PUT", "DELETE", "PATCH"].forEach((method) => {
    program.command(`${method} <url>`).description(`Directly execute HTTP ${method} request against target URL`).option("-d, --data <data>", "JSON payload body").option("-H, --header <header...>", 'Headers (e.g. -H "Authorization: Bearer ...")').action(async (urlStr, options) => {
      const authManager = new AuthManager();
      await authManager.init();
      const headers = {};
      if (options.header) {
        for (const h of options.header) {
          const idx = h.indexOf(":");
          if (idx > 0) headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
        }
      }
      let parsedBody = void 0;
      if (options.data) {
        try {
          parsedBody = JSON.parse(options.data);
        } catch {
          parsedBody = options.data;
        }
      }
      let reqConfig = {
        url: urlStr,
        method,
        headers,
        body: parsedBody
      };
      reqConfig = authManager.applyAuth(reqConfig);
      const client = new HttpClient();
      console.log(chalk.cyan(`Executing ${method} ${urlStr}...`));
      try {
        const resp = await client.request(reqConfig);
        console.log(`
Status: ${resp.status} ${resp.statusText} (${resp.timing.total}ms)
`);
        console.log(typeof resp.data === "object" ? JSON.stringify(resp.data, null, 2) : resp.rawData);
      } catch (e) {
        console.error(chalk.red(`Request failed: ${e.message}`));
        process.exit(1);
      }
    });
  });
  program.command("connect <url>").description("Connect to an API and launch the interactive explorer").option("--openapi <location>", "Explicit OpenAPI spec URL or file path").option("--insecure", "Allow insecure TLS / self-signed certificates").action(async (url, options) => {
    render(React12.createElement(App, { initialUrl: url }));
  });
  program.command("ping [url]").description("Test connectivity and latency to an API without modifying state").option("--insecure", "Allow insecure TLS").action(async (urlArg, options) => {
    const envManager = new EnvManager();
    await envManager.init();
    const targetUrl = urlArg || envManager.getActiveEnvironment().baseUrl;
    console.log(chalk.cyan(`Pinging ${targetUrl}...`));
    const client = new HttpClient();
    try {
      const resp = await client.request({
        url: targetUrl,
        method: "GET",
        allowInsecure: options?.insecure,
        timeoutMs: 5e3
      });
      console.log(
        boxen(
          `${chalk.green("\u2713 REACHABLE")}

Target:       ${chalk.bold(targetUrl)}
Status:       ${chalk.green(`${resp.status} ${resp.statusText}`)}
Total Time:   ${chalk.bold(`${resp.timing.total}ms`)}
DNS:          ${resp.timing.dns}ms
TCP:          ${resp.timing.tcp}ms
TLS:          ${resp.timing.tls}ms
Server TTFB:  ${resp.timing.ttfb}ms
Server:       ${resp.headers["server"] || "Unknown"}`,
          { padding: 1, borderColor: "green", borderStyle: "round" }
        )
      );
    } catch (err) {
      console.error(
        boxen(
          `${chalk.red("\u2717 UNREACHABLE")}

Target:  ${chalk.bold(targetUrl)}
Reason:  ${err.message}
Code:    ${err.code || "UNKNOWN"}`,
          { padding: 1, borderColor: "red", borderStyle: "round" }
        )
      );
      process.exit(1);
    }
  });
  program.command("ask <query>").description('Construct an API request using natural language (e.g., "get the first 10 bookings")').option("--url <url>", "Target API URL").option("--force", "Execute request without interactive confirmation").action(async (query, options) => {
    const envManager = new EnvManager();
    const authManager = new AuthManager();
    await envManager.init();
    await authManager.init();
    const targetUrl = options.url || envManager.getActiveEnvironment().baseUrl;
    const discovery = new OpenApiDiscovery();
    const openApiResult = await discovery.discover(targetUrl);
    let targetSpec = openApiResult?.spec || null;
    if (!targetSpec) {
      const prober = new SafeProber();
      const probeResult = await prober.probe(targetUrl);
      if (probeResult.isReachable) {
        targetSpec = prober.createInferredSpec(probeResult);
      }
    }
    if (!targetSpec) {
      console.log(chalk.yellow(`Could not connect to target API at ${targetUrl}.`));
      return;
    }
    const proposal = NlRequestBuilder.proposeRequest(query, targetSpec);
    if (!proposal) {
      console.log(chalk.red(`Could not map query "${query}" to an endpoint.`));
      return;
    }
    console.log(boxen(
      `${chalk.bold("APiX Natural Language Proposal")}

Query:       "${chalk.yellow(query)}"
Method:      ${chalk.bold(proposal.method)}
URL:         ${chalk.cyan(proposal.url)}
Query Params: ${JSON.stringify(proposal.query)}
Body:        ${proposal.body ? JSON.stringify(proposal.body) : "None"}

${chalk.gray(proposal.explanation)}`,
      { padding: 1, borderColor: "cyan" }
    ));
    let confirm = options.force;
    if (!confirm) {
      confirm = await promptCliConfirmation(chalk.bold("Execute this request?"));
    }
    if (confirm) {
      const client = new HttpClient();
      let reqConfig = {
        url: proposal.url,
        method: proposal.method,
        query: proposal.query,
        body: proposal.body
      };
      reqConfig = authManager.applyAuth(reqConfig);
      const resp = await client.request(reqConfig);
      console.log(`
Status: ${resp.status} ${resp.statusText} (${resp.timing.total}ms)
`);
      console.log(typeof resp.data === "object" ? JSON.stringify(resp.data, null, 2) : resp.rawData);
    } else {
      console.log(chalk.yellow("Request canceled."));
    }
  });
  program.command("endpoints [url]").description("List all discovered endpoints for the active or specified API").option("--openapi <path>", "Path to local or remote OpenAPI spec").action(async (urlArg, options) => {
    const envManager = new EnvManager();
    await envManager.init();
    const targetUrl = urlArg || envManager.getActiveEnvironment().baseUrl;
    const discovery = new OpenApiDiscovery();
    const openApiResult = await discovery.discover(targetUrl, options?.openapi);
    let targetSpec = openApiResult?.spec || null;
    if (!targetSpec) {
      const prober = new SafeProber();
      const probeResult = await prober.probe(targetUrl);
      if (probeResult.isReachable) {
        targetSpec = prober.createInferredSpec(probeResult);
      }
    }
    if (!targetSpec) {
      console.log(chalk.yellow(`Could not connect to target API at ${targetUrl}.`));
      return;
    }
    console.log(chalk.bold(`
${targetSpec.title} (${targetSpec.version}) - ${targetSpec.endpoints.length} Endpoints
`));
    const table = new Table({
      head: [chalk.cyan("Method"), chalk.cyan("Path"), chalk.cyan("Tag"), chalk.cyan("Summary")],
      colWidths: [10, 35, 15, 40]
    });
    for (const ep of result.spec.endpoints) {
      const color = ep.method === "GET" ? chalk.green : ep.method === "POST" ? chalk.blue : ep.method === "DELETE" ? chalk.red : chalk.yellow;
      table.push([color(ep.method), ep.path, ep.tags[0] || "General", (ep.summary || "").slice(0, 35)]);
    }
    console.log(table.toString());
  });
  program.command("search <query>").description("Search endpoints, parameters, and schemas").option("--url <url>", "Target API URL").action(async (query, options) => {
    const envManager = new EnvManager();
    await envManager.init();
    const targetUrl = options?.url || envManager.getActiveEnvironment().baseUrl;
    const discovery = new OpenApiDiscovery();
    const result2 = await discovery.discover(targetUrl);
    if (!result2) {
      console.log(chalk.yellow("No active API spec found to search."));
      return;
    }
    const q = query.toLowerCase();
    const matches = result2.spec.endpoints.filter(
      (e) => e.path.toLowerCase().includes(q) || e.method.toLowerCase().includes(q) || e.summary && e.summary.toLowerCase().includes(q) || e.parameters.some((p) => p.name.toLowerCase().includes(q))
    );
    console.log(chalk.cyan(`Found ${matches.length} matches for "${query}":
`));
    for (const m of matches) {
      console.log(`  ${chalk.bold(m.method.padEnd(7))} ${chalk.white(m.path)} - ${chalk.gray(m.summary || "")}`);
    }
  });
  program.command("run <endpoint>").description("Execute an API endpoint from the command line").option("-X, --method <method>", "HTTP method", "GET").option("-d, --data <data>", "JSON request body").option("-H, --header <header...>", 'Custom headers (e.g. -H "Authorization: Bearer ...")').option("--force", "Bypass production safety confirmation").action(async (endpoint, options) => {
    const envManager = new EnvManager();
    const authManager = new AuthManager();
    const historyManager = new HistoryManager();
    await envManager.init();
    await authManager.init();
    await historyManager.init();
    const activeEnv = envManager.getActiveEnvironment();
    const method = options.method.toUpperCase();
    const fullUrl = endpoint.startsWith("http") ? endpoint : `${activeEnv.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const isProd = activeEnv.isProduction || isProductionUrl(fullUrl);
    if (isDangerousMethod(method) && isProd && !options.force) {
      const confirmed = await promptCliConfirmation(
        chalk.red(`\u26A0 WARNING: About to execute destructive ${method} against PRODUCTION [${fullUrl}]. Continue?`)
      );
      if (!confirmed) {
        console.log(chalk.yellow("Operation canceled by user."));
        process.exit(0);
      }
    }
    const headers = {};
    if (options.header) {
      for (const h of options.header) {
        const idx = h.indexOf(":");
        if (idx > 0) {
          headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
        }
      }
    }
    let parsedBody = void 0;
    if (options.data) {
      try {
        parsedBody = JSON.parse(options.data);
      } catch {
        parsedBody = options.data;
      }
    }
    let reqConfig = {
      url: fullUrl,
      method,
      headers,
      body: parsedBody
    };
    reqConfig = authManager.applyAuth(reqConfig);
    console.log(chalk.cyan(`Executing ${method} ${fullUrl}...`));
    const client = new HttpClient();
    try {
      const resp = await client.request(reqConfig);
      await historyManager.record(reqConfig, resp, activeEnv.name);
      const statusColor = resp.status >= 200 && resp.status < 300 ? chalk.green : chalk.red;
      console.log(`
Status: ${statusColor(`${resp.status} ${resp.statusText}`)}  Time: ${chalk.bold(`${resp.timing.total}ms`)}  Size: ${(resp.sizeBytes / 1024).toFixed(2)} KB
`);
      if (resp.isJson && typeof resp.data === "object") {
        console.log(JSON.stringify(resp.data, null, 2));
      } else {
        console.log(resp.rawData);
      }
    } catch (err) {
      console.error(chalk.red(`
Request failed: ${err.message}`));
      process.exit(1);
    }
  });
  program.command("test [target]").description("Run automated contract tests & assertions (supports CI/CD exit code 1 on failure)").option("--ci", "Run in strict CI/CD mode (fails process if any test fails)").action(async (target, options) => {
    console.log(chalk.cyan("Running APiX Contract & Endpoint Tests...\n"));
    const envManager = new EnvManager();
    await envManager.init();
    const targetUrl = target || envManager.getActiveEnvironment().baseUrl;
    const discovery = new OpenApiDiscovery();
    const result2 = await discovery.discover(targetUrl);
    if (!result2) {
      console.log(chalk.yellow(`No OpenAPI spec available at ${targetUrl} for contract testing.`));
      if (options?.ci) process.exit(1);
      return;
    }
    const client = new HttpClient();
    let passed = 0;
    let failed = 0;
    for (const ep of result2.spec.endpoints.slice(0, 5)) {
      if (ep.method === "GET" && !ep.parameters.some((p) => p.required)) {
        try {
          const resp = await client.request({
            url: `${result2.spec.baseUrl}${ep.path}`,
            method: "GET",
            timeoutMs: 5e3
          });
          const statusMatch = resp.status < 400;
          if (statusMatch) {
            console.log(`${chalk.green("\u2713")} ${ep.method.padEnd(6)} ${ep.path.padEnd(25)} ${chalk.green(resp.status)} (${resp.timing.total}ms)`);
            passed++;
          } else {
            console.log(`${chalk.red("\u2717")} ${ep.method.padEnd(6)} ${ep.path.padEnd(25)} ${chalk.red(resp.status)} (${resp.timing.total}ms)`);
            failed++;
          }
        } catch (e) {
          console.log(`${chalk.red("\u2717")} ${ep.method.padEnd(6)} ${ep.path.padEnd(25)} Error: ${e.message}`);
          failed++;
        }
      }
    }
    console.log(`
Results: ${chalk.green(`${passed} passed`)}, ${failed > 0 ? chalk.red(`${failed} failed`) : "0 failed"}`);
    if (failed > 0 && options?.ci) {
      console.error(chalk.red("\nCI Test Run Failed. Exiting with code 1."));
      process.exit(1);
    }
  });
  program.command("diff <spec1> <spec2>").description("Compare two OpenAPI specifications to detect breaking changes and schema diffs").action(async (spec1Path, spec2Path) => {
    const discovery = new OpenApiDiscovery();
    const specA = await discovery.importFromFile(spec1Path);
    const specB = await discovery.importFromFile(spec2Path);
    const diff = ApiDiffer.diff(specA, specB);
    console.log(boxen(chalk.bold("API SPECIFICATION DIFF"), { padding: 1, borderColor: "cyan" }));
    if (diff.addedEndpoints.length > 0) {
      console.log(chalk.green("\n+ ADDED ENDPOINTS:"));
      for (const ep of diff.addedEndpoints) {
        console.log(chalk.green(`  + ${ep.method} ${ep.path} ${ep.summary ? `(${ep.summary})` : ""}`));
      }
    }
    if (diff.removedEndpoints.length > 0) {
      console.log(chalk.red("\n- REMOVED ENDPOINTS:"));
      for (const ep of diff.removedEndpoints) {
        console.log(chalk.red(`  - ${ep.method} ${ep.path} ${ep.summary ? `(${ep.summary})` : ""}`));
      }
    }
    if (diff.modifiedEndpoints.length > 0) {
      console.log(chalk.yellow("\n~ MODIFIED ENDPOINTS:"));
      for (const ep of diff.modifiedEndpoints) {
        console.log(chalk.yellow(`  ~ ${ep.method} ${ep.path} ${ep.breaking ? chalk.red("[BREAKING]") : ""}`));
        for (const c of ep.changes) {
          console.log(chalk.gray(`      \u2022 ${c}`));
        }
      }
    }
    if (diff.addedEndpoints.length === 0 && diff.removedEndpoints.length === 0 && diff.modifiedEndpoints.length === 0) {
      console.log(chalk.green("\nNo endpoint changes detected between specifications."));
    }
  });
  program.command("docs [action] [spec]").description("Generate documentation from an API spec (markdown, html, json)").option("-f, --format <format>", "Output format: markdown, html, json", "markdown").action(async (action = "generate", specPath, options) => {
    const discovery = new OpenApiDiscovery();
    const envManager = new EnvManager();
    await envManager.init();
    const targetUrl = specPath || envManager.getActiveEnvironment().baseUrl;
    let spec;
    if (specPath && (specPath.endsWith(".json") || specPath.endsWith(".yaml") || specPath.endsWith(".yml"))) {
      spec = await discovery.importFromFile(specPath);
    } else {
      const res = await discovery.discover(targetUrl);
      spec = res?.spec;
    }
    if (!spec) {
      console.log(chalk.red("Could not locate an API specification to document."));
      return;
    }
    if (options?.format === "html") {
      console.log(DocsGenerator.generateHtml(spec));
    } else if (options?.format === "json") {
      console.log(JSON.stringify(spec, null, 2));
    } else {
      console.log(DocsGenerator.generateMarkdown(spec));
    }
  });
  program.command("generate <lang> <endpoint>").description("Generate code snippet for an endpoint (curl, javascript, typescript, python, go, java, php, dart, csharp, rust)").option("-X, --method <method>", "HTTP method", "GET").action((lang, endpoint, options) => {
    const code = CodeGenerator.generate(lang, {
      url: endpoint.startsWith("http") ? endpoint : `http://localhost:3000${endpoint}`,
      method: options.method.toUpperCase()
    });
    console.log(code);
  });
  program.command("env [cmd] [name]").description("Manage environments (list, use, create)").action(async (cmd, name) => {
    const envManager = new EnvManager();
    await envManager.init();
    if (!cmd || cmd === "list") {
      const envs = envManager.getEnvironments();
      const active = envManager.getActiveEnvironment();
      console.log(chalk.bold("\nEnvironments:\n"));
      for (const e of envs) {
        const isActive = e.name === active.name;
        const mark = isActive ? chalk.green("\u25CF ") : "  ";
        const nameColored = e.isProduction ? chalk.red(e.name) : chalk.white(e.name);
        console.log(`${mark}${nameColored.padEnd(20)} ${e.baseUrl} ${isActive ? chalk.green("[ACTIVE]") : ""}`);
      }
      console.log("");
    } else if (cmd === "use" && name) {
      try {
        const activated = envManager.setActiveEnvironment(name);
        await envManager.save();
        console.log(chalk.green(`\u2713 Switched active environment to [${activated.name}]`));
      } catch (e) {
        console.log(chalk.red(e.message));
      }
    }
  });
  program.command("history [cmd] [id]").description("View and replay past executed requests (list, show, replay, clear)").action(async (cmd = "list", id) => {
    const historyManager = new HistoryManager();
    await historyManager.init();
    if (cmd === "list") {
      const items = historyManager.getItems(20);
      console.log(chalk.bold(`
Recent Request History (${items.length} items):
`));
      for (const it of items) {
        const time = new Date(it.timestamp).toLocaleTimeString();
        const statusColor = it.status >= 200 && it.status < 300 ? chalk.green : chalk.red;
        console.log(`  ${it.id.padEnd(20)} ${time}  ${it.method.padEnd(6)} ${it.path.padEnd(30)} ${statusColor(it.status)} (${it.durationMs}ms)`);
      }
      console.log("");
    } else if (cmd === "clear") {
      await historyManager.clear();
      console.log(chalk.green("\u2713 History cleared."));
    }
  });
  program.command("analyze [target]").description("Analyze OpenAPI spec completeness and quality score").action(async (target) => {
    const envManager = new EnvManager();
    await envManager.init();
    const targetUrl = target || envManager.getActiveEnvironment().baseUrl;
    const discovery = new OpenApiDiscovery();
    const openApiResult = await discovery.discover(targetUrl);
    let targetSpec = openApiResult?.spec || null;
    if (!targetSpec) {
      const prober = new SafeProber();
      const probeResult = await prober.probe(targetUrl);
      if (probeResult.isReachable) {
        targetSpec = prober.createInferredSpec(probeResult);
      }
    }
    if (!targetSpec) {
      console.log(chalk.yellow(`Could not connect to target API at ${targetUrl}.`));
      return;
    }
    const report = QualityAnalyzer.analyze(targetSpec);
    console.log(boxen(
      `${chalk.bold("API QUALITY SCORE")}: ${report.score >= 80 ? chalk.green(`${report.score}/100`) : chalk.yellow(`${report.score}/100`)}

Documentation Coverage:   ${report.documentationCoverage}%
Schema Coverage:          ${report.schemaCoverage}%
Error Definitions:        ${report.errorDefinitionCoverage}%
Example Coverage:         ${report.exampleCoverage}%
Total Endpoints:          ${report.totalEndpoints}`,
      { padding: 1, borderColor: "cyan" }
    ));
    if (report.warnings.length > 0) {
      console.log(chalk.yellow("\nWarnings:"));
      for (const w of report.warnings) {
        console.log(`  \u26A0 ${w}`);
      }
    }
    if (report.suggestions.length > 0) {
      console.log(chalk.cyan("\nSuggestions:"));
      for (const s of report.suggestions) {
        console.log(`  \u2022 ${s}`);
      }
    }
  });
  program.command("mock <spec>").description("Run a local mock server from an OpenAPI specification").option("-p, --port <port>", "Port number", "5050").action(async (specPath, options) => {
    const discovery = new OpenApiDiscovery();
    const spec = await discovery.importFromFile(specPath);
    const port = parseInt(options.port, 10) || 5050;
    const mock = new MockServer(spec, port);
    const url = await mock.start();
    console.log(boxen(
      `${chalk.green("\u2713 MOCK API SERVER RUNNING")}

URL:       ${chalk.bold(url)}
Endpoints: ${spec.endpoints.length}
Title:     ${spec.title}

Press Ctrl+C to stop.`,
      { padding: 1, borderColor: "green" }
    ));
  });
  program.command("config [action] [key] [value]").description("View or update user configuration (get, set, list)").action(async (action = "list", key, value) => {
    const configManager = new ConfigManager();
    await configManager.init();
    if (action === "list") {
      console.log(JSON.stringify(configManager.getAll(), null, 2));
    } else if (action === "get" && key) {
      console.log(configManager.get(key));
    } else if (action === "set" && key && value !== void 0) {
      await configManager.set(key, value);
      console.log(chalk.green(`\u2713 Set config ${key} = ${value}`));
    }
  });
  return program;
}

export {
  createCli
};
//# sourceMappingURL=chunk-PJECUFEJ.js.map