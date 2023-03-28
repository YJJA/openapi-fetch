import ts from "typescript";
import { OpenAPIV3 } from "openapi-types";
import { isFullObject, isFullString } from "payload-is";
import { camelCase } from "lodash-es";
import { ApiParametersGenerator } from "./ApiParametersGenerator.js";
import {
  CONFIG_METHOD_KEY,
  CLIENT_CONFIG_KEY,
  CONFIG_PATH_KEY,
  CONFIG_BODY_KEY,
  CONFIG_HEADER_KEY,
  GLOBAL_STYLER_VAR_NAME,
  CONFIG_QUERY_KEY,
  GLOBAL_SECURITY_VAR_NAME,
  GLOBAL_SERVER_VAR_NAME,
  OPERATION_GET_URL,
  OPERATION_GET_CONFIG,
  GLOBAL_FORMATTER_VAR_NAME,
  GLOBAL_RUNTIME_VAR_NAME,
} from "./constants.js";
import type { ApiSchemaGenerator } from "./ApiSchemaGenerator.js";
import type { ApiContextGenerator } from "./ApiContextGenerator.js";

const { factory } = ts;

type ResponseType = "json" | "text" | "blob";

export type ApiOperationGeneratorConfig = {
  operationId: string;
  path: string;
  method: OpenAPIV3.HttpMethods;
  pathItem: OpenAPIV3.PathItemObject;
  operation: OpenAPIV3.OperationObject;
};

export class ApiOperationGenerator {
  public parameter: ApiParametersGenerator;
  public securityNames: string[] = [];

  constructor(
    private readonly context: ApiContextGenerator,
    private readonly schema: ApiSchemaGenerator,
    private readonly config: ApiOperationGeneratorConfig
  ) {
    this.parameter = new ApiParametersGenerator(
      this.context,
      this.schema,
      this.config
    );

    this.config.operation.security?.forEach((securityItem) => {
      const securityName = Object.keys(securityItem)[0];
      if (isFullString(securityName)) {
        this.securityNames.push(securityName);
      }
    });
  }

  /**
   * 获取请求返回数据单个状态的类型
   * 如果 response.content 为空，则直接返回 any 类型
   */
  private getTypeFromResponse(
    responseOrRef: OpenAPIV3.ReferenceObject | OpenAPIV3.ResponseObject
  ) {
    const response = this.context.resolve(responseOrRef);
    if (!response?.content) {
      return factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
    }
    const schema = this.schema.getSchemaFromContent(response.content);
    return this.schema.getTypeFromSchema(schema);
  }

  /**
   * 获取请求返回数据的的 TS 类型
   * 优先查找 code>=200 && code<300 之间的响应类型，如果有多个会使用联合类型
   * 如果没有再查找 code='default' 的类型
   */
  private getTypeFromResponses(
    responses: OpenAPIV3.ResponsesObject
  ): ts.TypeNode {
    const types = Object.entries(responses)
      .filter(([code]) => {
        const codeNumber = Number.parseInt(code, 10);
        return codeNumber >= 200 && codeNumber < 300;
      })
      .sort()
      .map(([_, response]) => {
        return this.getTypeFromResponse(response);
      });

    if (types.length === 0) {
      const defaultResponse = responses["default"];
      if (defaultResponse) {
        types.push(this.getTypeFromResponse(defaultResponse));
      }
    }

    return factory.createUnionTypeNode(types);
  }

  /**
   * 获取请求返回数据的的 Type 类型，分为 "json" | "text" | "blob"
   * 只查找 code>=200 && code<300 || code='default' 之间的响应类型，如果有多个会使用联合类型
   */
  private getResponseType(responses: OpenAPIV3.ResponsesObject): ResponseType {
    const resolvedResponses = Object.entries(responses)
      .filter(([code]) => {
        const codeNumber = Number.parseInt(code, 10);
        return (codeNumber >= 200 && codeNumber < 300) || code == "default";
      })
      .sort()
      .map(([_, response]) => this.context.resolve(response));

    // 如果有效的响应中没有定义 content 字段，则返回 'text' （向后兼容）
    const hasContent = resolvedResponses.some((res) =>
      isFullObject(res.content)
    );
    if (!hasContent) {
      return "text";
    }

    // 如果有效的响应中 content 字段中的媒体类型中包含 application/json 则返回 'json'
    const hasJsonMimeType = resolvedResponses.some((response) => {
      return Object.keys(response.content ?? {}).some(
        (mimeType) => mimeType === "application/json"
      );
    });
    if (hasJsonMimeType) {
      return "json";
    }

    // 如果有效的响应中 content 字段中的媒体类型中包含 text/* 则返回 'text'
    const hasJsonTextType = resolvedResponses.some((res) =>
      Object.keys(res.content ?? {}).some((type) => type.startsWith("text/"))
    );
    if (hasJsonTextType) {
      return "text";
    }

    // 其它都返回 'blob'
    return "blob";
  }

