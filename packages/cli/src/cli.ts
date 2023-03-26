#!/usr/bin/env node

import * as fs from "node:fs";
import * as path from "node:path";
import { Validator } from "@cfworker/json-schema";
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

const validator = new Validator({
  $id: "https://raw.githubusercontent.com/YJJA/openapi-fetch/main/json-schema.json",
});
const result = validator.validate(configJson);

if (!result.valid) {
  console.error(".openapi-fetch.json file parse fail");
  result.errors.forEach((err) => {
    console.warn(err.error);
  });
  process.exit(1);
}

await new ApiCompiler(configJson).compile();
