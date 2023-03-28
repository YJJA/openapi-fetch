import ts from "typescript";
import { ApiContextGenerator } from "./ApiContextGenerator";

const { factory } = ts;
import {
  GLOBAL_RUNTIME_LIB_NAME,
  GLOBAL_EXPORT_PREFIX,
  GLOBAL_RUNTIME_VAR_NAME,
  GLOBAL_STYLER_VAR_NAME,
  GLOBAL_STYLER_LIB_NAME,
  GLOBAL_FORMATTER_LIB_NAME,
  GLOBAL_FORMATTER_VAR_NAME,
} from "./constants.js";

export class ApiGlobalGenerator {
  constructor(private readonly context: ApiContextGenerator) {}

  generate() {
    return [
      this.createImportClient(),
      this.createImportStyler(),
      this.createImportFormatter(),
      this.createVersionVariable(),
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

  private createImportFormatter() {
    return factory.createImportDeclaration(
      undefined,
      factory.createImportClause(
        false,
        undefined,
        factory.createNamespaceImport(
          factory.createIdentifier(GLOBAL_FORMATTER_VAR_NAME)
        )
      ),
      factory.createStringLiteral(GLOBAL_FORMATTER_LIB_NAME),
      undefined
    );
  }

  private createVersionVariable() {
    const version = this.context.doc.info.version;
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
}
