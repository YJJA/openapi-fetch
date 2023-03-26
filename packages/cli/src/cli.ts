#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import fetch from "node-fetch";
import Ajv from "ajv";
import { ApiCompiler } from "./ApiCompiler.js";
import { paths } from "./paths.js";
import { ApiConfig } from "./types.js";

if (!fs.existsSync(paths.configJsonFile)) {
  console.warn(`Can not found '${path.basename(paths.configJsonFile)}' file`);
  process.exit(1);
}

if (fs.existsSync(paths.packageRoot)) {
  fs.rmSync(paths.packageRoot, { recursive: true, force: true });
}

const configJsonContent = await fs.promises.readFile(
  paths.configJsonFile,
  "utf8"
);
const configJson: ApiConfig = JSON.parse(configJsonContent);

async function loadSchema(url: string) {
  const response = await fetch(url);
  return (await response.json()) as any;
}

const schema = await loadSchema(
  "https://raw.githubusercontent.com/YJJA/openapi-fetch/main/json-schema.json"
);

const ajv = new Ajv({ validateSchema: false });
const validate = ajv.compile(schema);
const valid = validate(configJson);

if (!valid) {
  console.error(".openapi-fetch.json file validate fail");
  validate.errors?.forEach((err) => {
    console.warn(err.message);
  });
  process.exit(1);
}

await new ApiCompiler(configJson).compile();
