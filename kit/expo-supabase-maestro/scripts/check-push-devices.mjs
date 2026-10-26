#!/usr/bin/env node
// Checks that a phone gets the notifications of whoever signed in last, using
// the same save the app makes (user_device upsert). Two test accounts and a
// made-up phone; nothing of a real user is touched. Exit 0 = pass.
// Needs .maestro/.phone-accounts.env (see seed-test-accounts).
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

async function signIn(key) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  await sb.auth.signInWithPassword({ email: env[`${key}_EMAIL`], password: env[`${key}_PASSWORD`] });
  return { sb, uid: env[`${key}_UID`] };
}

const alex = await signIn("ALEX");
const jordan = await signIn("JORDAN");
const stamp = Date.now();
const phone = `check-phone-${stamp}`;
const token = `ExponentPushToken[check-${stamp}]`;
let failed = 0;
const check = (ok, label) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) failed++;
};

// What the app does after sign-in (lib/supabasePush.ts updatePushToken).
const register = (who, pushToken = token) =>
  who.sb.from("user_device").upsert(
    { user_id: who.uid, device_id: phone, expo_push_token: pushToken },
    { onConflict: "user_id,device_id" },
  );
const owns = async (who) =>
  (await who.sb.from("user_device").select("device_id").eq("device_id", phone)).data?.length === 1;

try {
  let r = await register(alex);
  check(!r.error && (await owns(alex)), `Alex registers the phone${r.error ? ` (${r.error.message})` : ""}`);

  // Alex never signed out (the 2.0.0 app never removes the row); Jordan signs in.
  r = await register(jordan);
  check(!r.error, `Jordan can register the same phone${r.error ? ` (${r.error.message})` : ""}`);
  check(await owns(jordan), "the phone now gets Jordan's notifications");
  check(!(await owns(alex)), "the phone no longer gets Alex's notifications");

  // Back to Alex, with a fresh token (app reinstalled).
  r = await register(alex, `ExponentPushToken[check-${stamp}-b]`);
  check(!r.error && (await owns(alex)) && !(await owns(jordan)), "switching back to Alex hands the phone back");
} finally {
  await alex.sb.from("user_device").delete().eq("device_id", phone);
  await jordan.sb.from("user_device").delete().eq("device_id", phone);
}

process.exit(failed ? 1 : 0);
