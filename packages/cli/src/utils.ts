import { isNumber, isString } from "payload-is";

import type { OpenAPIV3 } from "openapi-types";

export function isReference(obj: unknown): obj is OpenAPIV3.ReferenceObject {
  return typeof obj === "object" && obj !== null && "$ref" in obj;
}

/**
 * Converts a local reference path into an array of property names.
 */
export function refPathToPropertyPath(ref: string) {
  if (!ref.startsWith("#/")) {
    throw new Error(
      `External refs are not supported (${ref}). Make sure to call SwaggerParser.bundle() first.`
    );
  }
  return ref
    .slice(2)
    .split("/")
    .map((s) => decodeURI(s.replace(/~1/g, "/").replace(/~0/g, "~")));
}

/**
 * Get the last path component of the given ref.
 */
function getRefBasename(ref: string) {
  return ref.replace(/.+\//, "");
}

/**
 * Returns a name for the given ref that can be used as basis for a type
 * alias. This usually is the baseName, unless the ref ends with a number,
 * in which case the whole ref is returned, with slashes turned into
 * underscores.
 */
export function getRefName(ref: string) {
  const base = getRefBasename(ref);
  if (/^\d+/.test(base)) {
    return refPathToPropertyPath(ref).join("_");
  }
  return base;
}

export function isURL(str: string) {
  return /^https?:\/\//.test(str);
}

export function mergeURL(url: string, ...parts: string[]) {
  const origin = new URL(url).origin;
  const paths = parts
    .map((part) => part.replace(/^\/+/, ""))
    .map((part, i) =>
      i === parts.length - 1 ? part : part.replace(/\/+$/, "")
    );
  return [origin, ...paths].join("/");
}

export type Formatter = "json" | "urlencoded" | "multipart" | "raw";

const contentType2Formatter: Record<string, Formatter> = {
  "application/json": "json",
  "application/x-www-form-urlencoded": "urlencoded",
  "multipart/form-data": "multipart",
};

export function getBodyFormatter(body?: OpenAPIV3.RequestBodyObject) {
  if (body?.content) {
    for (const contentType of Object.keys(body.content)) {
      const formatter = contentType2Formatter[contentType];
      if (formatter) return formatter;
    }
  }
  return "raw";
}

export function isStringOrNumberArray(
  list: any[]
): list is (string | number)[] {
  return list.every((i) => isNumber(i) || isString(i));
}
