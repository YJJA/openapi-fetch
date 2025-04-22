import ts from "typescript";
import { groupBy } from "lodash-es";
import { isBoolean, isUndefined } from "payload-is";
import type { OpenAPIV3 } from "openapi-types";
import {
  CONFIG_BODY_KEY,
  CLIENT_CONFIG_KEY,
  CONFIG_QUERY_KEY,
  CONFIG_HEADER_KEY,
  CLIENT_REQUEST_CONFIG_TYPE_NAME,
  CONFIG_PATH_KEY,
  GLOBAL_RUNTIME_VAR_NAME,
} from "./constants.ts";
import { type Formatter, getBodyFormatter } from "./utils.ts";
import type { ApiContextGenerator } from "./ApiContextGenerator.ts";
import type { ApiSchemaGenerator } from "./ApiSchemaGenerator.ts";

const { factory } = ts;

type ParameterAndRefObject =
  | OpenAPIV3.ReferenceObject
  | OpenAPIV3.ParameterObject;

type ApiParametersGeneratorConfig = {
  pathItem: OpenAPIV3.PathItemObject;
  operation: OpenAPIV3.OperationObject;
};

export type ParameterResult = {
  readonly key: string;
  readonly type: ts.ParameterDeclaration;
  readonly expression: ts.Identifier;
  readonly attrs: string[];
};

const keys = [
  CONFIG_PATH_KEY,
  CONFIG_QUERY_KEY,
  CONFIG_HEADER_KEY,
  CONFIG_BODY_KEY,
  CLIENT_CONFIG_KEY,
];

export class ApiParametersGenerator {
  private parameters: OpenAPIV3.ParameterObject[];
  private mapParameters: Record<string, OpenAPIV3.ParameterObject[]> = {};
  private requestBody: OpenAPIV3.RequestBodyObject | undefined;
  private mapResults: Record<string, ParameterResult> = {};

  public bodyFormatter?: Formatter;

  private readonly context: ApiContextGenerator
  private readonly schema: ApiSchemaGenerator
  private readonly config: ApiParametersGeneratorConfig

  constructor(
    context: ApiContextGenerator,
    schema: ApiSchemaGenerator,
    config: ApiParametersGeneratorConfig
  ) {
    this.context = context;
    this.schema = schema;
    this.config = config;
    const { operation, pathItem } = this.config;
    this.parameters = this.resolveParameters(
      operation.parameters,
      pathItem.parameters
    );
    this.requestBody = this.context.resolve(operation.requestBody);
    this.bodyFormatter = getBodyFormatter(this.requestBody);

    this.genParameters(this.parameters);
    this.genRequestBody(this.requestBody);
    this.genNormalConfig();
  }

  types(...ks: string[]) {
    const resultKeys = ks.length ? ks : keys;
    const types: ts.ParameterDeclaration[] = [];

    resultKeys.forEach((key) => {
      const result = this.mapResults[key];
      if (result) {
        types.push(result.type);
      }
    });
    return types;
  }

  expressions(...ks: string[]) {
    const resultKeys = ks.length ? ks : keys;
    const expressions: ts.Identifier[] = [];
    resultKeys.forEach((key) => {
      const result = this.mapResults[key];
      if (result) {
        expressions.push(result.expression);
      }
    });
    return expressions;
  }

  has(key: string) {
    return !!this.mapResults[key];
  }

  attrs(key: string) {
    return this.mapResults[key]?.attrs ?? [];
  }

  styler(key: string, attr: string) {
    const parameter = this.mapParameters[key]?.find((p) => p.name === attr);
    if (
      parameter?.in === "query" &&
      parameter?.content &&
      parameter.content["application/json"]
    ) {
      return { style: "json" };
    }

    let style = parameter?.style;
    let explode = parameter?.explode;
    if (isUndefined(style)) {
      if (parameter?.in === "path" || parameter?.in === "header") {
        style = "simple";
      } else {
        style = "form";
      }
    }

    if (isUndefined(explode)) {
      explode = style === "form";
    }

    if (style === "spaceDelimited") {
      style = "space";
    } else if (style === "pipeDelimited") {
      style = "pipe";
    } else if (style === "deepObject") {
      style = "deep";
    }

    return { style, explode };
  }

