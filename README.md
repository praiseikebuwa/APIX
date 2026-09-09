# APiX Ecosystem (Universal Executable API Platform)

> **APiX is a terminal-native API explorer, executable project format (`.apix`), VS Code integration, and web platform.**

APiX turns APIs into version-controlled, executable developer experiences.

---

## 🏛 The 4 APiX Ecosystem Products

```text
                                APiX Core
                                    │
    ┌───────────────────┬───────────┴───────────┬───────────────────┐
    │                   │                       │                   │
    ▼                   ▼                       ▼                   ▼
 APiX CLI         .apix Project            APiX VS Code       APiX Website
 Terminal         YAML Format              Extension          Launch Page
```

### 1. APiX CLI (`apix-cli`)

- Interactive Terminal UI (built with React & Ink)
- Connect to any API (`apix connect http://localhost:4000`)
- Direct command execution (`apix run /users`, `apix GET http://localhost:4000/users`)
- Natural-language query parser (`apix ask "get the first 10 bookings"`)
- Load benchmarking (`apix benchmark <endpoint> -n 100 -c 5`)
- Contract testing & CI/CD mode (`apix test --ci`)
- API quality analyzer (`apix analyze`)
- Local mock server (`apix mock openapi.json`)

### 2. The `.apix` Project File Format

Human-readable, Git-versionable YAML specification (`api.apix`):

```yaml
version: 1
name: gas API
baseUrl: "{{baseUrl}}"

environments:
  development:
    baseUrl: "http://localhost:4000"
  production:
    baseUrl: "https://api.example.com"
    isProduction: true

auth:
  type: bearer
  token: "{{API_TOKEN}}"

requests:
  - name: List Users
    method: GET
    path: /users
    query:
      limit: 10
    tests:
      - expect:
          status: 200

workflows:
  - name: User Onboarding Flow
    steps:
      - request: Create User
        save:
          userId: response.id
      - request: Get User By ID
        variables:
          id: "{{userId}}"
```

### 3. APiX VS Code Extension (`vscode-extension/`)

- Language association & syntax highlighting for `.apix` files.
- CodeLens action buttons directly inside `.apix` project files:
  `▶ Run Request │ Copy cURL │ Generate Code`
- Side-by-side webview response viewer panel.

### 4. APiX Website (`website/`)

- Clean, monochrome (Black + White + Neutral Gray) developer launch page, documentation, and terminal showcases.
- Free of purple/cyan AI gradients, focusing on large typography, monospace preview blocks, and whitespace.

---

## ⚡ Quick Start

```bash
# Install globally
npm install -g apix-cli

# Initialize a human-readable .apix project file
apix init api.apix

# Open .apix project file in terminal explorer
apix open api.apix

# Connect to any API endpoint
apix connect http://localhost:4000

# Ping connectivity and socket metrics
apix ping http://localhost:4000
```

---

## 🕹 Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `↑` `↓` | Navigate endpoint tree / menu |
| `Enter` | Select endpoint / Execute action |
| `Esc` | Back to previous view |
| `/` | Filter endpoints |
| `Ctrl+P` | Open Command Palette |
| `Ctrl+R` | Run request in builder |
| `1` - `4` | Response tabs (Pretty, Raw, Headers, Timeline) |
| `c` | Code generator (10 languages) |
| `q` | Quit APiX |

---

## 📄 License

MIT © APiX Contributors
