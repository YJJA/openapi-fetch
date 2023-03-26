import { HttpError } from "./HttpError.js";
import { joinUrl, mergeConfig } from "./utils.js";
import type {
  ClientRequestConfig,
  ClientResponse,
  TransformPlugin,
} from "./types.js";

export class Client {
  private plugins: TransformPlugin[] = [];
  public defaults: ClientRequestConfig = {};

  constructor(defaults: ClientRequestConfig = {}) {
    this.defaults = defaults;
  }

  private async transform(config: ClientRequestConfig) {
    let result: ClientRequestConfig = mergeConfig(this.defaults, config);
    for await (const service of this.plugins) {
      result = await service.transform(result);
    }
    return result;
  }

  use(plugin: TransformPlugin) {
    this.plugins.push(plugin);
  }

  disuse(plugin: TransformPlugin) {
    this.plugins = this.plugins.filter((p) => p === plugin);
  }

  async request(url: string, config: ClientRequestConfig) {
    const cfg = await this.transform(config);
    let fullURL = joinUrl(cfg.baseURL, url);
    let envFetch = cfg.env?.fetch ?? fetch;

    let signal = cfg.signal;
    let abortController: AbortController | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    function abort() {
      const message = cfg.timeoutErrorMessage ?? "signal timed out";
      abortController?.abort(new DOMException(message, "TimeoutError"));
    }

    function clear() {
      clearTimeout(timeoutId);
    }

    if ("AbortController" in window && cfg.timeout) {
      abortController = new AbortController();
      signal = abortController.signal;
      timeoutId = setTimeout(abort, cfg.timeout);
      cfg.signal?.addEventListener("abort", clear);
    }

    const response = await envFetch(fullURL, {
      headers: this.getHeaders(cfg.headers),
      method: cfg.method,
      body: cfg.body,
      signal: signal,
    });

    if (cfg.timeout) {
      clearTimeout(timeoutId);
      cfg.signal?.removeEventListener("abort", clear);
    }

    if (!response.ok) {
      let data: any = await response.text();
      try {
        data = JSON.parse(data);
      } catch {}
      throw new HttpError(response.status, data, cfg, response);
    }

    return response;
  }

  async fetchJson<T>(url: string, config: ClientRequestConfig) {
    const response = await this.request(url, {
      ...config,
      headers: { Accept: "application/json", ...config.headers },
    });
    const data: T = await response.json();
    return this.getResponse(response, data);
  }

  async fetchText(url: string, config: ClientRequestConfig) {
    const response = await this.request(url, config);
    const data = await response.text();
    return this.getResponse(response, data);
  }

  async fetchBlob(url: string, config: ClientRequestConfig) {
    const response = await this.request(url, config);
    const data = await response.blob();
    return this.getResponse(response, data);
  }

  json({ body, ...config }: ClientRequestConfig<Record<string, any>>) {
    return {
      ...config,
      body: JSON.stringify(body ?? {}),
      headers: {
        ...config.headers,
        "Content-Type": "application/json",
      },
    };
  }

  urlencoded({ body, ...config }: ClientRequestConfig<Record<string, any>>) {
    const searchParams = new URLSearchParams();
    Object.entries(body ?? {}).forEach(([name, value]) => {
      const values = Array.isArray(value) ? value : [value];
      values.forEach((val) => {
        searchParams.append(name, val);
      });
    });
    return { ...config, body: searchParams };
  }

  multipart({ body, ...config }: ClientRequestConfig<Record<string, any>>) {
    let envFormData = config.env?.FormData ?? FormData;
    const formData = new envFormData();
    Object.entries(body ?? {}).forEach(([name, value]) => {
      const values = Array.isArray(value) ? value : [value];
      values.forEach((val) => {
        formData.append(name, val);
      });
    });
    return { ...config, body: formData };
  }

  private getResponse<T>(response: Response, data: T): ClientResponse<T> {
    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data,
    };
  }

  private getHeaders(configHeaders?: ClientRequestConfig["headers"]) {
    const headers = new Headers();
    Object.entries(configHeaders ?? {}).forEach(([name, value]) => {
      if (typeof value !== "undefined") {
        headers.append(name, value);
      }
    });
    return headers;
  }
}
