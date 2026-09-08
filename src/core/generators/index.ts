import type { HttpRequestConfig } from '../../types/index.js';

export type SupportedLanguage =
  | 'curl'
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'go'
  | 'java'
  | 'php'
  | 'dart'
  | 'csharp'
  | 'rust';

export class CodeGenerator {
  public static generate(lang: SupportedLanguage, config: HttpRequestConfig): string {
    const fullUrl = this.buildFullUrl(config);

    switch (lang.toLowerCase() as SupportedLanguage) {
      case 'curl':
        return this.generateCurl(config, fullUrl);
      case 'javascript':
        return this.generateJavaScript(config, fullUrl);
      case 'typescript':
        return this.generateTypeScript(config, fullUrl);
      case 'python':
        return this.generatePython(config, fullUrl);
      case 'go':
        return this.generateGo(config, fullUrl);
      case 'java':
        return this.generateJava(config, fullUrl);
      case 'php':
        return this.generatePhp(config, fullUrl);
      case 'dart':
        return this.generateDart(config, fullUrl);
      case 'csharp':
        return this.generateCSharp(config, fullUrl);
      case 'rust':
        return this.generateRust(config, fullUrl);
      default:
        return this.generateCurl(config, fullUrl);
    }
  }

  private static buildFullUrl(config: HttpRequestConfig): string {
    try {
      const url = new URL(config.url);
      if (config.query) {
        for (const [k, v] of Object.entries(config.query)) {
          if (v !== undefined && v !== null) {
            url.searchParams.set(k, String(v));
          }
        }
      }
      return url.toString();
    } catch {
      return config.url;
    }
  }

