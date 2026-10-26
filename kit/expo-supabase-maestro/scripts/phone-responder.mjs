#!/usr/bin/env node
// While you test on a phone: the phone test people accept your invites and
// reply to your messages, like real people would. They also stay "seen" on the
// radar (it hides anyone not seen for 2 hours). Stops after an hour.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
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
const id = () => `${Date.now().toString(36)}-${randomBytes(5).toString("hex")}`;
const testUids = new Set(["ME", "ALEX", "JORDAN", "TAYLOR", "SAM"].map((k) => env[`${k}_UID`]));

const people = [];
for (const key of ["ALEX", "JORDAN", "TAYLOR", "SAM"]) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  await sb.auth.signInWithPassword({ email: env[`${key}_EMAIL`], password: env[`${key}_PASSWORD`] });
  people.push({ key, sb, uid: env[`${key}_UID`], name: key[0] + key.slice(1).toLowerCase() });
}
const answered = new Set();
const stop = Date.now() + 60 * 60 * 1000;

// Re-send each person's current spot (same place, so the anti-spoofing speed
// check passes) to keep them on the radar.
let freshAt = 0;
async function keepSeen() {
  if (Date.now() - freshAt < 20 * 60 * 1000) return;
  freshAt = Date.now();
  for (const p of people) {
    const { data: at } = await p.sb.from("user_location").select("latitude, longitude").eq("uid", p.uid).maybeSingle();
    if (!at) continue;
    const { error } = await p.sb.rpc("upsert_my_location", { p_latitude: at.latitude, p_longitude: at.longitude });
    console.log(`${p.name} ${error ? `NOT refreshed (${error.message})` : "seen"}`);
  }
}

while (Date.now() < stop) {
  await keepSeen();
  for (const p of people) {
    // Accept invites from real people (after a moment, like a person would).
    const { data: invites } = await p.sb.from("friend_requests").select("uid, sender_id")
      .eq("target_uid", p.uid).eq("state", "pending");
    for (const r of invites ?? []) {
      if (testUids.has(r.sender_id) || answered.has(r.uid)) continue;
      answered.add(r.uid);
      await new Promise((res) => setTimeout(res, 3000));
      await p.sb.from("friend_requests").update({ state: "accepted" }).eq("uid", r.uid);
      console.log(`${p.name} accepted an invite`);
    }
    // Reply to the newest message from a real person in each chat.
    const { data: convs } = await p.sb.from("conversations")
      .select("uid, participant_a, participant_b, last_message, last_message_sender")
      .or(`participant_a.eq.${p.uid},participant_b.eq.${p.uid}`);
    for (const c of convs ?? []) {
      if (!c.last_message_sender || testUids.has(c.last_message_sender)) continue;
      const key = `${c.uid}:${c.last_message}`;
      if (answered.has(key)) continue;
      answered.add(key);
      await new Promise((res) => setTimeout(res, 2000));
      const text = `${p.name} (test): got "${(c.last_message ?? "").slice(0, 40)}"`;
      const { data: m } = await p.sb.from("messages").insert({
        uid: id(), conversation_id: c.uid, sender_id: p.uid, content: text, type: "text", read_tickets: [p.uid],
      }).select("created_at").single();
      await p.sb.from("conversations").update({
        last_message: text, last_message_sender: p.uid, last_message_timestamp: m?.created_at,
        is_read: false, read_tickets: [p.uid],
      }).eq("uid", c.uid);
      console.log(`${p.name} replied`);
    }
  }
  await new Promise((res) => setTimeout(res, 2500));
}
