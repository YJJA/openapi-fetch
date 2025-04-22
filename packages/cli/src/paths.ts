import fs from "node:fs";
import path from "node:path";
import { GEN_CONFIG_FILE_NAME, GEN_PACKAGE_NAME } from "./constants.ts";

const rootDir = fs.realpathSync(process.cwd());
const resolveApp = (...paths: string[]) => path.resolve(rootDir, ...paths);

const packageRoot = resolveApp("node_modules", GEN_PACKAGE_NAME);

const resolvePackage = (...paths: string[]) =>
  path.resolve(packageRoot, ...paths);

export const paths = {
  resolvePackage,
  packageRoot,
  configJsonFile: resolveApp(GEN_CONFIG_FILE_NAME),
  packageJsonFile: resolveApp("node_modules", GEN_PACKAGE_NAME, "package.json"),
};
