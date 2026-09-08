# APiX (Universal Terminal API Platform)

> **APiX is a production-quality, terminal-native API exploration, inspection, testing, documentation, execution, and automation platform.**

APiX is **NOT** a desktop GUI application. It is an interactive, keyboard-driven terminal platform built directly for your shell (Windows PowerShell, Windows CMD, macOS Terminal, Linux terminal).

---

## ⚡ Key Capabilities

- **Terminal-Native Interactive UI (TUI)**: Beautiful panels, colored method badges, collapsible response views, timeline graphs, and a global command palette (`Ctrl+P`).
- **OpenAPI Auto-Discovery**: Automatically finds and parses OpenAPI 3.x and Swagger 2.0 specs at `/openapi.json`, `/swagger.json`, `/api-docs`, etc.
- **Safe Probing Without OpenAPI**: Non-destructive discovery using `GET`, `OPTIONS`, and `HEAD` probes to infer available routes without corrupting remote state.
- **Precision Timing Breakdown**: Socket-level metrics for **DNS lookup**, **TCP connect**, **TLS handshake**, **Server TTFB**, and **content download**.
- **Production Safety Guards**: Automatic confirmation modal before executing destructive operations (`DELETE`, `PUT`, `PATCH`) in production environments.
- **Multi-Language Code Generator**: Generates 100% accurate request snippets for **cURL**, **JavaScript**, **TypeScript**, **Python**, **Go**, **Java**, **PHP**, **Dart**, **C#**, and **Rust**.
- **Environments & Templating**: Interpolate `{{baseUrl}}`, `{{token}}`, `{{userId}}` across local, development, staging, and production.
- **Auth Profiles & Secret Masking**: Automatic masking of sensitive headers (`Authorization: Bearer ********`) in terminal displays and request history.
- **Contract & Assertion Testing**: Run automated assertions on status codes, JSON paths, response headers, and OpenAPI schemas.
- **OpenAPI Spec Diffing**: Detect breaking changes, added/removed endpoints, and schema modifications between two API definitions.
- **API Quality Score**: Analyzes documentation coverage, schema completeness, error definitions, and examples.
- **Local Mock Server**: Serve synthetic schema-compliant responses directly from an OpenAPI specification.

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

# List discovered endpoints
apix endpoints http://localhost:4000

# Search endpoints and parameters
apix search users

# Execute endpoint directly from CLI
apix run /users/42 -X GET
apix run /users -X POST -d '{"name":"Praise"}'

# Run contract tests
apix test http://localhost:4000

# Compare two OpenAPI specifications for breaking changes
apix diff openapi-v1.json openapi-v2.json

# Generate documentation
apix docs generate openapi.json --format markdown

# Generate code snippet
apix generate python /users -X POST

# Import cURL command
apix import curl "curl -X POST 'http://localhost:3000/users' -H 'Authorization: Bearer token123'"

# Environment management
apix env list
apix env use staging

# History inspection
apix history list

# API Quality Score Analysis
apix analyze http://localhost:4000

# Local Mock Server
apix mock openapi.json --port 5050

# Configuration
apix config list
apix config set theme dark
```

---

## 🔒 Security & Production Protection

1. **Secret Redaction**: Passwords, Bearer tokens, API keys, and authorization headers are masked (`sk-****abc`) both in visual logs and stored history files (`~/.apix/history.json`).
2. **Production Confirmation**: Dangerous methods (`DELETE`, `PUT`, `PATCH`) executed against URLs or environments flagged as `PRODUCTION` require explicit confirmation unless `--force` is provided.
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


Here are the recommended next steps:

### 1. Link APiX Locally for System-Wide CLI Access
Run the following in the project root to make the `apix` command available globally in your Windows PowerShell / CMD:

```bash
npm link
```

After running `npm link`, you can type:
```bash
apix
```
from **any directory** in your terminal to launch the interactive TUI.

---

### 2. Try the Key Workflows

- **Explore a Local API**:
  ```bash
  apix connect http://localhost:3000
  ```
- **Generate an API Intelligence Report**:
  ```bash
  apix explain http://localhost:3000
  ```
- **Execute Direct Commands**:
  ```bash
  apix run /users
  apix GET http://localhost:3000/health
  ```
- **Spin Up a Local Mock Server**:
  ```bash
  apix mock tests/fixtures/openapi.json --port 5050
  ```
- **Initialize a Shareable Project**:
  ```bash
  apix project init
  ```

---

### 3. Package & Publish

To package for distribution or publish to npm:
```bash
npm pack      # Creates apix-cli-1.0.0.tgz tarball
npm publish   # Publishes apix-cli to the npm registry
```

Which of these would you like to explore or customize next?