#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { Ajv } from "ajv";
import { ApiCompiler } from "./ApiCompiler.ts";
import { paths } from "./paths.ts";
import type { ApiConfig } from "./types.ts";
import JsonSchema from '../json-schema.json' with {type: 'json'}

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

const ajv = new Ajv({ validateSchema: false });
const validate = ajv.compile(JsonSchema);
const valid = validate(configJson);

if (!valid) {
  console.error(".openapi-fetch.json file validate fail");
  validate.errors?.forEach((err) => {
    console.warn(err.message);
  });
  process.exit(1);
}

await new ApiCompiler(configJson).compile();
