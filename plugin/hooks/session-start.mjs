// Tells Claude, at the start of every session, that Next-Gen Factory is installed and how to
// use it. Without this the factory's tools load on demand and a plain request can skip them.
const context = [
  "Next-Gen Factory is installed in this session.",
  "For ANY request to build, add, fix or change code: first load the factory tools (search for \"factory\"),",
  "then call factory_start with the person's request, write the spec where it says, and call factory_approve.",
  "Do not change code until the person has approved the spec through factory_approve.",
  "After building, call factory_prove until it says DONE, then factory_review.",
  "Never call work done, bug-free, secure or compliant unless the factory's checks say so.",
  "If the person asks to stop or start sharing with Next-Gen, call factory_share with their choice.",
  "If the person wants to tell Next-Gen something about the factory, call factory_feedback with their words.",
].join(" ");
process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } }));
