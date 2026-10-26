#!/usr/bin/env node
// Test people for the Maestro journey flows, on the live Supabase project.
//
//   node scripts/seed-test-accounts.mjs            # create or refresh
//   node scripts/seed-test-accounts.mjs --remove   # delete their data
//
// Everyone is named "... (Test)" and stands on Bouvet Island (uninhabited,
// South Atlantic), so no real person is ever near them on the radar. Flows set
// the simulator to the same spot. Passwords are written only to
// .maestro/.test-accounts.env, which git ignores. Auto-confirm is on for this
// project, so sign-up needs no email.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// SET=phone: a separate set for testing by hand on a real phone. It never
// moves the phone account's own location, and puts the people around the
// phone's last real position instead of on Bouvet Island.
const PHONE_SET = process.env.SET === "phone";
const envFile = join(
  root,
  PHONE_SET ? ".maestro/.phone-accounts.env" : ".maestro/.test-accounts.env",
);
const config = readFileSync(join(root, "config/supabaseConfig.ts"), "utf8");
const URL = config.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0];
const KEY = config.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
if (!URL || !KEY) throw new Error("Supabase URL or key not found in config");

// Bouvet Island. Offsets of ~0.0002 degrees are about 20 m.
export const TEST_LAT = -54.4208;
export const TEST_LNG = 3.3464;

const PEOPLE = {
  ME: { name: "Tester", surname: "Pilot (Test)", gender: "M", dLat: 0, dLng: 0 },
  ALEX: { name: "Alex", surname: "Mokoena (Test)", gender: "M", dLat: 0.0002, dLng: 0, purpose: "Friendship" },
  JORDAN: { name: "Jordan", surname: "Nkosi (Test)", gender: "F", dLat: 0, dLng: 0.0003, purpose: "Friendship" },
  TAYLOR: { name: "Taylor", surname: "Smith (Test)", gender: "F", dLat: -0.0002, dLng: 0, purpose: "Open to meet" },
  // Different purposes so the radar's filters (Everyone / Networking / ...) show.
  SAM: { name: "Sam", surname: "Dlamini (Test)", gender: "M", dLat: 0, dLng: -0.0003, purpose: "Networking" },
};

