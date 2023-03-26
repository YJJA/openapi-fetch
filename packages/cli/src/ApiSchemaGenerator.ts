import ts from "typescript";
import { isObject, upperFirst } from "lodash-es";
import { isFullString, isString, isTrue } from "payload-is";
import { getRefName, isReference, isStringOrNumberArray } from "./utils.js";
import type { OpenAPIV3 } from "openapi-types";
import type { ApiContextGenerator } from "./ApiContextGenerator.js";

const { factory } = ts;

export class ApiSchemaGenerator {
  private refs: Record<string, ts.TypeReferenceNode> = {};
  public aliases: ts.Statement[] = [];

  constructor(private readonly context: ApiContextGenerator) {}

  /**
   * 从 content 字段中获取 schema, 优先匹配 application/json mime type
   */
  getSchemaFromContent(
    content: Record<string, OpenAPIV3.MediaTypeObject>
  ): OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject {
    const keys = Object.keys(content);
    let key = keys[0];

    if (keys.some((key) => key === "application/json")) {
      key = "application/json";
    }

    if (isFullString(key)) {
      const schema = content[key]?.schema;
      if (isObject(schema)) {
        return schema;
      }
    }

    return { type: "string" };
  }

  getRef(obj: OpenAPIV3.ReferenceObject) {
    const { $ref } = obj;
    let ref = this.refs[$ref];
    if (!ref) {
      const schema = this.context.resolve<OpenAPIV3.SchemaObject>(obj);
      const name = getRefName($ref);
      const alias = upperFirst(name);

      ref = factory.createTypeReferenceNode(alias);
      this.refs[$ref] = ref;

      if (schema.enum && isStringOrNumberArray(schema.enum)) {
        this.aliases.push(this.getTypeFromEnum(alias, schema.enum));
      } else {
        this.aliases.push(
          factory.createTypeAliasDeclaration(
            [factory.createToken(ts.SyntaxKind.ExportKeyword)],
            factory.createIdentifier(alias),
            undefined,
            this.getTypeFromSchema(schema)
          )
        );
      }
    }

    return ref;
  }

  getTypeFromProperties(
    props: {
      [prop: string]: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject;
    },
    required?: string[],
    additionalProperties?:
      | boolean
      | OpenAPIV3.SchemaObject
      | OpenAPIV3.ReferenceObject
  ): ts.TypeLiteralNode {
    const members: ts.TypeElement[] = Object.keys(props).map((name) => {
      const schema = props[name];
      const isRequired = required?.includes(name);
      const obj = schema as OpenAPIV3.SchemaObject;
      const comment = obj?.title || obj?.description;
      const deprecated = obj?.deprecated;

      return this.context.addComment(
        factory.createPropertySignature(
          undefined,
          factory.createIdentifier(name),
          isRequired
            ? undefined
            : factory.createToken(ts.SyntaxKind.QuestionToken),
          this.getTypeFromSchema(schema)
        ),
        { comment, deprecated }
      );
    });

    if (additionalProperties) {
      const type =
        additionalProperties === true
          ? factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
          : this.getTypeFromSchema(additionalProperties);

      members.push(
        factory.createIndexSignature(
          undefined,
          [
            factory.createParameterDeclaration(
              undefined,
              undefined,
              factory.createIdentifier("key"),
              undefined,
              factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
              undefined
            ),
          ],
          type
        )
      );
    }
    return factory.createTypeLiteralNode(members);
  }

  getEnumLiteral(v: any) {
    switch (typeof v) {
      case "string": {
        return factory.createStringLiteral(v);
      }
      case "number": {
        return factory.createNumericLiteral(String(v));
      }
      case "boolean": {
        return v ? factory.createTrue() : factory.createFalse();
      }
    }

    return factory.createNull();
  }

  getTypeFromEnum(name: string, enums: (string | number)[]) {
    return factory.createEnumDeclaration(
      [factory.createToken(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier(name),
      enums.map((v) => {
        return factory.createEnumMember(
          factory.createIdentifier(isString(v) ? v : `_${v}`),
          this.getEnumLiteral(v)
        );
      })
    );
  }

  getBaseTypeFromSchema(
    schema?: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  ): ts.TypeNode {
    if (!schema) {
      return factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
    }
    if (isReference(schema)) {
      return this.getRef(schema);
    }

    if (schema.oneOf) {
      return factory.createUnionTypeNode(
        schema.oneOf.map((schema) => this.getTypeFromSchema(schema))
      );
    }
    if (schema.anyOf) {
      return factory.createUnionTypeNode(
        schema.anyOf.map((schema) => this.getTypeFromSchema(schema))
      );
    }

    if (schema.allOf) {
      const types = schema.allOf.map((schema) =>
        this.getTypeFromSchema(schema)
      );
      return factory.createIntersectionTypeNode(types);
    }

    if (schema.enum) {
      const types = schema.enum
        .map((v) => this.getEnumLiteral(v))
        .map((v) => factory.createLiteralTypeNode(v));
      return factory.createUnionTypeNode(types);
    }

    // 'boolean' | 'object' | 'number' | 'string' | 'integer' | 'array'
    switch (schema.type) {
      case "array": {
        if ("items" in schema) {
          return factory.createArrayTypeNode(
            this.getTypeFromSchema(schema.items)
          );
        }
        return factory.createArrayTypeNode(
          factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
        );
      }

      case "integer":
      case "number": {
        return factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
      }

      case "boolean": {
        return factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
      }

      case "string": {
        if (schema.format == "binary") {
          return factory.createTypeReferenceNode("Blob", []);
        }
        return factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
      }

      case "object": {
        return this.getTypeFromProperties(
          schema.properties || {},
          schema.required,
          schema.additionalProperties
        );
      }
    }

    return factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
  }

  getTypeFromSchema(
    schema?: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  ) {
    const type = this.getBaseTypeFromSchema(schema);
    return !isReference(schema) && isTrue(schema?.nullable)
      ? factory.createUnionTypeNode([
          type,
          factory.createLiteralTypeNode(factory.createNull()),
        ])
      : type;
  }
}
