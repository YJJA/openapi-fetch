import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";
import { paths } from "./paths.js";
import { ApiGenerator } from "./ApiGenerator.js";
import { GEN_PACKAGE_NAME } from "./constants.js";
import type { ApiConfig } from "./types.js";

const packageJson = {
  name: GEN_PACKAGE_NAME,
  type: "module",
  main: "lib/commonjs/index.js",
  module: "lib/module/index.js",
  types: "lib/typescript/index.d.ts",
  source: "src/index.ts",
  "react-native": "src/index.ts",
  exports: {
    ".": {
      import: "./lib/module/index.js",
      require: "./lib/commonjs/index.js",
      types: "./lib/typescript/index.d.ts",
    },
  },
} as const;

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ES2022,
  moduleResolution: ts.ModuleResolutionKind.Node16,
  declaration: false,
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  forceConsistentCasingInFileNames: true,
  allowUnusedLabels: false,
  allowUnreachableCode: false,
  noFallthroughCasesInSwitch: true,
  noImplicitOverride: true,
  noImplicitReturns: true,
  noPropertyAccessFromIndexSignature: true,
  noUncheckedIndexedAccess: true,
  noUnusedLocals: true,
  noUnusedParameters: true,
  checkJs: true,
};

export class ApiCompiler {
  private apiGenerators: Record<string, ApiGenerator> = {};

  constructor(private readonly config: ApiConfig) {
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

  async writeTSIndexFile(indexFile: string) {
    let imports: string[] = [];
    for await (const { name } of this.config.items) {
      imports.push(`export * as ${name} from './${name}.js'`);
    }

    const content = imports.join("\n");
    await fs.promises.mkdir(path.dirname(indexFile), { recursive: true });
    await fs.promises.writeFile(indexFile, content, "utf8");
  }

  async writeTSSourceFile(name: string, sourceFile: string) {
    await fs.promises.mkdir(path.dirname(sourceFile), { recursive: true });
    const apiGenerator = this.apiGenerators[name];
    if (!apiGenerator) {
      return;
    }
    const sourceCode = await apiGenerator.generateSourceCode();
    await fs.promises.writeFile(sourceFile, sourceCode, "utf8");
  }

  async writeTSTypesFile(sourceFile: string, typesFile: string) {
    await fs.promises.mkdir(path.dirname(typesFile), { recursive: true });

    const tsCompilerOptions: ts.CompilerOptions = {
      ...compilerOptions,
      declaration: true,
      emitDeclarationOnly: true,
    };
    const host = ts.createCompilerHost(tsCompilerOptions);
    host.writeFile = (_, text) => {
      fs.promises.writeFile(typesFile, text, "utf8");
    };

    const program = ts.createProgram([sourceFile], tsCompilerOptions, host);
    const emitResult = program.emit();
    emitResult.diagnostics.map((item) => {
      console.warn(item.messageText);
    });
  }

  async writeTSCommonjsFile(sourceFile: string, commonjsFile: string) {
    await fs.promises.mkdir(path.dirname(commonjsFile), {
      recursive: true,
    });

    const tsCompilerOptions: ts.CompilerOptions = {
      ...compilerOptions,
      target: ts.ScriptTarget.ES2015,
      module: ts.ModuleKind.CommonJS,
    };
    const host = ts.createCompilerHost(tsCompilerOptions);
    host.writeFile = (_, text) => {
      fs.promises.writeFile(commonjsFile, text, "utf8");
    };

    const program = ts.createProgram([sourceFile], tsCompilerOptions, host);
    const emitResult = program.emit();
    emitResult.diagnostics.map((item) => {
      console.warn(item.messageText);
    });
  }

  async writeTSModuleFile(sourceFile: string, moduleFile: string) {
    await fs.promises.mkdir(path.dirname(moduleFile), {
      recursive: true,
    });

    const tsCompilerOptions: ts.CompilerOptions = {
      ...compilerOptions,
      target: ts.ScriptTarget.ES2015,
      module: ts.ModuleKind.ES2015,
    };

    const host = ts.createCompilerHost(tsCompilerOptions);
    host.writeFile = (_, text) => {
      fs.promises.writeFile(moduleFile, text, "utf8");
    };

    const program = ts.createProgram([sourceFile], tsCompilerOptions, host);
    const emitResult = program.emit();
    emitResult.diagnostics.map((item) => {
      console.warn(item.messageText);
    });
  }

  async compile() {
    await this.writePackageJsonFile();

    const indexSourceFile = paths.resolvePackage(packageJson.source);
    const indexModuleFile = paths.resolvePackage(packageJson.module);
    const indexCommonjsFile = paths.resolvePackage(packageJson.main);
    const indexTypesFile = paths.resolvePackage(packageJson.types);

    await this.writeTSIndexFile(indexSourceFile);
    await this.writeTSModuleFile(indexSourceFile, indexModuleFile);
    await this.writeTSCommonjsFile(indexSourceFile, indexCommonjsFile);
    await this.writeTSTypesFile(indexSourceFile, indexTypesFile);

    for await (const { name } of this.config.items) {
      const itemSourceFile = paths.resolvePackage(`src/${name}.ts`);
      const itemModuleFile = paths.resolvePackage(`lib/module/${name}.js`);
      const itemCommonjsFile = paths.resolvePackage(`lib/commonjs/${name}.js`);
      const itemTypesFile = paths.resolvePackage(`lib/typescript/${name}.d.ts`);

      await this.writeTSSourceFile(name, itemSourceFile);
      await this.writeTSModuleFile(itemSourceFile, itemModuleFile);
      await this.writeTSCommonjsFile(itemSourceFile, itemCommonjsFile);
      await this.writeTSTypesFile(itemSourceFile, itemTypesFile);
    }
  }
}
