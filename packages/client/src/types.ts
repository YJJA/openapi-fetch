export type ClientRequestConfig<D = any> = {
  method?: string;
  headers?: Record<string, string | undefined>;
  body?: D;
  signal?: AbortSignal;
  timeout?: number;
  timeoutErrorMessage?: string;
  env?: {
    fetch: typeof fetch;
    FormData: typeof FormData;
    URLSearchParams: typeof URLSearchParams;
  };
};

export type ClientResponse<T> = {
  status: number;
  statusText: string;
  data: T;
  headers: Headers;
};

export type GetToken<T> =
  | undefined
  | T
  | (() => undefined | T | Promise<undefined | T>);

export type TokenLocation = "header" | "query";

export type BasicTokenType = {
  username: string;
  password: string;
};
