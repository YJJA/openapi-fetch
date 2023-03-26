import ts from "typescript";
import { camelCase } from "lodash-es";
import {
  GLOBAL_SECURITY_CLASS_NAME,
  GLOBAL_SET_BASIC_SECURITY_NAME,
  GLOBAL_SET_BEARER_SECURITY_NAME,
  GLOBAL_SET_HEADER_SECURITY_NAME,
  GLOBAL_SET_QUERY_SECURITY_NAME,
  GLOBAL_SET_SECURITY_NAME,
  GLOBAL_SECURITY_VAR_NAME,
  GLOBAL_EXPORT_PREFIX,
  GLOBAL_CLIENT_VAR_NAME,
  GLOBAL_RUNTIME_VAR_NAME,
} from "./constants.js";
import type { ApiContextGenerator } from "./ApiContextGenerator.js";

const { factory } = ts;

export class ApiSecurityGenerator {
  constructor(private readonly context: ApiContextGenerator) {}

  generate() {
    const statements: ts.Statement[] = [];

    // code `const $security = new runtime.Security();`
    statements.push(
      this.context.addComment(
        factory.createVariableStatement(
          [factory.createToken(ts.SyntaxKind.ExportKeyword)],
          factory.createVariableDeclarationList(
            [
              factory.createVariableDeclaration(
                factory.createIdentifier(GLOBAL_SECURITY_VAR_NAME),
                undefined,
                undefined,
                factory.createNewExpression(
                  factory.createPropertyAccessExpression(
                    factory.createIdentifier(GLOBAL_RUNTIME_VAR_NAME),
                    factory.createIdentifier(GLOBAL_SECURITY_CLASS_NAME)
                  ),
                  undefined,
                  []
                )
              ),
            ],
            ts.NodeFlags.Const
          )
        ),
        { comment: "security" }
      )
    );

    const securitySchemes = Object.fromEntries(
      Object.entries(this.context.doc.components?.securitySchemes ?? {}).map(
        ([key, val]) => [key, this.context.resolve(val)]
      )
    );

    Object.entries(securitySchemes).forEach(([securityName, schema]) => {
      let functionName: string = "";

      let argumentsArray: ts.Expression[] = [
        factory.createIdentifier(GLOBAL_SECURITY_VAR_NAME),
        factory.createStringLiteral(securityName),
      ];

      if (schema.type === "http") {
        if (schema.scheme === "basic") {
          functionName = GLOBAL_SET_BASIC_SECURITY_NAME;
        } else if (schema.scheme === "bearer") {
          functionName = GLOBAL_SET_BEARER_SECURITY_NAME;
        } else {
          console.warn(
            `unsupport http schema '${schema.scheme}' in securitySchemes`
          );
        }
      } else if (schema.type === "apiKey") {
        argumentsArray.push(factory.createStringLiteral(schema.name));

        if (schema.in === "header") {
          functionName = GLOBAL_SET_HEADER_SECURITY_NAME;
        } else if (schema.in === "query") {
          functionName = GLOBAL_SET_QUERY_SECURITY_NAME;
        } else {
          console.warn(`unsupport apiKey in '${schema.in}' in securitySchemes`);
        }
      } else {
        console.warn(
          `unsupport schema type '${schema.type}' in securitySchemes`
        );
      }

      if (!functionName) {
        return;
      }

      // code ` export const $setSecurity2{{securityName}} = $security.{{functionName}}.bind($security, {{...argumentsArray}});`
      statements.push(
        factory.createVariableStatement(
          [factory.createToken(ts.SyntaxKind.ExportKeyword)],
          factory.createVariableDeclarationList(
            [
              factory.createVariableDeclaration(
                factory.createIdentifier(
                  `${GLOBAL_EXPORT_PREFIX}${GLOBAL_SET_SECURITY_NAME}2${camelCase(
                    securityName
                  )}`
                ),
                undefined,
                undefined,
                factory.createCallExpression(
                  factory.createPropertyAccessExpression(
                    factory.createPropertyAccessExpression(
                      factory.createIdentifier(GLOBAL_SECURITY_VAR_NAME),
                      factory.createIdentifier(functionName)
                    ),
                    factory.createIdentifier("bind")
                  ),
                  undefined,
                  argumentsArray
                )
              ),
            ],
            ts.NodeFlags.Const
          )
        )
      );
    });

    // code `$client.use($security);`
    statements.push(
      factory.createExpressionStatement(
        factory.createCallExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier(GLOBAL_CLIENT_VAR_NAME),
            factory.createIdentifier("use")
          ),
          undefined,
          [factory.createIdentifier(GLOBAL_SECURITY_VAR_NAME)]
        )
      )
    );

    return statements;
  }
}
