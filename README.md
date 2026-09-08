# APiX (Universal Terminal API Platform)

> **APiX is a production-quality, terminal-native API exploration, inspection, testing, documentation, execution, and automation platform.**

APiX is **NOT** a desktop GUI application. It is an interactive, keyboard-driven terminal platform built directly for your shell (Windows PowerShell, Windows CMD, macOS Terminal, Linux terminal).

---

## ⚡ Key Capabilities

- **Terminal-Native Interactive UI (TUI)**: Beautiful panels, colored method badges, collapsible response views, timeline graphs, and a global command palette (`Ctrl+P`).
- **OpenAPI Auto-Discovery**: Automatically finds and parses OpenAPI 3.x and Swagger 2.0 specs at `/openapi.json`, `/swagger.json`, `/api-docs`, etc.
- **Safe Probing Without OpenAPI**: Non-destructive discovery using `GET`, `OPTIONS`, and `HEAD` probes to infer available routes without corrupting remote state.
- **Precision Timing Breakdown**: Socket-level metrics for **DNS lookup**, **TCP connect**, **TLS handshake**, **Server TTFB**, and **content download**.
- **Load Benchmarking Engine**: Run concurrent load tests (`apix benchmark <endpoint> -n 100 -c 5`) with throughput calculation (req/sec) and **P50**, **P90**, **P95**, and **P99** latency distribution percentiles.
- **GraphQL Discovery & Introspection**: Schema introspection (`apix graphql <url>`), discovering queries, mutations, types, and running raw GraphQL queries.
- **Natural Language Control**: Query APIs with natural English (`apix ask "get the first 10 bookings"`).
- **Production Safety Guards**: Automatic confirmation modal before executing destructive operations (`DELETE`, `PUT`, `PATCH`) or load benchmarks in production environments.
- **Multi-Language Code Generator**: Generates 100% accurate request snippets for **cURL**, **JavaScript**, **TypeScript**, **Python**, **Go**, **Java**, **PHP**, **Dart**, **C#**, and **Rust**.
- **Environments & Templating**: Interpolate `{{baseUrl}}`, `{{token}}`, `{{userId}}` across local, development, staging, and production.
- **Auth Profiles & Secret Masking**: Automatic masking of sensitive headers (`Authorization: Bearer ********`) in terminal displays and request history.
- **Contract & Assertion Testing**: Run automated assertions on status codes, JSON paths, response headers, and OpenAPI schemas (`apix test --ci`).
- **OpenAPI Spec Diffing**: Detect breaking changes, added/removed endpoints, and schema modifications between two API definitions.
- **API Quality Score**: Analyzes documentation coverage, schema completeness, error definitions, and examples (`apix analyze`).
- **Local Mock Server**: Serve synthetic schema-compliant responses directly from an OpenAPI specification (`apix mock openapi.json`).
- **Plugin Architecture**: Modular plugin manager (`apix plugin list`).

---

## 🚀 Installation & Quick Start

### Global Installation

```bash
npm install -g apix-cli
```

Or run without installing:

```bash
npx apix-cli
```

### Quick Launch

Launch the interactive Terminal UI:

```bash
apix
```

Connect directly to a local or remote API:

```bash
apix connect http://localhost:4000
```

Specify an explicit OpenAPI specification file or URL:

```bash
apix connect http://localhost:4000 --openapi http://localhost:4000/openapi.json
```

---

## 🕹 Terminal Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `↑` `↓` | Navigate endpoint lists, menu items, and parameters |
| `Enter` | Select endpoint / Execute action |
| `Esc` | Go back to previous screen |
| `/` | Live search / filter endpoints |
| `Ctrl+P` | Open Command Palette modal |
| `Ctrl+R` | Execute current request in Request Builder |
| `1` - `4` | Switch response tabs (1: Pretty JSON, 2: Raw, 3: Headers, 4: Timeline) |
| `c` | Open Code Generator for current endpoint |
| `q` | Quit APiX |

---

## 💻 CLI Commands Reference

APiX can be run interactively or scripted in non-interactive shell environments (CI/CD, scripts):

```bash
# Connect & Explore
apix connect https://api.example.com

# Ping endpoint connectivity & breakdown metrics
apix ping http://localhost:4000

# Generate API Intelligence Report
apix explain http://localhost:4000

# Direct HTTP Method Executions
apix GET http://localhost:4000/users
apix POST http://localhost:4000/users -d '{"name":"Praise"}'

# Load Benchmarking (P50/P95/P99 latencies)
apix benchmark http://localhost:4000/users -n 100 -c 5

# GraphQL Introspection & Querying
apix graphql http://localhost:4000/graphql
apix graphql http://localhost:4000/graphql -q "query { users { id name } }"

# Natural Language Querying
apix ask "get the first 10 bookings"

# List discovered endpoints
apix endpoints http://localhost:4000

# Search endpoints and parameters
apix search users

# Execute endpoint directly from CLI
apix run /users/42 -X GET
apix run /users -X POST -d '{"name":"Praise"}'

# Run contract tests in CI/CD mode
apix test http://localhost:4000 --ci

# Compare two OpenAPI specifications for breaking changes
apix diff openapi-v1.json openapi-v2.json

# Generate documentation
apix docs generate openapi.json --format markdown

# Generate code snippet
apix generate python /users -X POST

# Import cURL command or Postman Collection
apix import curl "curl -X POST 'http://localhost:3000/users' -H 'Authorization: Bearer token123'"
apix import collection postman_collection.json

# Environment management
apix env list
apix env use staging

# History inspection
apix history list

# API Quality Score Analysis
apix analyze http://localhost:4000

# Local Mock Server
apix mock openapi.json --port 5050

# Shareable Git Projects
apix project init

# Plugin management
apix plugin list

# Configuration
apix config list
apix config set theme dark
```

---

## 🔒 Security & Production Protection

1. **Secret Redaction**: Passwords, Bearer tokens, API keys, and authorization headers are masked (`sk-****abc`) both in visual logs and stored history files (`~/.apix/history.json`).
2. **Production Confirmation**: Dangerous methods (`DELETE`, `PUT`, `PATCH`) or load benchmarks executed against URLs or environments flagged as `PRODUCTION` require explicit confirmation unless `--force` is provided.
3. **ANSI Sanitization**: API response bodies are sanitized to strip terminal escape sequences before rendering to protect terminal emulators against injection attacks.
4. **TLS Verification**: TLS verification is active by default. Use `--insecure` only during local testing with self-signed certificates.

---

## 🏗 Development & Testing

Build from source:

```bash
git clone https://github.com/your-org/apix.git
cd apix
npm install
npm run build
npm test
```

Execute tests using Vitest:

```bash
npm test
```

---

## 📄 License

MIT © Google Deepmind Team / APiX Contributors