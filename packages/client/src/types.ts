export type ClientRequestConfig<D = any> = {
  baseURL?: string;
  method?: string;
  headers?: Record<string, string | undefined>;
  body?: D;
  signal?: AbortSignal;
  timeout?: number;
  timeoutErrorMessage?: string;
  security?: string[];
  env?: {
    fetch: typeof fetch;
    FormData: typeof FormData;
  };
};

export type ClientResponse<T> = {
  status: number;
  statusText: string;
  data: T;
  headers: Headers;
};

export type GetToken<T> = T | (() => T | Promise<T>);

export type TokenLocation = "header" | "query";

export type BasicTokenType = {
  username: string;
  password: string;
};

export abstract class TransformPlugin {
  abstract transform(
    config: ClientRequestConfig
  ): ClientRequestConfig | Promise<ClientRequestConfig>;
}
