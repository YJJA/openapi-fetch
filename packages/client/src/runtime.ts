import { Server } from "./Server.js";
import { Security } from "./Security.js";
import { Token, BasicToken, BearerToken, ApiKeyToken } from "./Token.js";
import { HttpError } from "./HttpError.js";
import { isHttpError, getResponse, getHeaders } from "./utils.js";

import type {
  ClientRequestConfig,
  ClientRequestEnv,
  ClientResponse,
  BasicTokenType,
  TokenLocation,
  GetToken,
} from "./types.js";

export {
  Server,
  Security,
  Token,
  BasicToken,
  BearerToken,
  ApiKeyToken,
  ClientRequestConfig,
  ClientRequestEnv,
  ClientResponse,
  BasicTokenType,
  TokenLocation,
  GetToken,
  isHttpError,
};

export async function request(url: string, config: ClientRequestConfig) {
  let signal = config.signal;
  let abortController: AbortController | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  function abort() {
    const message = config.timeoutErrorMessage ?? "signal timed out";
    abortController?.abort(new DOMException(message, "TimeoutError"));
  }

  function clear() {
    clearTimeout(timeoutId);
  }

  if ("AbortController" in window && config.timeout) {
    abortController = new AbortController();
    signal = abortController.signal;
    timeoutId = setTimeout(abort, config.timeout);
    config.signal?.addEventListener("abort", clear);
  }

  const envFetch = config.env?.fetch ?? fetch;
  const response = await envFetch(url, {
    headers: getHeaders(config.headers),
    method: config.method,
    body: config.body,
    signal: signal,
  });

  if (config.timeout) {
    clearTimeout(timeoutId);
    config.signal?.removeEventListener("abort", clear);
  }

  if (!response.ok) {
    let data: any = await response.text();
    try {
      data = JSON.parse(data);
    } catch {}
    throw new HttpError(response.status, data, config, response);
  }

  return response;
}

export async function fetchJson<T>(url: string, config: ClientRequestConfig) {
  const response = await request(url, {
    ...config,
    headers: { Accept: "application/json", ...config.headers },
  });
  const data: T = await response.json();
  return getResponse(response, data);
}

export async function fetchText(url: string, config: ClientRequestConfig) {
  const response = await request(url, config);
  const data = await response.text();
  return getResponse(response, data);
}

export async function fetchBlob(url: string, config: ClientRequestConfig) {
  const response = await request(url, config);
  const data = await response.blob();
  return getResponse(response, data);
}