function readEnv() {
  if (!existsSync(envFile)) return {};
  return Object.fromEntries(
    readFileSync(envFile, "utf8")
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

function client() {
  return createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signInOrUp(key, env) {
  const email =
    env[`${key}_EMAIL`] ??
    `factory.${PHONE_SET ? "phone" : "e2e"}.${key.toLowerCase()}@example.com`;
  const password =
    env[`${key}_PASSWORD`] ??
    (PHONE_SET && key === "ME" ? "Pilot1234!" : randomBytes(18).toString("base64url"));
  const sb = client();
  let { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    ({ data, error } = await sb.auth.signUp({ email, password }));
    if (error) throw new Error(`${key}: sign-up failed: ${error.message}`);
    if (!data.session) throw new Error(`${key}: no session after sign-up`);
  }
  return { sb, uid: data.user.id, email, password };
}

function newId() {
  return `${Date.now().toString(36)}-${randomBytes(5).toString("hex")}`;
}

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function phoneBase(env) {
  const me = await signInOrUp("ME", env);
  const { data } = await me.sb
    .from("user_location")
    .select("latitude, longitude")
    .eq("uid", me.uid)
    .maybeSingle();
  return data ? [data.latitude, data.longitude] : null;
}

async function seed() {
  const env = readEnv();
  const acc = {};
  const base = PHONE_SET ? await phoneBase(env) : [TEST_LAT, TEST_LNG];
  if (PHONE_SET && !base) {
    console.log("Phone account ready. Sign in on the phone, open the radar, then run this again.");
  }
  for (const [key, p] of Object.entries(PEOPLE)) {
    const a = await signInOrUp(key, env);
    acc[key] = a;
    await must(
      `${key} profile`,
      a.sb.from("user_profile").upsert(
        {
          uid: a.uid,
          name: p.name,
          surname: p.surname,
          email: a.email,
          gender: p.gender,
          purpose: p.purpose ?? "Friendship",
          occupation: "Student",
          date_of_birth: "1995-01-01T00:00:00.000Z",
          about_me: "Test account for automated checks.",
          last_modified: new Date().toISOString(),
        },
        { onConflict: "uid" },
      ),
    );
    // The phone account's location comes from the phone itself.
    if (base && !(PHONE_SET && key === "ME")) {
      await must(
        `${key} location`,
        a.sb.rpc("upsert_my_location", {
          p_latitude: base[0] + p.dLat,
          p_longitude: base[1] + p.dLng,
        }),
      );
    }
  }

  const me = acc.ME;
  // Clear earlier relationships between the test people so every run starts the same.
  for (const [key, a] of Object.entries(acc)) {
    if (key === "ME") continue;
    for (const [from, to] of [
      [me, a],
      [a, me],
    ]) {
      await from.sb
        .from("friend_requests")
        .delete()
        .eq("sender_id", from.uid)
        .eq("target_uid", to.uid);
    }
  }
  for (const a of Object.values(acc)) {
    await a.sb.from("blocked_users").delete().eq("blocked_by", a.uid);
  }
  // Only Alex and I are chatting. Chats a flow started with anyone else
  // (B12 connects me and Sam) are removed so every flow starts the same.
  for (const key of ["JORDAN", "TAYLOR", "SAM"]) {
    const [pa, pb] = [me.uid, acc[key].uid].sort();
    await me.sb
      .from("conversations")
      .delete()
      .eq("participant_a", pa)
      .eq("participant_b", pb);
  }

  // Jordan has invited me.
  await must(
    "Jordan invites me",
    acc.JORDAN.sb.from("friend_requests").insert({
      uid: newId(),
      sender_id: acc.JORDAN.uid,
      target_uid: me.uid,
      purpose: "friendship",
      state: "pending",
      created_at: new Date().toISOString(),
    }),
  );
  // I have invited Taylor.
  await must(
    "I invite Taylor",
    me.sb.from("friend_requests").insert({
      uid: newId(),
      sender_id: me.uid,
      target_uid: acc.TAYLOR.uid,
      purpose: "networking",
      state: "pending",
      created_at: new Date().toISOString(),
    }),
  );
  // Alex and I are connected and chatting.
  const reqId = newId();
  await must(
    "Alex invites me",
    acc.ALEX.sb.from("friend_requests").insert({
      uid: reqId,
      sender_id: acc.ALEX.uid,
      target_uid: me.uid,
      purpose: "friendship",
      state: "pending",
      created_at: new Date().toISOString(),
    }),
  );
  await must(
    "I accept Alex",
    me.sb.from("friend_requests").update({ state: "accepted" }).eq("uid", reqId),
  );
  const [pa, pb] = [me.uid, acc.ALEX.uid].sort();
  let conv = await must(
    "find chat",
    me.sb
      .from("conversations")
      .select("uid")
      .eq("participant_a", pa)
      .eq("participant_b", pb)
      .maybeSingle(),
  );
  if (!conv) {
    conv = await must(
      "create chat",
      me.sb
        .from("conversations")
        .insert({ uid: newId(), participant_a: pa, participant_b: pb, is_read: false, read_tickets: [] })
        .select("uid")
        .single(),
    );
  }
  const text = "Hi from Alex (test message)";
  const msg = await must(
    "Alex says hi",
    acc.ALEX.sb
      .from("messages")
      .insert({
        uid: newId(),
        conversation_id: conv.uid,
        sender_id: acc.ALEX.uid,
        content: text,
        type: "text",
        read_tickets: [acc.ALEX.uid],
      })
      .select("created_at")
      .single(),
  );
  await must(
    "chat summary",
    acc.ALEX.sb
      .from("conversations")
      .update({
        last_message: text,
        last_message_sender: acc.ALEX.uid,
        last_message_timestamp: msg.created_at,
        is_read: false,
        read_tickets: [acc.ALEX.uid],
      })
      .eq("uid", conv.uid),
  );

  const lines = [
    "# Test accounts for Maestro flows. Never commit this file.",
    `TEST_LAT=${TEST_LAT}`,
    `TEST_LNG=${TEST_LNG}`,
  ];
  for (const [key, a] of Object.entries(acc)) {
    lines.push(`${key}_EMAIL=${a.email}`, `${key}_PASSWORD=${a.password}`, `${key}_UID=${a.uid}`);
  }
  writeFileSync(envFile, `${lines.join("\n")}\n`, { mode: 0o600 });
  console.log(
    base
      ? `Seeded ${Object.keys(acc).length} test people at ${base[0].toFixed(4)},${base[1].toFixed(4)}.`
      : "Accounts ready; people not placed yet.",
  );
}

async function remove() {
  const env = readEnv();
  for (const key of Object.keys(PEOPLE)) {
    if (!env[`${key}_EMAIL`]) continue;
    const a = await signInOrUp(key, env);
    await a.sb.from("friend_requests").delete().eq("sender_id", a.uid);
    await a.sb.from("blocked_users").delete().eq("blocked_by", a.uid);
    await a.sb.from("conversations").delete().or(`participant_a.eq.${a.uid},participant_b.eq.${a.uid}`);
    await a.sb.rpc("hide_my_location");
    await a.sb.from("user_profile").delete().eq("uid", a.uid);
    console.log(`Removed data for ${key}. The sign-in account itself needs the Supabase admin to delete.`);
  }
}

await (process.argv.includes("--remove") ? remove() : seed());
