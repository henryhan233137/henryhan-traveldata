import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const configPath = path.join(projectRoot, "dist/server/wrangler.json");
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();

if (!databaseId) {
  throw new Error("CLOUDFLARE_D1_DATABASE_ID is required and must be supplied outside Git.");
}

const config = JSON.parse(await readFile(configPath, "utf8"));
config.name = "henryhan-traveldata";
config.d1_databases = [
  {
    binding: "DB",
    database_name: "henryhan-traveldata",
    database_id: databaseId,
  },
];

await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log("Prepared ignored Cloudflare deployment output with the production D1 binding.");
