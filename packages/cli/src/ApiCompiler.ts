import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { paths } from "./paths.ts";
import { ApiGenerator } from "./ApiGenerator.ts";
import { GEN_PACKAGE_NAME } from "./constants.ts";
import { readTypescriptFile } from "./utils.ts";
import type { ApiConfig } from "./types.ts";

const packageJson = {
  name: GEN_PACKAGE_NAME,
  type: "module",
  main: "lib/index.js",
  types: "lib/index.d.ts",
  source: "src/index.ts",
} as const;

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2018,
  moduleResolution: ts.ModuleResolutionKind.Node16,
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  rewriteRelativeImportExtensions: true,
};

export class ApiCompiler {
  private apiGenerators: Record<string, ApiGenerator> = {};
  private readonly config: ApiConfig
  constructor(config: ApiConfig) {
    this.config = config;
    config.items.forEach((item) => {
      this.apiGenerators[item.name] = new ApiGenerator(item);
    });
  }

  async writePackageJsonFile() {
    await fs.promises.mkdir(path.dirname(paths.packageJsonFile), {
      recursive: true,
    });

    const content = JSON.stringify(packageJson, null, 2);
    await fs.promises.writeFile(paths.packageJsonFile, content, "utf8");
  }

  async writeTSIndexFile() {
    const indexFile = paths.resolvePackage(packageJson.source);
    let imports: string[] = [];
    for await (const { name } of this.config.items) {
      imports.push(`export * as ${name} from './${name}.ts'`);
    }

    const content = imports.join("\n");
    await fs.promises.mkdir(path.dirname(indexFile), { recursive: true });
    await fs.promises.writeFile(indexFile, content, "utf8");
  }

  async writeTSSourceFile(name: string) {
    const sourceFile = paths.resolvePackage(`src/${name}.ts`);
    await fs.promises.mkdir(path.dirname(sourceFile), { recursive: true });
    const apiGenerator = this.apiGenerators[name];
    if (!apiGenerator) {
      return;
    }
    const sourceCode = await apiGenerator.generateSourceCode();
    await fs.promises.writeFile(sourceFile, sourceCode, "utf8");
  }

  async writeTSLibFiles() {
    const rootDir = paths.resolvePackage(`src`);
    const outDir = paths.resolvePackage(`lib`);
    const rootFiles = await readTypescriptFile(rootDir)

    const tsCompilerOptions: ts.CompilerOptions = {
      ...compilerOptions,
      declaration: true,
      rootDir,
      outDir
    };

    const program = ts.createProgram(rootFiles, tsCompilerOptions);
    const emitResult = program.emit();

    emitResult.diagnostics.map((item) => {
      console.warn(item.messageText);
    });
  }

  async compile() {
    await this.writePackageJsonFile();
    await this.writeTSIndexFile();

    for await (const { name } of this.config.items) {
      await this.writeTSSourceFile(name);
    }

    await this.writeTSLibFiles()
  }
}
