import ts from "typescript";
import { OpenAPIV3 } from "openapi-types";
import { isNil } from "payload-is";
import { ApiOperationGenerator } from "./ApiOperationGenerator.ts";
import type { ApiSchemaGenerator } from "./ApiSchemaGenerator.ts";
import type { ApiContextGenerator } from "./ApiContextGenerator.ts";

const { HttpMethods } = OpenAPIV3;

export const HttpMethodList = [
  HttpMethods.GET,
  HttpMethods.PUT,
  HttpMethods.POST,
  HttpMethods.DELETE,
  HttpMethods.OPTIONS,
  HttpMethods.HEAD,
  HttpMethods.PATCH,
  HttpMethods.TRACE,
];

export class ApiPathsGenerator {

  private readonly context: ApiContextGenerator
  private readonly schema: ApiSchemaGenerator
  constructor(
    context: ApiContextGenerator,
    schema: ApiSchemaGenerator
  ) {
    this.context = context;
    this.schema = schema;
  }

  skip(tags?: string[]) {
    const config = this.context.config;
    const excluded = tags && tags.some((t) => config?.exclude?.includes(t));
    if (excluded) {
      return true;
    }
    if (config?.include) {
      const included = tags && tags.some((t) => config?.include?.includes(t));
      return !included;
    }
    return false;
  }

  generate() {
    const paths = this.context.doc.paths;
    const statements: ts.Statement[] = [];
    const operationIdMap = new Map<string, string>();

    Object.entries(paths).forEach(([path, pathItem]) => {
      if (isNil(pathItem)) {
        return;
      }

      HttpMethodList.forEach((method) => {
        const operation = pathItem[method];
        if (isNil(operation)) {
          return;
        }

        if (this.skip(operation.tags)) {
          return;
        }

        const operationId = operation.operationId;
        if (isNil(operationId)) {
          console.warn(`The operationId was not found in '${path}.${method}'`);
          return;
        }

        if (operationIdMap.has(operationId)) {
          console.warn(
            `There are duplicate operationId '${operationId}' in '${path}.${method}'`
          );
          return;
        }

        operationIdMap.set(operationId, `${path}.${method}`);

        const operationGenerator = new ApiOperationGenerator(
          this.context,
          this.schema,
          {
            operationId,
            path,
            method,
            pathItem,
            operation,
          }
        );

        statements.push(...operationGenerator.generate());
      });
    });

    return statements;
  }
}
