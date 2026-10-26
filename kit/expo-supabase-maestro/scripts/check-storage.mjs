#!/usr/bin/env node
// Checks the live storage rules with two test accounts (no real user's files
// are touched). Exit 0 = voice notes upload and nobody can change another
// person's files. Needs .maestro/.phone-accounts.env (see seed-test-accounts).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".maestro/.phone-accounts.env"), "utf8")
    .split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const cfg = readFileSync(join(root, "config/supabaseConfig.ts"), "utf8");
const URL = cfg.match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0];
const KEY = cfg.match(/sb_publishable_[A-Za-z0-9_-]+/)[0];
const BUCKET = "app-user-assets";

async function bucketFor(key) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  await sb.auth.signInWithPassword({ email: env[`${key}_EMAIL`], password: env[`${key}_PASSWORD`] });
  return sb.storage.from(BUCKET);
}

const alex = await bucketFor("ALEX");
const jordan = await bucketFor("JORDAN");
const stamp = Date.now();
let failed = 0;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed++;
};

const voiceKey = `${env.ALEX_UID}/voice/check-${stamp}.m4a`;
const voice = await alex.upload(voiceKey, new Uint8Array(1024), { contentType: "audio/mp4" });
check(!voice.error, `voice note uploads${voice.error ? ` (${voice.error.message})` : ""}`);

const fileKey = `${env.ALEX_UID}/check-${stamp}.txt`;
await alex.upload(fileKey, "alex", { contentType: "text/plain" });
await jordan.upload(fileKey, "jordan", { contentType: "text/plain", upsert: true });
const { data } = await alex.download(fileKey);
check((data ? await data.text() : "") === "alex", "another user cannot overwrite your file");
const removed = await jordan.remove([fileKey]);
check(!removed.data?.length, "another user cannot delete your file");

await alex.remove([voiceKey, fileKey]);
process.exit(failed ? 1 : 0);