  generate() {
    const { summary, description, deprecated } = this.config.operation;
    const statements: ts.Statement[] = [];
    statements.push(
      this.context.addComment(this.createOperationIdFunction(), {
        comment: summary || description,
        deprecated,
      })
    );
    statements.push(this.createOperationIdNamespace());
    return statements;
  }

  /**
   * 创建 operationId 同名方法
   */
  private createOperationIdFunction() {
    const { operationId } = this.config;

    return factory.createFunctionDeclaration(
      [
        factory.createToken(ts.SyntaxKind.ExportKeyword),
        factory.createToken(ts.SyntaxKind.AsyncKeyword),
      ],
      undefined,
      factory.createIdentifier(operationId),
      undefined,
      this.parameter.types(),
      undefined,
      factory.createBlock(this.createReturnBlock(), true)
    );
  }

  private createOperationIdNamespace() {
    const { operationId } = this.config;

    return factory.createModuleDeclaration(
      [factory.createToken(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier(operationId),
      factory.createModuleBlock([
        factory.createFunctionDeclaration(
          [
            factory.createToken(ts.SyntaxKind.ExportKeyword),
            factory.createToken(ts.SyntaxKind.AsyncKeyword),
          ],
          undefined,
          factory.createIdentifier(OPERATION_GET_URL),
          undefined,
          this.parameter.types(CONFIG_PATH_KEY, CONFIG_QUERY_KEY),
          undefined,
          factory.createBlock(
            [
              factory.createReturnStatement(
                factory.createCallExpression(
                  factory.createPropertyAccessExpression(
                    factory.createIdentifier(GLOBAL_SERVER_VAR_NAME),
                    factory.createIdentifier("path")
                  ),
                  undefined,
                  [this.createUrlTemplateString()]
                )
              ),
            ],
            true
          )
        ),
        factory.createFunctionDeclaration(
          [
            factory.createToken(ts.SyntaxKind.ExportKeyword),
            factory.createToken(ts.SyntaxKind.AsyncKeyword),
          ],
          undefined,
          factory.createIdentifier(OPERATION_GET_CONFIG),
          undefined,
          this.parameter.types(
            CONFIG_HEADER_KEY,
            CONFIG_BODY_KEY,
            CLIENT_CONFIG_KEY
          ),
          undefined,
          factory.createBlock(
            [factory.createReturnStatement(this.createReturnBlockArguments())],
            true
          )
        ),
      ]),
      ts.NodeFlags.Namespace
    );
  }

  private createUrlTemplateString() {
    const path = this.config.path;
    const spans: Array<{ expression: ts.Expression; literal: string }> = [];
    const head = path.replace(
      /(.*?)\{(.+?)\}(.*?)(?=\{|$)/g,
      (_substr, head, name, literal) => {
        const attrs = this.parameter.attrs(CONFIG_PATH_KEY);
        if (!attrs.includes(name)) {
          this.parameter.addPathParameters(name);
        }

        spans.push({
          expression: this.createStylerCall(CONFIG_PATH_KEY, name),
          literal,
        });
        return head;
      }
    );

    let queryArgumentsArray: ts.Expression[] = [];

    if (this.parameter.has(CONFIG_QUERY_KEY)) {
      this.parameter.attrs(CONFIG_QUERY_KEY).forEach((name) => {
        queryArgumentsArray.push(this.createStylerCall(CONFIG_QUERY_KEY, name));
      });
    }

    if (this.securityNames.length) {
      this.securityNames.forEach((securityName) => {
        const securitySchema =
          this.context.doc.components?.securitySchemes?.[securityName];
        const schema = this.context.resolve(securitySchema);
        if (schema?.type === "apiKey" && schema.in === "query") {
          queryArgumentsArray.push(
            this.createStylerCallWithQuerySecurity(securityName, schema.name)
          );
        }
      });
    }

    if (queryArgumentsArray.length) {
      spans.push({
        expression: factory.createCallExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier(GLOBAL_STYLER_VAR_NAME),
            factory.createIdentifier("query")
          ),
          undefined,
          queryArgumentsArray
        ),
        literal: "",
      });
    }

    if (!spans.length) {
      return factory.createStringLiteral(head);
    }

    return factory.createTemplateExpression(
      factory.createTemplateHead(head),
      spans.map((span, i) => {
        return factory.createTemplateSpan(
          span.expression,
          i === spans.length - 1
            ? factory.createTemplateTail(span.literal)
            : factory.createTemplateMiddle(span.literal)
        );
      })
    );
  }

  /**
   * 创建 return
   */
  private createReturnBlock() {
    const { operationId, operation } = this.config;
    const statements: ts.Statement[] = [];
    const URL_VAR_NAME = "_url";
    const CFG_VAR_NAME = "_cfg";

    statements.push(
      factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              factory.createIdentifier(URL_VAR_NAME),
              undefined,
              undefined,
              factory.createAwaitExpression(
                factory.createCallExpression(
                  factory.createPropertyAccessExpression(
                    factory.createIdentifier(operationId),
                    factory.createIdentifier(OPERATION_GET_URL)
                  ),
                  undefined,
                  this.parameter.expressions(CONFIG_PATH_KEY, CONFIG_QUERY_KEY)
                )
              )
            ),
          ],
          ts.NodeFlags.Const
        )
      )
    );

    statements.push(
      factory.createVariableStatement(
        undefined,
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              factory.createIdentifier(CFG_VAR_NAME),
              undefined,
              undefined,
              factory.createAwaitExpression(
                factory.createCallExpression(
                  factory.createPropertyAccessExpression(
                    factory.createIdentifier(operationId),
                    factory.createIdentifier(OPERATION_GET_CONFIG)
                  ),
                  undefined,
                  this.parameter.expressions(
                    CONFIG_HEADER_KEY,
                    CONFIG_BODY_KEY,
                    CLIENT_CONFIG_KEY
                  )
                )
              )
            ),
          ],
          ts.NodeFlags.Const
        )
      )
    );

    const responseType = this.getResponseType(operation.responses);
    const clientFuncName = camelCase(`fetch ${responseType}`);

    // response type node
    let responseTypeNode = this.getTypeFromResponses(operation.responses);
    if (responseType === "blob") {
      responseTypeNode = factory.createTypeReferenceNode("Blob");
    } else if (responseType === "text") {
      responseTypeNode = factory.createKeywordTypeNode(
        ts.SyntaxKind.StringKeyword
      );
    }

    statements.push(
      factory.createReturnStatement(
        factory.createCallExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier(GLOBAL_RUNTIME_VAR_NAME),
            factory.createIdentifier(clientFuncName)
          ),
          responseType === "json" ? [responseTypeNode] : undefined,
          [
            factory.createIdentifier(URL_VAR_NAME),
            factory.createIdentifier(CFG_VAR_NAME),
          ]
        )
      )
    );

    return statements;
  }

  /**
   * 创建 return 参数
   */
  private createReturnBlockArguments() {
    const bodyFormatter = this.parameter.bodyFormatter;
    const ObjectLiteralExpression = factory.createObjectLiteralExpression(
      [
        ...this.getConfigSpread(),
        ...this.getConfigMethod(),
        ...this.getConfigBody(),
        ...this.getConfigHeaders(),
      ],
      true
    );

    if (!bodyFormatter) {
      return ObjectLiteralExpression;
    }

    return factory.createCallExpression(
      factory.createPropertyAccessExpression(
        factory.createIdentifier(GLOBAL_FORMATTER_VAR_NAME),
        factory.createIdentifier(bodyFormatter)
      ),
      undefined,
      [ObjectLiteralExpression]
    );
  }

  /**
   * config
   */
  private getConfigSpread() {
    const statements: ts.ObjectLiteralElementLike[] = [];
    statements.push(
      factory.createSpreadAssignment(
        factory.createIdentifier(CLIENT_CONFIG_KEY)
      )
    );
    return statements;
  }

  /**
   * method
   */
  private getConfigMethod() {
    const statements: ts.ObjectLiteralElementLike[] = [];
    statements.push(
      factory.createPropertyAssignment(
        factory.createIdentifier(CONFIG_METHOD_KEY),
        factory.createStringLiteral(this.config.method)
      )
    );
    return statements;
  }

  /**
   * body
   */
  private getConfigBody() {
    const statements: ts.ObjectLiteralElementLike[] = [];

    if (this.parameter.has(CONFIG_BODY_KEY)) {
      statements.push(
        factory.createShorthandPropertyAssignment(
          factory.createIdentifier(CONFIG_BODY_KEY)
        )
      );
    }

    return statements;
  }

  /**
   * headers
   */
  private getConfigHeaders() {
    const statements: ts.ObjectLiteralElementLike[] = [];
    const properties: ts.ObjectLiteralElementLike[] = [];

    this.parameter.attrs(CONFIG_HEADER_KEY).forEach((key) => {
      properties.push(
        factory.createPropertyAssignment(
          factory.createIdentifier(key),
          this.createStylerCall(CONFIG_HEADER_KEY, key)
        )
      );
    });

    if (this.securityNames.length) {
      this.securityNames.forEach((securityName) => {
        const securitySchema =
          this.context.doc.components?.securitySchemes?.[securityName];
        const schema = this.context.resolve(securitySchema);

        let key: string = "";
        if (schema?.type === "http") {
          if (schema.scheme === "basic" || schema.scheme === "bearer") {
            key = "Authorization";
          }
        }
        if (schema?.type === "apiKey") {
          if (schema.in === "header") {
            key = schema.name;
          }
        }
        if (key) {
          properties.push(
            factory.createPropertyAssignment(
              factory.createIdentifier(key),
              this.createStylerCallWithHeaderSecurity(securityName)
            )
          );
        }
      });
    }

    if (properties.length) {
      statements.push(
        factory.createPropertyAssignment(
          factory.createIdentifier(CONFIG_HEADER_KEY),
          factory.createObjectLiteralExpression(
            [
              factory.createSpreadAssignment(
                factory.createPropertyAccessChain(
                  factory.createIdentifier(CLIENT_CONFIG_KEY),
                  factory.createToken(ts.SyntaxKind.QuestionDotToken),
                  factory.createIdentifier(CONFIG_HEADER_KEY)
                )
              ),
              factory.createSpreadAssignment(
                factory.createObjectLiteralExpression(properties, true)
              ),
            ],
            true
          )
        )
      );
    }

    return statements;
  }

  private createStylerCall(key: string, name: string) {
    const cfg = this.parameter.styler(key, name);

    return factory.createCallExpression(
      factory.createPropertyAccessExpression(
        factory.createIdentifier(GLOBAL_STYLER_VAR_NAME),
        factory.createIdentifier(cfg.style)
      ),
      undefined,
      [
        ...(cfg.style === "label" || cfg.style === "simple"
          ? []
          : [factory.createStringLiteral(name)]),
        factory.createPropertyAccessExpression(
          factory.createIdentifier(key),
          factory.createIdentifier(name)
        ),
        ...(cfg.explode && cfg.style !== "deep" ? [factory.createTrue()] : []),
      ]
    );
  }

  private createStylerCallWithQuerySecurity(key: string, name: string) {
    return factory.createCallExpression(
      factory.createPropertyAccessExpression(
        factory.createIdentifier(GLOBAL_STYLER_VAR_NAME),
        factory.createIdentifier("form")
      ),
      undefined,
      [
        factory.createStringLiteral(name),
        factory.createAwaitExpression(
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier(GLOBAL_SECURITY_VAR_NAME),
              factory.createIdentifier("token")
            ),
            undefined,
            [factory.createStringLiteral(key)]
          )
        ),
      ]
    );
  }

  private createStylerCallWithHeaderSecurity(key: string) {
    return factory.createCallExpression(
      factory.createPropertyAccessExpression(
        factory.createIdentifier(GLOBAL_STYLER_VAR_NAME),
        factory.createIdentifier("simple")
      ),
      undefined,
      [
        factory.createAwaitExpression(
          factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier(GLOBAL_SECURITY_VAR_NAME),
              factory.createIdentifier("token")
            ),
            undefined,
            [factory.createStringLiteral(key)]
          )
        ),
      ]
    );
  }
}