  addPathParameters(name: string) {
    this.parameters.push({
      in: "path",
      name,
      required: true,
    });
    this.genParameters(this.parameters);
  }

  private resolveParameters(
    a?: ParameterAndRefObject[],
    b?: ParameterAndRefObject[]
  ) {
    const list = this.context.resolveArray(a);
    const pip = this.context.resolveArray(b);
    for (const p of pip) {
      const existing = list.find((r) => r.name === p.name && r.in === p.in);
      if (!existing) {
        list.push(p);
      }
    }
    return list;
  }

  private getTypeFromParameter(parameter: OpenAPIV3.ParameterObject) {
    if (parameter.content) {
      const schema = this.schema.getSchemaFromContent(parameter.content);
      return this.schema.getTypeFromSchema(schema);
    }
    return this.schema.getTypeFromSchema(parameter.schema);
  }

  private createParam(
    name: string,
    type: ts.TypeNode,
    requiredOrinitializer: boolean | ts.Expression
  ) {
    let required = true;
    let initializer: ts.Expression | undefined = undefined;

    if (isBoolean(requiredOrinitializer)) {
      required = requiredOrinitializer;
    } else {
      initializer = requiredOrinitializer;
    }

    return factory.createParameterDeclaration(
      undefined,
      undefined,
      factory.createIdentifier(name),
      required ? undefined : factory.createToken(ts.SyntaxKind.QuestionToken),
      type,
      initializer
    );
  }

  private createArg(name: string) {
    return factory.createIdentifier(name);
  }

  private createGroupParmType(parameters: OpenAPIV3.ParameterObject[]) {
    return factory.createTypeLiteralNode(
      parameters.map((parameter) => {
        return factory.createPropertySignature(
          undefined,
          factory.createIdentifier(parameter.name),
          parameter.required
            ? undefined
            : factory.createToken(ts.SyntaxKind.QuestionToken),
          this.getTypeFromParameter(parameter)
        );
      })
    );
  }

  private genParameters(resolvedparameters: OpenAPIV3.ParameterObject[]) {
    Object.entries(groupBy(resolvedparameters, "in")).forEach(
      ([location, parameters]) => {
        let required = parameters.some((q) => q.required);
        let key = location;

        if (location === "path") {
          required = true;
          key = CONFIG_PATH_KEY;
        } else if (location === "query") {
          key = CONFIG_QUERY_KEY;
        } else if (location === "header") {
          key = CONFIG_HEADER_KEY;
        } else {
          console.warn(`unkown location '${location}' in parameters `);
          return;
        }

        this.mapParameters[key] = parameters;

        const type = this.createParam(
          key,
          this.createGroupParmType(parameters),
          required ? true : factory.createObjectLiteralExpression()
        );
        const expression = this.createArg(key);
        const attrs = parameters.map((item) => item.name);

        this.mapResults[key] = { key, type, expression, attrs };
      }
    );
  }

  private getTypeFromRequestBody(requestBody: OpenAPIV3.RequestBodyObject) {
    const schema = this.schema.getSchemaFromContent(requestBody.content);
    return this.schema.getTypeFromSchema(schema);
  }

  private genRequestBody(requestBody?: OpenAPIV3.RequestBodyObject) {
    if (requestBody) {
      const required = !!requestBody.required;
      this.mapResults[CONFIG_BODY_KEY] = {
        key: CONFIG_BODY_KEY,
        type: this.createParam(
          CONFIG_BODY_KEY,
          this.getTypeFromRequestBody(requestBody),
          required
        ),
        expression: this.createArg(CONFIG_BODY_KEY),
        attrs: [],
      };
    }
  }

  private createConfigType() {
    return factory.createTypeReferenceNode(
      factory.createQualifiedName(
        factory.createIdentifier(GLOBAL_RUNTIME_VAR_NAME),
        factory.createIdentifier(CLIENT_REQUEST_CONFIG_TYPE_NAME)
      )
    );
  }

  private genNormalConfig() {
    this.mapResults[CLIENT_CONFIG_KEY] = {
      key: CLIENT_CONFIG_KEY,
      type: this.createParam(CLIENT_CONFIG_KEY, this.createConfigType(), false),
      expression: this.createArg(CLIENT_CONFIG_KEY),
      attrs: [],
    };
  }
}
