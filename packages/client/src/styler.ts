// typeof undefined, bigint,boolean,number,,string,  symbol,function,object
const qencoder = (v: any) => encodeURIComponent(String(v));
const kvencoder = (vs: [string, any]) => vs.map(qencoder) as [string, string];

/**
 * merge query params
 */
export function query(...params: (string | undefined)[]) {
  const s = params.filter(Boolean).join("&");
  return s && `?${s}`;
}

/**
 * path
 * Path-style parameters, semicolon-prefixed
 * [RFC6570](https://tools.ietf.org/html/rfc6570#section-3.2.7)
 */
export function matrix(name: string, value: unknown, explode?: boolean) {
  switch (typeof value) {
    case "symbol":
    case "function":
    case "undefined":
      return;

    case "bigint":
    case "number":
    case "boolean":
    case "string":
      return `;${name}=${qencoder(value)}`;

    case "object":
      if (value === null) {
        return;
      }

      if (Array.isArray(value)) {
        if (!value.length) {
          return;
        }

        const result = value.map(qencoder);
        if (explode) {
          return `;${result.map((v) => `${name}=${v}`).join(";")}`;
        }
        return `;${name}=${value.join(",")}`;
      }

      let result = Object.entries(value);
      if (!result.length) {
        return;
      }

      result = result.map(kvencoder);
      if (explode) {
        return `;${result.map(([k, v]) => `${k}=${v}`).join(";")}`;
      }
      return `;${name}=${result.map(([k, v]) => `${k},${v}`).join(",")}`;
  }
}

/**
 * path
 * Label expansion, dot-prefixed
 * [RFC6570](https://tools.ietf.org/html/rfc6570#section-3.2.5)
 */
export function label(value: unknown, explode?: boolean) {
  switch (typeof value) {
    case "symbol":
    case "function":
    case "undefined":
      return;

    case "bigint":
    case "number":
    case "boolean":
    case "string":
      return `.${qencoder(value)}`;

    case "object":
      if (value === null) {
        return;
      }

      const delimiter = explode ? "." : ",";
      if (Array.isArray(value)) {
        if (!value.length) {
          return;
        }

        return `.${value.map(qencoder).join(delimiter)}`;
      }

      const result = Object.entries(value);
      if (!result.length) {
        return;
      }

      const kv = explode ? "=" : ",";
      return `.${result
        .map(kvencoder)
        .map(([k, v]) => `${k}${kv}${v}`)
        .join(delimiter)}`;
  }
}

/**
 * path, header
 * Reserved expansion with value modifiers
 * [RFC6570](https://tools.ietf.org/html/rfc6570#section-3.2.2)
 */
export function simple(value: unknown, explode?: boolean) {
  switch (typeof value) {
    case "symbol":
    case "function":
    case "undefined":
      return;

    case "bigint":
    case "number":
    case "boolean":
    case "string":
      return `${qencoder(value)}`;

    case "object":
      if (value === null) {
        return;
      }

      if (Array.isArray(value)) {
        if (!value.length) {
          return;
        }
        return `${value.map(qencoder).join(",")}`;
      }

      const result = Object.entries(value);
      if (!result.length) {
        return;
      }

      const kv = explode ? "=" : ",";
      return `${result
        .map(kvencoder)
        .map(([k, v]) => `${k}${kv}${v}`)
        .join(",")}`;
  }
}

/**
 * query
 * deep object
 */
export function deep(name: string, value: unknown): string | undefined {
  switch (typeof value) {
    case "symbol":
    case "function":
    case "undefined":
      return;

    case "bigint":
    case "number":
    case "boolean":
    case "string":
      return `${name}=${qencoder(value)}`;

    case "object":
      if (value === null) {
        return;
      }

      const result = Object.entries(value);
      if (!result.length) {
        return;
      }

      return result
        .map(([k, v]) => {
          const key = `${name}[${k}]`;
          return deep(key, v);
        })
        .filter((s) => s !== undefined)
        .join("&");
  }
}

/**
 * form
 * [RFC6570]https://tools.ietf.org/html/rfc6570#section-3.2.8
 */
function delimited(delimiter: string) {
  return (name: string, value: unknown, explode?: boolean) => {
    switch (typeof value) {
      case "symbol":
      case "function":
      case "undefined":
        return;

      case "bigint":
      case "number":
      case "boolean":
      case "string":
        return `${name}=${qencoder(value)}`;

      case "object":
        if (value === null) {
          return;
        }

        if (Array.isArray(value)) {
          if (!value.length) {
            return;
          }

          const result = value.map(qencoder);
          if (explode) {
            return `${result.map((v) => `${name}=${v}`).join("&")}`;
          }
          return `${name}=${result.join(delimiter)}`;
        }

        let result = Object.entries(value);
        if (!result.length) {
          return;
        }

        result = result.map(kvencoder);
        if (explode) {
          return `${result.map(([k, v]) => `${k}=${v}`).join("&")}`;
        }
        return `${name}=${result
          .map(([k, v]) => `${k}${delimiter}${v}`)
          .join(delimiter)}`;
    }
  };
}

// query
export const form = delimited(",");

// query
export const space = delimited("%20");

// query
export const pipe = delimited("|");

// query
export function json(name: string, value: unknown) {
  switch (typeof value) {
    case "symbol":
    case "function":
    case "undefined":
      return;

    case "bigint":
    case "number":
    case "boolean":
    case "string":
    case "object":
      return `${name}=${qencoder(JSON.stringify(value))}`;
  }
}
