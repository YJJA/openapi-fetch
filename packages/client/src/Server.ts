import { isFullObject, isString, isBoolean, isNumber } from "payload-is";
import { joinUrl } from "./utils.js";

export type ServerConfigMap<T> = {
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

export class Server<T extends readonly unknown[] | []> {
  protected url?: string;
  configs: ServerConfigMap<T>;

  constructor(configs: ServerConfigMap<T>) {
    this.configs = configs;
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

  public setServer<K extends TupleIndices<T>>(index: K, variables?: T[K]) {
    this.url = this.generateServerUrl(index, variables);
  }

  public setServerUrl(url: string) {
    this.url = url;
  }

  public getUrl() {
    return this.url;
  }

  public path(path: string) {
    return joinUrl(this.url, path);
  }
}
