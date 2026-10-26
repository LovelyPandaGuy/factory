#!/usr/bin/env node
// Plays the other person in journeys like B12: while running, the test people
// accept any invite the test account sends them, as a real person would.
// Started and stopped by scripts/e2e.sh around the flows that need it.
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

const people = [];
for (const key of ["ALEX", "JORDAN", "TAYLOR", "SAM"]) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({
    email: env[`${key}_EMAIL`],
    password: env[`${key}_PASSWORD`],
  });
  if (!error) people.push({ key, sb, uid: env[`${key}_UID`] });
}

const stop = Date.now() + 10 * 60 * 1000; // never outlive a flow by much
while (Date.now() < stop) {
  for (const p of people) {
    const { data } = await p.sb
      .from("friend_requests")
      .select("uid")
      .eq("target_uid", p.uid)
      .eq("sender_id", env.ME_UID)
      .eq("state", "pending");
    for (const row of data ?? []) {
      // Give the app a moment to show "Invite sent" first, like a person would.
      await new Promise((r) => setTimeout(r, 2000));
      await p.sb.from("friend_requests").update({ state: "accepted" }).eq("uid", row.uid);
      console.log(`${p.key} accepted an invite`);
    }
  }
  await new Promise((r) => setTimeout(r, 1500));
}
