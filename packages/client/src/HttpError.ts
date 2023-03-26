import type { ClientRequestConfig } from "./types.js";

export class HttpError extends Error {
  data: any;
  config: ClientRequestConfig;
  response: Response;
  constructor(
    status: number,
    data: any,
    config: ClientRequestConfig,
    response: Response
  ) {
    super(`RequestError: ${status}`);
    this.data = data;
    this.config = config;
    this.response = response;
  }
}
