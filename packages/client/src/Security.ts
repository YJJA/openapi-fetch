import { isUndefined } from "payload-is";
import { BasicToken, BearerToken, ApiKeyToken, Token } from "./Token.js";
import type { BasicTokenType, GetToken } from "./types.js";

export class Security {
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

  public setApiKeyToken(securityName: string, token: GetToken<string>) {
    this.setToken(securityName, new ApiKeyToken(token));
  }

  public async token(securityName: string) {
    const token = this.tokenMap.get(securityName);
    if (isUndefined(token)) {
      return;
    }
    return await token.format();
  }
}
