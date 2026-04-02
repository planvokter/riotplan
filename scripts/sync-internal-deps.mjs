#!/usr/bin/env node
/**
 * Set every scoped @planvokter dependency range to ^<root version> under packages/ (each package.json).
 * Run after npm version with workspaces so linking still resolves (npm prerelease semver is strict).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootPkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const v = rootPkg.version;
if (!v) {
  console.error("Root package.json has no version");
  process.exit(1);
}
const range = `^${v}`;
const pkgRoot = path.join(root, "packages");
let updated = 0;

for (const dir of fs.readdirSync(pkgRoot)) {
  const p = path.join(pkgRoot, dir, "package.json");
  if (!fs.existsSync(p)) continue;
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  let touched = false;
  for (const sec of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
    if (!j[sec]) continue;
    for (const [name, cur] of Object.entries(j[sec])) {
      if (!name.startsWith("@planvokter/")) continue;
      if (typeof cur !== "string") continue;
      if (j[sec][name] === range) continue;
      j[sec][name] = range;
      touched = true;
    }
  }
  if (touched) {
    fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n");
    updated++;
  }
}

console.log(`Root version ${v} → internal deps ${range} in ${updated} package(s)`);
