import fs from 'node:fs/promises';
import path from 'node:path';

export class ProjectManager {
  public static async initProject(cwd: string = process.cwd()): Promise<string> {
    const apixDir = path.join(cwd, '.apix');
    await fs.mkdir(apixDir, { recursive: true });
    await fs.mkdir(path.join(apixDir, 'environments'), { recursive: true });
    await fs.mkdir(path.join(apixDir, 'collections'), { recursive: true });
    await fs.mkdir(path.join(apixDir, 'workflows'), { recursive: true });
    await fs.mkdir(path.join(apixDir, 'tests'), { recursive: true });

    // Write config.yaml
    const configYaml = `# APiX Project Configuration
name: "Team API Project"
version: "1.0.0"
defaultEnvironment: "local"
openapiPath: "./openapi.json"
`;
    await fs.writeFile(path.join(apixDir, 'config.yaml'), configYaml, 'utf-8');

    // Write sample environment
    const localEnv = {
      name: "local",
      baseUrl: "http://localhost:3000",
      variables: {
        baseUrl: "http://localhost:3000"
      },
      isProduction: false
    };
    await fs.writeFile(path.join(apixDir, 'environments', 'local.json'), JSON.stringify(localEnv, null, 2), 'utf-8');

    // Write README
    const readme = `# .apix Project

Shared APiX API definitions, environments, collections, workflows, and test assertions.
Commit this directory to Git to share API specs with your team.

Secrets must be kept in your local APiX config or referenced via environment variables.
`;
    await fs.writeFile(path.join(apixDir, 'README.md'), readme, 'utf-8');

    return apixDir;
  }
}