  private static generateCurl(config: HttpRequestConfig, fullUrl: string): string {
    const parts: string[] = ['curl'];
    if (config.method !== 'GET') {
      parts.push(`-X ${config.method}`);
    }
    parts.push(`"${fullUrl}"`);

    if (config.headers) {
      for (const [k, v] of Object.entries(config.headers)) {
        parts.push(`-H "${k}: ${v}"`);
      }
    }

    if (config.body && config.method !== 'GET') {
      const bodyStr = typeof config.body === 'object' ? JSON.stringify(config.body) : String(config.body);
      const escaped = bodyStr.replace(/"/g, '\\"');
      parts.push(`-d "${escaped}"`);
    }

    return parts.join(' \\\n  ');
  }

  private static generateJavaScript(config: HttpRequestConfig, fullUrl: string): string {
    const hasBody = config.body && config.method !== 'GET';
    const bodyStr = hasBody
      ? typeof config.body === 'object'
        ? JSON.stringify(config.body, null, 2)
        : JSON.stringify(config.body)
      : '';

    return `const url = "${fullUrl}";
const options = {
  method: "${config.method}",
  headers: ${JSON.stringify(config.headers || {}, null, 2)}${
    hasBody
      ? `,\n  body: JSON.stringify(${bodyStr.split('\n').join('\n  ')})`
      : ''
  }
};

try {
  const response = await fetch(url, options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error("Request failed:", error);
}`;
  }

  private static generateTypeScript(config: HttpRequestConfig, fullUrl: string): string {
    const hasBody = config.body && config.method !== 'GET';
    const bodyStr = hasBody
      ? typeof config.body === 'object'
        ? JSON.stringify(config.body, null, 2)
        : JSON.stringify(config.body)
      : '';

    return `interface ApiResponse<T = any> {
  data: T;
  status: number;
}

async function executeRequest<T = any>(): Promise<T> {
  const url = "${fullUrl}";
  const response = await fetch(url, {
    method: "${config.method}",
    headers: ${JSON.stringify(config.headers || {}, null, 4)}${
      hasBody
        ? `,\n    body: JSON.stringify(${bodyStr.split('\n').join('\n    ')})`
        : ''
    }
  });

  if (!response.ok) {
    throw new Error(\`HTTP error! status: \${response.status}\`);
  }

  return response.json() as Promise<T>;
}

executeRequest().then(console.log).catch(console.error);`;
  }

  private static generatePython(config: HttpRequestConfig, fullUrl: string): string {
    const hasBody = config.body && config.method !== 'GET';
    const bodyJson = hasBody ? JSON.stringify(config.body, null, 4) : '';

    return `import requests

url = "${fullUrl}"
headers = ${JSON.stringify(config.headers || {}, null, 4)}
${hasBody ? `payload = ${bodyJson}\n` : ''}
response = requests.request(
    method="${config.method}",
    url=url,
    headers=headers,
    ${hasBody ? 'json=payload,' : ''}
    timeout=30
)

print(f"Status: {response.status_code}")
print(response.json() if "application/json" in response.headers.get("content-type", "") else response.text)`;
  }

  private static generateGo(config: HttpRequestConfig, fullUrl: string): string {
    const hasBody = config.body && config.method !== 'GET';
    const bodyJson = hasBody ? JSON.stringify(config.body) : '';

    return `package main

import (
\t"bytes"
\t"fmt"
\t"io"
\t"net/http"
)

func main() {
\turl := "${fullUrl}"
\t${hasBody ? `var body = bytes.NewBuffer([]byte(\`${bodyJson}\`))` : `var body io.Reader = nil`}

\treq, err := http.NewRequest("${config.method}", url, body)
\tif err != nil {
\t\tpanic(err)
\t}

${Object.entries(config.headers || {})
  .map(([k, v]) => `\treq.Header.Set("${k}", "${v}")`)
  .join('\n')}

\tclient := &http.Client{}
\tresp, err := client.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer resp.Body.Close()

\trespBody, _ := io.ReadAll(resp.Body)
\tfmt.Println("Status:", resp.Status)
\tfmt.Println("Response:", string(respBody))
}`;
  }

  private static generateJava(config: HttpRequestConfig, fullUrl: string): string {
    const hasBody = config.body && config.method !== 'GET';
    const bodyJson = hasBody ? JSON.stringify(config.body) : '';

    return `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

public class ApiRequest {
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();

        HttpRequest.Builder builder = HttpRequest.newBuilder()
            .uri(URI.create("${fullUrl}"))
            .method("${config.method}", ${hasBody ? `HttpRequest.BodyPublishers.ofString("${bodyJson.replace(/"/g, '\\"')}")` : 'HttpRequest.BodyPublishers.noBody()'});

${Object.entries(config.headers || {})
  .map(([k, v]) => `        builder.header("${k}", "${v}");`)
  .join('\n')}

        HttpRequest request = builder.build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        System.out.println("Status: " + response.statusCode());
        System.out.println("Body: " + response.body());
    }
}`;
  }

  private static generatePhp(config: HttpRequestConfig, fullUrl: string): string {
    const hasBody = config.body && config.method !== 'GET';
    const bodyJson = hasBody ? JSON.stringify(config.body) : '';

    return `<?php

$curl = curl_init();

$headers = [
${Object.entries(config.headers || {})
  .map(([k, v]) => `    "${k}: ${v}",`)
  .join('\n')}
];

curl_setopt_array($curl, [
    CURLOPT_URL => "${fullUrl}",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => "${config.method}",
    CURLOPT_HTTPHEADER => $headers,
${hasBody ? `    CURLOPT_POSTFIELDS => '${bodyJson}',\n` : ''}]);

$response = curl_exec($curl);
$httpCode = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

echo "Status: $httpCode\\n";
echo "Response: $response\\n";
`;
  }

  private static generateDart(config: HttpRequestConfig, fullUrl: string): string {
    const hasBody = config.body && config.method !== 'GET';
    const bodyJson = hasBody ? JSON.stringify(config.body) : '';

    return `import 'dart:convert';
import 'package:http/http.dart' as http;

void main() async {
  final url = Uri.parse('${fullUrl}');
  final headers = <String, String>{
${Object.entries(config.headers || {})
  .map(([k, v]) => `    '${k}': '${v}',`)
  .join('\n')}
  };

  final response = await http.${config.method.toLowerCase()}(
    url,
    headers: headers,
    ${hasBody ? `body: jsonEncode(${bodyJson}),` : ''}
  );

  print('Status: \${response.statusCode}');
  print('Body: \${response.body}');
}`;
  }

  private static generateCSharp(config: HttpRequestConfig, fullUrl: string): string {
    const hasBody = config.body && config.method !== 'GET';
    const bodyJson = hasBody ? JSON.stringify(config.body) : '';

    return `using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

class Program {
    static async Task Main() {
        using var client = new HttpClient();
        var request = new HttpRequestMessage(HttpMethod.${capitalize(config.method.toLowerCase())}, "${fullUrl}");

${Object.entries(config.headers || {})
  .map(([k, v]) => `        request.Headers.TryAddWithoutValidation("${k}", "${v}");`)
  .join('\n')}

${hasBody ? `        request.Content = new StringContent("${bodyJson.replace(/"/g, '\\"')}", Encoding.UTF8, "application/json");\n` : ''}
        var response = await client.SendAsync(request);
        var content = await response.Content.ReadAsStringAsync();

        Console.WriteLine($"Status: {(int)response.StatusCode}");
        Console.WriteLine($"Response: {content}");
    }
}`;
  }

  private static generateRust(config: HttpRequestConfig, fullUrl: string): string {
    const hasBody = config.body && config.method !== 'GET';
    const bodyJson = hasBody ? JSON.stringify(config.body) : '';

    return `use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use std::error::Error;

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let client = reqwest::Client::new();
    let mut headers = HeaderMap::new();

${Object.entries(config.headers || {})
  .map(
    ([k, v]) =>
      `    headers.insert(HeaderName::from_static("${k.toLowerCase()}"), HeaderValue::from_static("${v}"));`
  )
  .join('\n')}

    let response = client
        .${config.method.toLowerCase()}("${fullUrl}")
        .headers(headers)
        ${hasBody ? `.body(r#"${bodyJson}"#)` : ''}
        .send()
        .await?;

    println!("Status: {}", response.status());
    println!("Body: {}", response.text().await?);

    Ok(())
}`;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
