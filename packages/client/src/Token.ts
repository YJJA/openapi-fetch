import { isFunction } from "payload-is";
import type { BasicTokenType, TokenLocation, GetToken } from "./types.js";

export class Token<T> {
  constructor(
    public readonly location: TokenLocation,
    public readonly name: string,
    public readonly token: GetToken<T>
  ) {}

  protected async getToken() {
    return isFunction(this.token) ? await this.token() : this.token;
  }

  public async format(): Promise<string> {
    const token = await this.getToken();
    return token as string;
  }
}

export class BasicToken extends Token<BasicTokenType> {
  constructor(token: GetToken<BasicTokenType>) {
    super("header", "Authorization", token);
  }

  override async format() {
    const { username, password } = await this.getToken();
    const token = Buffer.from(`${username}:${password}`).toString("base64");
    return `Basic ${token}`;
  }
}

export class BearerToken extends Token<string> {
  constructor(token: GetToken<string>) {
    super("header", "Authorization", token);
  }

  override async format() {
    const token = await this.getToken();
    return `Bearer ${token}`;
  }
}

export class HeaderToken extends Token<string> {
  constructor(name: string, token: GetToken<string>) {
    super("header", name, token);
  }
}

export class QueryToken extends Token<string> {
  constructor(name: string, token: GetToken<string>) {
    super("query", name, token);
  }
}
