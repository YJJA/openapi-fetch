import ts from "typescript";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { ApiPathsGenerator } from "./ApiPathsGenerator.js";
import { ApiSchemaGenerator } from "./ApiSchemaGenerator.js";
import { ApiSecurityGenerator } from "./ApiSecurityGenerator.js";
import { ApiServerGenerator } from "./ApiServerGenerator.js";
import { ApiContextGenerator } from "./ApiContextGenerator.js";
import { isURL, mergeURL } from "./utils.js";
import {
  GLOBAL_RUNTIME_LIB_NAME,
  GLOBAL_CLIENT_VAR_NAME,
  GLOBAL_EXPORT_PREFIX,
  GLOBAL_CLIENT_CLASS_NAME,
  GLOBAL_RUNTIME_VAR_NAME,
  GLOBAL_STYLER_VAR_NAME,
  GLOBAL_STYLER_LIB_NAME,
} from "./constants.js";
import type { OpenAPIV3 } from "openapi-types";
import type { ApiItemConfig } from "./types.js";

const { factory } = ts;

function isOpenApiV3(doc: any): doc is OpenAPIV3.Document {
  return "openapi" in doc && doc.openapi.startsWith("3");
}

export class ApiGenerator {
  constructor(public readonly config: ApiItemConfig) {}

  private fixRelativeServers(servers: OpenAPIV3.ServerObject[] = []) {
    if (!servers.length) {
      servers.push({ url: "/" });
    }
    return servers.map((server) => {
      if (!isURL(server.url) && isURL(this.config.spec)) {
        return {
          ...server,
          url: mergeURL(this.config.spec, server.url),
        };
      }
      return server;
    });
  }

  async parseSpec() {
    const doc = await $RefParser.bundle(this.config.spec);
    if (isOpenApiV3(doc)) {
      doc.servers = this.fixRelativeServers(doc.servers);
      return doc;
    }

    throw new Error("Only openapi v3 is supported for now");
  }

  async generateSourceFile() {
    const name = this.config.name;
    const doc = await this.parseSpec();
    const statements = this.generate(doc);

    const file = ts.createSourceFile(
      `${name}.ts`,
      "",
      ts.ScriptTarget.ES2020,
      false,
      ts.ScriptKind.TS
    );

    Object.assign(file, {
      statements: factory.createNodeArray([...file.statements, ...statements]),
    });

    return file;
  }

  async generateSourceCode() {
    const sourceFile = await this.generateSourceFile();
    const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
    return printer.printFile(sourceFile);
  }

  generate(doc: OpenAPIV3.Document) {
    const context = new ApiContextGenerator(doc, this.config);
    const schema = new ApiSchemaGenerator(context);
    const serverGenerator = new ApiServerGenerator(context);
    const securityGenerator = new ApiSecurityGenerator(context);
    const operationGenerator = new ApiPathsGenerator(context, schema);
    const paths = operationGenerator.generate();

    return [
      this.createImportClient(),
      this.createImportStyler(),
      this.createVersionVariable(doc.info.version),
      context.addComment(this.createClientVariable(), {
        comment: "client",
      }),
      ...serverGenerator.generate(),
      ...securityGenerator.generate(),
      ...schema.aliases,
      ...paths,
    ];
  }

  private createImportClient() {
    return factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamespaceImport(
          factory.createIdentifier(GLOBAL_RUNTIME_VAR_NAME)
        )
      ),
      factory.createStringLiteral(GLOBAL_RUNTIME_LIB_NAME),
      undefined
    );
  }

  private createImportStyler() {
    return factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamespaceImport(
          factory.createIdentifier(GLOBAL_STYLER_VAR_NAME)
        )
      ),
      factory.createStringLiteral(GLOBAL_STYLER_LIB_NAME),
      undefined
    );
  }

  private createVersionVariable(version: string) {
    return factory.createVariableStatement(
      [factory.createToken(ts.SyntaxKind.ExportKeyword)],
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createIdentifier(`${GLOBAL_EXPORT_PREFIX}version`),
            undefined,
            undefined,
            factory.createStringLiteral(version)
          ),
        ],
        ts.NodeFlags.Const
      )
    );
  }

  private createClientVariable() {
    return factory.createVariableStatement(
      [factory.createToken(ts.SyntaxKind.ExportKeyword)],
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createIdentifier(GLOBAL_CLIENT_VAR_NAME),
            undefined,
            undefined,
            factory.createNewExpression(
              factory.createPropertyAccessExpression(
                factory.createIdentifier(GLOBAL_RUNTIME_VAR_NAME),
                factory.createIdentifier(GLOBAL_CLIENT_CLASS_NAME)
              ),
              undefined,
              []
            )
          ),
        ],
        ts.NodeFlags.Const
      )
    );
  }
}
