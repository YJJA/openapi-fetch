import { isUndefined } from "payload-is";
import {
  BasicToken,
  BearerToken,
  HeaderToken,
  QueryToken,
  Token,
} from "./Token.js";
import { mergeConfig } from "./utils.js";
import type {
  BasicTokenType,
  ClientRequestConfig,
  TransformPlugin,
  GetToken,
} from "./types.js";

export class Security implements TransformPlugin {
  private tokenMap = new Map<any, Token<any>>();

  public setToken(securityName: string, token: Token<any>) {
    this.tokenMap.set(securityName, token);
  }

  public setBasicToken(securityName: string, token: GetToken<BasicTokenType>) {
    this.setToken(securityName, new BasicToken(token));
  }

  public setBearerToken(securityName: string, token: GetToken<string>) {
    this.setToken(securityName, new BearerToken(token));
  }

  public setHeaderToken(
    securityName: string,
    name: string,
    token: GetToken<string>
  ) {
    this.setToken(securityName, new HeaderToken(name, token));
  }

  public setQueryToken(
    securityName: string,
    name: string,
    token: GetToken<string>
  ) {
    this.setToken(securityName, new QueryToken(name, token));
  }

  private async getSecurityConfig(
    securityName: string
  ): Promise<ClientRequestConfig | undefined> {
    const token = this.tokenMap.get(securityName);
    if (isUndefined(token)) {
      return;
    }

    const value = await token.format();
    const propertyName = token.location === "header" ? "headers" : "query";
    return { [propertyName]: { [token.name]: value } };
  }

  async transform(config: ClientRequestConfig) {
    if (!config.security?.length) {
      return config;
    }

    for await (const securityName of config.security) {
      const cfg = await this.getSecurityConfig(securityName);
      if (cfg) {
        return mergeConfig(config, cfg);
      }
    }

    return config;
  }
}
