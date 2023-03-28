import { isFunction, isUndefined } from "payload-is";
import type { BasicTokenType, GetToken } from "./types.js";

export class Token<T> {
  constructor(public readonly token: GetToken<T>) {}

  protected async getToken() {
    return isFunction(this.token) ? await this.token() : this.token;
  }

  public async format() {
    const token = await this.getToken();
    if (isUndefined(token)) {
      return;
    }
    return token as string;
  }
}

export class BasicToken extends Token<BasicTokenType> {
  constructor(token: GetToken<BasicTokenType>) {
    super(token);
  }

  override async format() {
    const token = await this.getToken();
    if (isUndefined(token)) {
      return;
    }
    const str = Buffer.from(`${token.username}:${token.password}`).toString(
      "base64"
    );
    return `Basic ${str}`;
  }
}

export class BearerToken extends Token<string> {
  constructor(token: GetToken<string>) {
    super(token);
  }

  override async format() {
    const token = await this.getToken();
    if (isUndefined(token)) {
      return;
    }
    return `Bearer ${token}`;
  }
}

export class ApiKeyToken extends Token<string> {}
