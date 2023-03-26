import { isNil, isFullObject } from "payload-is";
import { HttpError } from "./HttpError.js";
import type { ClientRequestConfig } from "./types.js";

type ClientRequestConfigKey = keyof ClientRequestConfig;

type ValueMergeFun<T> = (a?: T, b?: T) => T;

type ValueMergeMap<T> = {
  [P in keyof T]-?: ValueMergeFun<T[P]>;
};

export function mergeConfig<T = any>(
  ...configs: (ClientRequestConfig<T> | undefined)[]
) {
  function simpleMerge<V>(a: V, b: V) {
    return isNil(b) ? a : b;
  }

  function objectMerge<V>(a: V, b: V) {
    if (!isFullObject(b)) {
      return a;
    }
    if (!isFullObject(a)) {
      return b;
    }
    return { ...a, ...b };
  }

  const mergeMap: ValueMergeMap<ClientRequestConfig> = {
    baseURL: simpleMerge,
    method: simpleMerge,
    headers: objectMerge,
    body: simpleMerge,
    signal: simpleMerge,
    timeout: simpleMerge,
    timeoutErrorMessage: simpleMerge,
    security: simpleMerge,
    env: objectMerge,
  };

  function merge<R extends ClientRequestConfig<T>>(a: R, b?: R): R {
    if (isFullObject(b)) {
      const keys = Object.keys(b) as ClientRequestConfigKey[];
      keys.forEach((key) => {
        const merge = mergeMap[key];
        const value = merge(a[key], b[key]);
        if (!isNil(value)) {
          a[key] = value;
        }
      });
    }
    return a;
  }

  return configs.reduce<ClientRequestConfig<T>>((result, item) => {
    return merge(result, item);
  }, {});
}

export function joinUrl(...parts: Array<string | undefined>) {
  return parts
    .filter(Boolean)
    .map((s, i) => (i === 0 ? s : s!.replace(/^\/+/, "")))
    .map((s, i, a) => (i === a.length - 1 ? s : s!.replace(/\/+$/, "")))
    .join("/");
}

export function isHttpError(err: any) {
  return err instanceof HttpError;
}
