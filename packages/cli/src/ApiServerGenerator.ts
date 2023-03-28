import ts from "typescript";
import { isFullObject } from "payload-is";
import {
  GLOBAL_SERVER_CLASS_NAME,
  GLOBAL_SERVER_VAR_NAME,
  GLOBAL_SERVER_TYPE_NAME,
  GLOBAL_RUNTIME_VAR_NAME,
  GLOBAL_SET_SERVER_NAME,
  GLOBAL_EXPORT_PREFIX,
  GLOBAL_SET_SERVER_URL_NAME,
} from "./constants.js";
import type { ApiContextGenerator } from "./ApiContextGenerator.js";

const { factory } = ts;

export class ApiServerGenerator {
  constructor(private readonly context: ApiContextGenerator) {}

  generate() {
    const servers = this.context.doc.servers;
    const statements: ts.Statement[] = [];

    const serverTypeElements: (ts.TypeNode | ts.NamedTupleMember)[] = [];
    const serverExpressionElements: ts.Expression[] = [];

    // for each servers
    servers?.forEach(({ url, variables }) => {
      const itemTypeElements: ts.PropertySignature[] = [];
      const itemExpressionElements: ts.ObjectLiteralElementLike[] = [];

      if (isFullObject(variables)) {
        Object.entries(variables).forEach(([verName, variable]) => {
          let enumList = variable.enum ?? [];
          if (!enumList.includes(variable.default)) {
            enumList = [...enumList, variable.default];
          }
          itemTypeElements.push(
            factory.createPropertySignature(
              undefined,
              factory.createIdentifier(verName),
              factory.createToken(ts.SyntaxKind.QuestionToken),
              variable.enum?.length
                ? factory.createUnionTypeNode(
                    enumList.map((it) =>
                      factory.createLiteralTypeNode(
                        factory.createStringLiteral(it)
                      )
                    )
                  )
                : factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)
            )
          );

          itemExpressionElements.push(
            factory.createPropertyAssignment(
              factory.createIdentifier(verName),
              factory.createStringLiteral(variable.default)
            )
          );
        });
      }

      serverTypeElements.push(
        itemTypeElements.length
          ? factory.createTypeLiteralNode(itemTypeElements)
          : factory.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword)
      );

      serverExpressionElements.push(
        factory.createObjectLiteralExpression(
          [
            factory.createPropertyAssignment(
              factory.createIdentifier("url"),
              factory.createStringLiteral(url)
            ),
            factory.createPropertyAssignment(
              factory.createIdentifier("variables"),
              itemExpressionElements.length
                ? factory.createObjectLiteralExpression(
                    itemExpressionElements,
                    true
                  )
                : factory.createIdentifier("undefined")
            ),
          ],
          true
        )
      );
    });

    // code `type ServerConfigs = [{...}, {...}]`
    statements.push(
      factory.createTypeAliasDeclaration(
        [factory.createToken(ts.SyntaxKind.ExportKeyword)],
        factory.createIdentifier(GLOBAL_SERVER_TYPE_NAME),
        undefined,
        factory.createTupleTypeNode(serverTypeElements)
      )
    );

    // code `const $server = new Server<ServerConfigs>([...])`
    statements.push(
      this.context.addComment(
        factory.createVariableStatement(
          undefined,
          factory.createVariableDeclarationList(
            [
              factory.createVariableDeclaration(
                factory.createIdentifier(GLOBAL_SERVER_VAR_NAME),
                undefined,
                undefined,
                factory.createNewExpression(
                  factory.createPropertyAccessExpression(
                    factory.createIdentifier(GLOBAL_RUNTIME_VAR_NAME),
                    factory.createIdentifier(GLOBAL_SERVER_CLASS_NAME)
                  ),
                  [
                    factory.createTypeReferenceNode(
                      factory.createIdentifier(GLOBAL_SERVER_TYPE_NAME),
                      undefined
                    ),
                  ],
                  [
                    factory.createArrayLiteralExpression(
                      serverExpressionElements,
                      true
                    ),
                  ]
                )
              ),
            ],
            ts.NodeFlags.Const
          )
        ),
        { comment: "server" }
      )
    );

    statements.push(
      factory.createVariableStatement(
        [factory.createToken(ts.SyntaxKind.ExportKeyword)],
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              factory.createIdentifier(
                `${GLOBAL_EXPORT_PREFIX}${GLOBAL_SET_SERVER_NAME}`
              ),
              undefined,
              undefined,
              factory.createCallExpression(
                factory.createPropertyAccessExpression(
                  factory.createPropertyAccessExpression(
                    factory.createIdentifier(GLOBAL_SERVER_VAR_NAME),
                    factory.createIdentifier(GLOBAL_SET_SERVER_NAME)
                  ),
                  factory.createIdentifier("bind")
                ),
                undefined,
                [factory.createIdentifier(GLOBAL_SERVER_VAR_NAME)]
              )
            ),
          ],
          ts.NodeFlags.Const
        )
      )
    );

    statements.push(
      factory.createVariableStatement(
        [factory.createToken(ts.SyntaxKind.ExportKeyword)],
        factory.createVariableDeclarationList(
          [
            factory.createVariableDeclaration(
              factory.createIdentifier(
                `${GLOBAL_EXPORT_PREFIX}${GLOBAL_SET_SERVER_URL_NAME}`
              ),
              undefined,
              undefined,
              factory.createCallExpression(
                factory.createPropertyAccessExpression(
                  factory.createPropertyAccessExpression(
                    factory.createIdentifier(GLOBAL_SERVER_VAR_NAME),
                    factory.createIdentifier(GLOBAL_SET_SERVER_URL_NAME)
                  ),
                  factory.createIdentifier("bind")
                ),
                undefined,
                [factory.createIdentifier(GLOBAL_SERVER_VAR_NAME)]
              )
            ),
          ],
          ts.NodeFlags.Const
        )
      )
    );

    return statements;
  }
}
