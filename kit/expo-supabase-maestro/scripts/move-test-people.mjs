#!/usr/bin/env node
// Move the four test people for hands-on testing on a real phone.
//
//   node scripts/move-test-people.mjs --to-me   # stand them ~20-30 m around
//                                               # the test account's last position
//   node scripts/move-test-people.mjs --home    # back to Bouvet Island
//
// Only with the owner's go-ahead: near a real phone, a real user within
// ~100 m could see them. Always send them home afterwards.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(join(root, ".maestro/.test-accounts.env"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const config = readFileSync(join(root, "config/supabaseConfig.ts"), "utf8");
const URL = config.match(/https:\/\/[a-z0-9]+\.supabase\.co/)[0];
const KEY = config.match(/sb_publishable_[A-Za-z0-9_-]+/)[0];

async function signIn(key) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({
    email: env[`${key}_EMAIL`],
    password: env[`${key}_PASSWORD`],
  });
  if (error) throw new Error(`${key}: ${error.message}`);
  return sb;
}

const OFFSETS = {
  ALEX: [0.0002, 0],
  JORDAN: [0, 0.0003],
  TAYLOR: [-0.0002, 0],
  SAM: [0, -0.0003],
};

let base;
if (process.argv.includes("--home")) {
  base = [Number(env.TEST_LAT), Number(env.TEST_LNG)];
} else {
  const me = await signIn("ME");
  const { data, error } = await me
    .from("user_location")
    .select("latitude, longitude, last_modified")
    .eq("uid", env.ME_UID)
    .maybeSingle();
  if (error || !data) {
    throw new Error(
      `No position for the test account yet (${error?.message ?? "no row"}). Sign in on the phone and open the radar first.`,
    );
  }
  base = [data.latitude, data.longitude];
  console.log(`Test account last seen ${data.last_modified}`);
}

for (const [key, [dLat, dLng]] of Object.entries(OFFSETS)) {
  const sb = await signIn(key);
  const { error } = await sb.rpc("upsert_my_location", {
    p_latitude: base[0] + dLat,
    p_longitude: base[1] + dLng,
  });
  console.log(`${key}: ${error ? `NOT moved (${error.message})` : "moved"}`);
}
