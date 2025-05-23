import ts from "typescript";
import { get as getPath } from "lodash-es";
import type { OpenAPIV3 } from "openapi-types";
import { isReference, refPathToPropertyPath } from "./utils.ts";
import type { ApiItemConfig } from "./types.ts";

export class ApiContextGenerator {
  public readonly doc: OpenAPIV3.Document
  public readonly config: ApiItemConfig
  constructor(
    doc: OpenAPIV3.Document,
    config: ApiItemConfig
  ) {
    this.doc = doc;
    this.config = config;
  }

  resolve<T>(obj: T | OpenAPIV3.ReferenceObject) {
    if (!isReference(obj)) return obj;
    const ref = obj.$ref;
    const path = refPathToPropertyPath(ref);
    const resolved = getPath(this.doc, path);
    if (typeof resolved === "undefined") {
      throw new Error(`Can't find ${path}`);
    }
    return resolved as T;
  }

  resolveArray<T>(array?: Array<T | OpenAPIV3.ReferenceObject>) {
    return array ? array.map((el) => this.resolve(el)) : [];
  }

  addComment<T extends ts.Node>(
    node: T,
    opts: { comment?: string; deprecated?: boolean }
  ) {
    const texts: string[] = [];
    if (opts.comment) {
      texts.push(` * ${opts.comment.replace(/\n/g, "\n * ")}`);
    }
    if (opts.deprecated) {
      texts.push(` * @deprecated`);
    }

    if (!texts.length) {
      return node;
    }
    return ts.addSyntheticLeadingComment(
      node,
      ts.SyntaxKind.MultiLineCommentTrivia,
      `*\n${texts.join("\n")}\n `,
      true
    );
  }
}
