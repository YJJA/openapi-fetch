import type { ClientRequestConfig } from "./types.js";

export function raw(
  config: ClientRequestConfig<any>
): ClientRequestConfig<any> {
  return config;
}

export function json({
  body,
  ...config
}: ClientRequestConfig<Record<string, any>>): ClientRequestConfig<string> {
  return {
    ...config,
    body: JSON.stringify(body ?? {}),
    headers: {
      ...config.headers,
      "Content-Type": "application/json",
    },
  };
}

export function urlencoded({
  body,
  ...config
}: ClientRequestConfig<
  Record<string, any>
>): ClientRequestConfig<URLSearchParams> {
  let envURLSearchParams = config.env?.URLSearchParams ?? URLSearchParams;
  const searchParams = new envURLSearchParams();
  Object.entries(body ?? {}).forEach(([name, value]) => {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((val) => {
      searchParams.append(name, val);
    });
  });
  return { ...config, body: searchParams };
}

export function multipart({
  body,
  ...config
}: ClientRequestConfig<Record<string, any>>): ClientRequestConfig<FormData> {
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
