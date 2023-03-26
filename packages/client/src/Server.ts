import { isFullObject, isString, isBoolean, isNumber } from "payload-is";
import type { ClientRequestConfig, TransformPlugin } from "./types.js";

type ServerConfigMap<T> = {
  readonly [P in keyof T]: {
    url: string;
    variables: T[P];
  };
};

type TupleIndices<T extends readonly any[]> = Extract<
  keyof T,
  `${number}`
> extends `${infer N extends number}`
  ? N
  : never;

export class Server<T extends readonly unknown[] | []>
  implements TransformPlugin
{
  private url?: string;

  constructor(public readonly configs: ServerConfigMap<T>) {
    if (configs.length) {
      this.url = this.generateServerUrl(0);
    }
  }

  private generateServerUrl<K extends keyof T>(index: K, variables?: T[K]) {
    let url = this.configs[index].url;
    const vars = Object.assign({}, this.configs[index].variables, variables);

    if (isFullObject(vars)) {
      Object.entries(vars).forEach(([k, v]) => {
        if (isString(v) || isBoolean(v) || isNumber(v)) {
          url = url.replace(`{${k}}`, encodeURIComponent(v));
        }
      });
    }
    return url;
  }

  public setIndex<K extends TupleIndices<T>>(index: K, variables?: T[K]) {
    this.url = this.generateServerUrl(index, variables);
  }

  public setUrl(url: string) {
    this.url = url;
  }

  public getUrl() {
    return this.url;
  }

  public transform(config: ClientRequestConfig) {
    if (this.url) {
      return { ...config, baseURL: this.url };
    }
    return config;
  }
}
