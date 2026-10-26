export const QUESTIONS = [
  {
    key: "problem",
    q: "What is wrong today? One sentence.",
    hint: "the problem, not the solution",
  },
  {
    key: "who",
    q: "Who feels it, and what do they do instead right now?",
    hint: "the person, not the department",
  },
  {
    key: "outcome",
    q: "How will you know it works? Name one result you can check.",
    hint: "the booking exists, the message arrives, the file is in storage",
  },
  {
    key: "never",
    q: "What must never break while we change this?",
    hint: "the thing you would be called about",
  },
  {
    key: "people",
    q: "Who else sees or depends on this?",
    hint: "a second account, an admin, a client, a funder",
  },
  {
    key: "states",
    q: "Which situations worry you?",
    hint: "offline, slow, two people at once, no permission, small screen",
  },
  {
    key: "out",
    q: "What is out of scope for this change?",
    hint: "what we are deliberately not doing",
  },
];

// Asks each question in turn. Only "problem" must be answered; the rest may be skipped.
export async function askList(rl, questions, { log = () => {} } = {}) {
  const answers = {};
  for (const item of questions) {
    log("");
    log(item.q);
    if (item.hint) log(`(${item.hint})`);
    let answer = "";
    while (!answer) {
      answer = (await rl.question("> ")).trim();
      if (!answer) {
        if (item.key === "problem") {
          log("One sentence is enough. The spec needs a problem.");
          continue;
        }
        break;
      }
    }
    answers[item.key] = answer;
  }
  return answers;
}

export function askQuestions(rl, options = {}) {
  return askList(rl, QUESTIONS, options);
}
