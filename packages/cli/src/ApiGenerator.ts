import ts from "typescript";
import $RefParser from "@apidevtools/json-schema-ref-parser";
import { ApiPathsGenerator } from "./ApiPathsGenerator.js";
import { ApiSchemaGenerator } from "./ApiSchemaGenerator.js";
import { ApiSecurityGenerator } from "./ApiSecurityGenerator.js";
import { ApiServerGenerator } from "./ApiServerGenerator.js";
import { ApiContextGenerator } from "./ApiContextGenerator.js";
import { ApiGlobalGenerator } from "./ApiGlobalGenerator.js";
import { isURL, mergeURL } from "./utils.js";

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
    const globalGenerator = new ApiGlobalGenerator(context);
    const serverGenerator = new ApiServerGenerator(context);
    const securityGenerator = new ApiSecurityGenerator(context);
    const operationGenerator = new ApiPathsGenerator(context, schema);
    const paths = operationGenerator.generate();

    return [
      ...globalGenerator.generate(),
      ...serverGenerator.generate(),
      ...securityGenerator.generate(),
      ...schema.aliases,
      ...paths,
    ];
  }
}
