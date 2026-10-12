#!/usr/bin/env node
// NEXORA Guardians G1: a deterministic PreToolUse gate for Claude Code.
//
// Claude Code runs this before every Bash command and every file Read/Edit/Write.
// It answers with one of three decisions, decided by code and not by a model:
//   deny  - blocked for good (exit code 2, the reason is shown to the agent)
//   ask   - a human must approve this single call, whatever the allow-list says
//   allow - nothing to say
//
// What it protects (see ops/guardians/README.md): secret files and secret values,
// irreversible git, filesystem, Docker and SQL operations, pushes to main, security
// settings on GitHub, and changes to the production host. It fails closed: if it
// cannot make sense of its input it denies.

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RANK = { allow: 0, ask: 1, deny: 2 };
const PROTECTED_BRANCHES = new Set(["main", "master"]);
const SAFE_RM_BASENAMES = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "coverage",
  "test-results",
  "playwright-report",
  ".turbo",
]);

const verdict = (decision, rule, reason) => ({ decision, rule, reason });
const ALLOW = verdict("allow", null, null);
const worst = (a, b) => (RANK[b.decision] > RANK[a.decision] ? b : a);

// ---------------------------------------------------------------- secrets

const SECRET_LITERAL =
  /\b(sk_live_[A-Za-z0-9]{12,}|rk_live_[A-Za-z0-9]{12,}|whsec_[A-Za-z0-9]{12,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;

/** True when a path names a file that holds secrets (never `.env.example` and friends). */
export function isSecretPath(raw) {
  const p = String(raw)
    .replace(/^["'`]+|["'`),;]+$/g, "")
    .replace(/^~(?=\/|$)/, "~");
  if (!p) return false;
  const base = path.basename(p);
  if (/\.(example|sample|template|dist)$/i.test(base)) return false;
  if (/^\.env(\.[A-Za-z0-9_-]+)?$/.test(base)) return true;
  if (/^\.env\..+\.local$/.test(base)) return true;
  if (/\.(pem|key|p12|pfx|jks|keystore)$/i.test(base)) return true;
  if (/^id_(rsa|dsa|ecdsa|ed25519)$/.test(base)) return true;
  if (/(^|\/)\.ssh\//.test(p) && !/(^known_hosts|\.pub$|^config$)/.test(base)) return true;
  if (/(^|\/)\.aws\/(credentials|config)$/.test(p)) return true;
  if (/(^|\/)\.config\/gh\/hosts\.yml$/.test(p)) return true;
  if (/(^|\/)\.docker\/config\.json$/.test(p)) return true;
  if (/(^|\/)\.kube\/config$/.test(p)) return true;
  if (/(^|\/)(\.netrc|\.git-credentials)$/.test(p)) return true;
  // Session transcripts hold whatever once passed through a model.
  if (/(^|\/)\.claude\/(projects|sessions|file-history)\//.test(p)) return true;
  if (/(^|\/)\.claude\/history\.jsonl$/.test(p)) return true;
  return false;
}

// ---------------------------------------------------------------- parsing

/**
 * Replaces heredoc bodies with a marker. A body is data for the command that reads it
 * (a README, a test fixture), so its words must not trigger command rules. A body fed to
 * a shell is code and stays. Secret-shaped values are still checked on the full text.
 */
export function stripHeredocs(text) {
  const heredoc = /^([^\n]*)<<-?\s*(['"]?)(\w+)\2([^\n]*)\n[\s\S]*?\n[ \t]*\3[ \t]*(?=\n|$)/gm;
  return text.replace(heredoc, (match, before, _quote, _tag, after) =>
    /\b(ba|z|da|k)?sh\b/.test(before) ? match : `${before}<<HEREDOC${after}`,
  );
}

/** Splits a command into simple commands, keeping quoted strings intact. */
function splitSegments(text) {
  const out = [];
  let cur = "";
  let quote = null;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      cur += ch;
      if (ch === "\\" && quote === '"') {
        cur += text[i + 1] ?? "";
        i += 1;
      } else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
      continue;
    }
    const two = text.slice(i, i + 2);
    if (two === "&&" || two === "||") {
      out.push(cur);
      cur = "";
      i += 1;
    } else if (ch === ";" || ch === "|" || ch === "\n" || ch === "`") {
      out.push(cur);
      cur = "";
    } else if (two === "$(") {
      out.push(cur);
      cur = "";
      i += 1;
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

function tokenize(segment) {
  const tokens = [];
  const re = /"((?:\\.|[^"\\])*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(segment))) {
    if (m[1] !== undefined) tokens.push({ text: m[1], quoted: true });
    else if (m[2] !== undefined) tokens.push({ text: m[2], quoted: true });
    else tokens.push({ text: m[3], quoted: false });
  }
  return tokens;
}

const WRAPPERS = new Set([
  "sudo",
  "env",
  "time",
  "nohup",
  "command",
  "exec",
  "nice",
  "xargs",
  "timeout",
]);

function verbOf(tokens) {
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i].text;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(t) || WRAPPERS.has(t) || (t.startsWith("-") && i > 0)) {
      i += 1;
      continue;
    }
    break;
  }
  return { verb: tokens[i]?.text ?? "", args: tokens.slice(i + 1).map((x) => x.text), index: i };
}

const METADATA_VERBS = new Set(["ls", "stat", "test", "[", "du", "wc", "file"]);

// ---------------------------------------------------------------- rules

function gitDecision(args, currentBranch) {
  const a = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "-C" || args[i] === "-c") i += 1;
    else a.push(args[i]);
  }
  const sub = a.find((x) => !x.startsWith("-"));
  const rest = a.slice(a.indexOf(sub) + 1);
  const has = (...flags) => rest.some((x) => flags.includes(x));
  const hasShortFlag = (letter) => rest.some((x) => /^-[A-Za-z]+$/.test(x) && x.includes(letter));
  if (sub === "push") {
    if (
      has("--force", "--delete", "--mirror", "--prune", "--all") ||
      rest.some((x) => x.startsWith("--force-with-lease") || x.startsWith("--force-if-includes")) ||
      hasShortFlag("f") ||
      hasShortFlag("d") ||
      rest.some((x) => /^[:+]/.test(x))
    ) {
      return verdict(
        "deny",
        "git-push-force",
        "Force, delete or mirror pushes are irreversible; a human does these.",
      );
    }
    const positional = rest.filter((x) => !x.startsWith("-"));
    const refs = positional.slice(1);
    const targetsProtected = refs.some((r) => {
      const dst = r.includes(":") ? r.split(":").pop() : r;
      const name = dst.replace(/^refs\/heads\//, "");
      return (
        PROTECTED_BRANCHES.has(name) ||
        (name === "HEAD" && PROTECTED_BRANCHES.has(currentBranch ?? ""))
      );
    });
    if (targetsProtected || (refs.length === 0 && PROTECTED_BRANCHES.has(currentBranch ?? ""))) {
      return verdict(
        "deny",
        "git-push-protected",
        "Never push to main or master directly; open a pull request.",
      );
    }
    return ALLOW;
  }
  if (sub === "reset" && has("--hard", "--merge", "--keep")) {
    return verdict(
      "deny",
      "git-reset-hard",
      "git reset --hard discards work that cannot be recovered.",
    );
  }
  if (sub === "clean" && (hasShortFlag("f") || has("--force"))) {
    return verdict("deny", "git-clean", "git clean deletes untracked files for good.");
  }
  if (
    (sub === "checkout" || sub === "restore" || sub === "switch") &&
    !has("--staged") &&
    (rest.includes(".") || has("--force", "--discard-changes", "-f"))
  ) {
    return verdict("deny", "git-discard", "This would throw away uncommitted changes.");
  }
  if (sub === "branch" && (hasShortFlag("D") || (hasShortFlag("d") && has("--force")))) {
    return verdict("deny", "git-branch-delete", "Deleting branches with -D is irreversible here.");
  }
  if (sub === "stash" && (rest[0] === "drop" || rest[0] === "clear")) {
    return verdict("deny", "git-stash-drop", "Dropping stashes loses work.");
  }
  if (
    ["filter-branch", "filter-repo"].includes(sub) ||
    (sub === "update-ref" && has("-d")) ||
    (sub === "reflog" && rest[0] === "expire") ||
    (sub === "gc" && rest.some((x) => x.startsWith("--prune")))
  ) {
    return verdict(
      "deny",
      "git-history-rewrite",
      "History-destroying git commands are for a human.",
    );
  }
  if (sub === "tag" && hasShortFlag("d")) {
    return verdict("deny", "git-tag-delete", "Deleting tags rewrites release history.");
  }
  return ALLOW;
}

function ghDecision(args) {
  const [sub, action] = args;
  if (sub === "repo" && ["delete", "archive", "rename", "transfer"].includes(action)) {
    return verdict(
      "deny",
      "gh-repo-destructive",
      "Repository deletion, archiving and transfer are for a human.",
    );
  }
  if (sub === "auth" && ["token", "logout"].includes(action)) {
    return verdict("deny", "gh-auth", "Printing or dropping the GitHub token is not for agents.");
  }
  if ((sub === "secret" || sub === "variable") && ["set", "delete", "remove"].includes(action)) {
    return verdict(
      "ask",
      "gh-secret-write",
      "Changing repository secrets or variables needs a human.",
    );
  }
  if (sub === "release" && action === "delete") {
    return verdict("ask", "gh-release-delete", "Deleting a release needs a human.");
  }
  if (sub === "api") {
    const method = args.find((x, i) => /^-X$|^--method$/.test(args[i - 1] ?? "") && true) ?? "";
    const writes =
      /^(PUT|PATCH|DELETE|POST)$/i.test(method) ||
      args.some(
        (x) =>
          x === "-f" || x === "-F" || x === "--input" || x === "--field" || x === "--raw-field",
      );
    const endpoint = args.find((x) => /^\/?repos\/|^\/?orgs\/|^\/?user\//.test(x)) ?? "";
    if (
      writes &&
      /(^\/?repos\/[^/]+\/[^/]+\/?$)|(protection|rulesets|collaborators|invitations|\/keys|\/hooks|actions\/(secrets|permissions|variables)|environments|security|settings|transfer|teams|memberships|dependabot\/alerts|code-scanning\/alerts|secret-scanning)/.test(
        endpoint,
      )
    ) {
      return verdict(
        "ask",
        "gh-api-security",
        "This changes repository security or access settings; a human approves each one.",
      );
    }
  }
  return ALLOW;
}

function dockerDecision(args, remote) {
  const flat = args.join(" ");
  if (
    /\bvolume\s+(rm|remove|prune)\b/.test(flat) ||
    (/\bsystem\s+prune\b/.test(flat) && /--volumes/.test(flat)) ||
    (/\bcompose\b/.test(flat) && /\bdown\b/.test(flat) && /(\s-v\b|--volumes)/.test(flat))
  ) {
    return verdict("deny", "docker-volume", "Removing volumes deletes data.");
  }
  if (/\bprune\b/.test(flat)) {
    return verdict(
      "ask",
      "docker-prune",
      "Docker prune deletes images or build cache; a human approves it.",
    );
  }
  if (/Config\.Env/.test(flat)) {
    return verdict(
      "deny",
      "docker-inspect-env",
      "docker inspect on the environment prints secret values.",
    );
  }
  if (/\bcompose\b/.test(flat) && args.includes("config")) {
    const envFile = args[args.indexOf("--env-file") + 1] ?? "";
    if (remote || (args.includes("--env-file") && isSecretPath(envFile))) {
      return verdict(
        "ask",
        "docker-compose-config",
        "docker compose config would print resolved secret values.",
      );
    }
  }
  const composeChange =
    /\bcompose\b/.test(flat) && /\b(up|down|restart|stop|rm|pull|build|run)\b/.test(flat);
  if (
    remote &&
    (composeChange || /\b(rm|kill|stop|restart|start|update|run|cp|network)\b/.test(flat))
  ) {
    return verdict(
      "ask",
      "remote-docker-change",
      "This changes containers on the production host.",
    );
  }
  return ALLOW;
}

function rmDecision(args) {
  const flags = args.filter((x) => x.startsWith("-"));
  const recursive = flags.some((f) => /^-[A-Za-z]*[rR]/.test(f) || f === "--recursive");
  const targets = args.filter((x) => !x.startsWith("-"));
  if (!recursive) return ALLOW;
  if (targets.length === 0) return ALLOW;
  for (const t of targets) {
    const clean = t.replace(/^["']|["']$/g, "");
    if (
      clean === "/" ||
      clean === "~" ||
      /^(\$HOME|\$\{HOME\})\/?$/.test(clean) ||
      clean === "." ||
      clean === ".." ||
      clean === "*" ||
      clean === "/*" ||
      clean.startsWith("../") ||
      clean.includes("/../")
    ) {
      return verdict("deny", "rm-dangerous-target", `rm -r on "${clean}" is blocked.`);
    }
    if (/\$|`/.test(clean) && !SAFE_RM_BASENAMES.has(path.basename(clean))) {
      return verdict(
        "ask",
        "rm-unverifiable",
        "rm -r on a path built from a variable cannot be checked; a human approves it.",
      );
    }
    const safe =
      clean.startsWith("/tmp/") ||
      clean.startsWith("/private/tmp/") ||
      SAFE_RM_BASENAMES.has(path.basename(clean));
    if (!safe)
      return verdict("ask", "rm-recursive", `Recursive delete of "${clean}" needs a human.`);
  }
  return ALLOW;
}

const REMOTE_MUTATORS =
  /\b(sudo|deploy\.sh|systemctl\s+(start|stop|restart|reload|enable|disable|mask|daemon-reload)|crontab\s+(-e|-r|-\s|[^\s-])|rm|mv|cp|install|chmod|chown|tee|truncate|dd|kill|pkill|reboot|shutdown|firewall-cmd|iptables|dnf|yum|flock|sed\s+-i|pip3?\s+install|npm\s+(i|install|ci)|git\b[^|;&]*\b(pull|reset|checkout|clean|merge|fetch|push|rebase|commit))\b/;
const SUDO_READ_ONLY =
  /\bsudo\s+(grep|journalctl|firewall-cmd\s+--list[\w-]*|sshd\s+-T|ls|docker\s+(ps|logs|inspect|stats|images|info))\b/g;

function remoteDecision(text) {
  const cleaned = text
    .replace(/\d?>&\d|&>\s*\S+|\d?>\s*\/dev\/null|<\s*\/dev\/null/g, " ")
    .replace(SUDO_READ_ONLY, "READONLY");
  if (REMOTE_MUTATORS.test(cleaned) || /(^|[^<>\d&])>>?\s*[^\s&]/.test(cleaned)) {
    return verdict(
      "ask",
      "remote-change",
      "This changes the production host; a human approves each change.",
    );
  }
  return ALLOW;
}

function sqlDecision(text, remote) {
  const local = !remote && /(localhost|127\.0\.0\.1|\[::1\])/.test(text) && !/\bssh\b/.test(text);
  const block = (rule, reason) =>
    local
      ? verdict("ask", `${rule}-local`, `${reason} (local database: a human confirms).`)
      : verdict("deny", rule, reason);
  if (
    /\b(drop\s+(table|database|schema|index|user|role)|alter\s+table\s+\S+\s+drop)\b|\btruncate\s+(table\s+)?[\w"]/i.test(
      text,
    )
  ) {
    return block(
      "sql-destructive",
      "DROP, TRUNCATE and column drops are irreversible; run them by hand.",
    );
  }
  if (/\bdelete\s+from\b/i.test(text) && !/\bwhere\b/i.test(text)) {
    return block("sql-delete-all", "DELETE without WHERE wipes a whole table.");
  }
  return ALLOW;
}

// ---------------------------------------------------------------- evaluator

function evaluate(fullText, ctx, depth = 0) {
  let result = ALLOW;
  if (depth > 4) return verdict("deny", "too-deep", "Command nesting is too deep to inspect.");
  const text = stripHeredocs(fullText);

  if (SECRET_LITERAL.test(fullText)) {
    return verdict(
      "deny",
      "secret-literal",
      "A secret value appears inside the command; never paste secrets.",
    );
  }
  if (/\b(curl|wget)\b[^|]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/.test(text)) {
    return verdict("deny", "pipe-to-shell", "Piping a download into a shell runs unreviewed code.");
  }
  const nextCtx = { ...ctx, sql: ctx.sql || /\b(psql|mysql|sqlite3|sqlcmd)\b/.test(text) };
  if (nextCtx.sql) result = worst(result, sqlDecision(text, ctx.remote));

  for (const segment of splitSegments(text)) {
    const tokens = tokenize(segment);
    if (tokens.length === 0) continue;
    const { verb, args } = verbOf(tokens);
    const bare = path.basename(verb);

    // Secret paths: reads are denied, except identity files for ssh and metadata checks.
    const metadataOnly =
      METADATA_VERBS.has(bare) ||
      (bare === "find" && !args.some((x) => /^-(exec|execdir|delete|ok|okdir)$/.test(x))) ||
      (bare === "git" &&
        /^(check-ignore|ls-files|status|ls-tree|rev-parse)$/.test(
          args.find((x) => !x.startsWith("-")) ?? "",
        ));
    if (tokens.some((t) => !/\s/.test(t.text) && /\/proc\/[^\s]*\/environ/.test(t.text))) {
      result = worst(
        result,
        verdict("deny", "proc-environ", "Process environments hold secret values."),
      );
    }
    tokens.forEach((tok, i) => {
      if (tok.quoted && /\s/.test(tok.text)) return;
      const prev = tokens[i - 1]?.text ?? "";
      if (/^(-i|--identity-file|--env-file|-F)$/.test(prev)) return;
      if (isSecretPath(tok.text) && !metadataOnly) {
        const writeTarget = /^\d?>>?$/.test(prev) || bare === "tee";
        result = worst(
          result,
          writeTarget
            ? verdict(
                "ask",
                "secret-file-write",
                `Writing "${path.basename(tok.text)}" needs a human; the guard cannot see what goes into it.`,
              )
            : verdict(
                "deny",
                "secret-path",
                `"${path.basename(tok.text)}" holds secrets; agents must not read or copy it.`,
              ),
        );
      }
    });

    // Environment dumps. `env` is a wrapper for verbOf, so look at the raw tokens as well.
    const raw = tokens.map((t) => t.text);
    const first = raw[0] === "sudo" ? raw.slice(1) : raw;
    const bareEnv = first[0] === "env" && first.slice(1).every((x) => x.startsWith("-"));
    const execDump =
      (bare === "docker" || bare === "docker-compose") &&
      args.includes("exec") &&
      args.some(
        (x, i) =>
          (x === "printenv" || x === "env") &&
          i > args.indexOf("exec") + 1 &&
          args.slice(i + 1).every((y) => y.startsWith("-")),
      );
    if (
      bareEnv ||
      execDump ||
      raw.includes("printenv") ||
      bare === "printenv" ||
      (bare === "env" && args.every((x) => x.startsWith("-"))) ||
      (bare === "export" && args.includes("-p")) ||
      (bare === "declare" && args.some((x) => /^-[A-Za-z]*[xp]/.test(x))) ||
      (bare === "set" && args.length === 0)
    ) {
      result = worst(
        result,
        verdict("deny", "env-dump", "Dumping the environment prints secret values."),
      );
    }

    if (bare === "git") result = worst(result, gitDecision(args, ctx.branch));
    else if (bare === "gh") result = worst(result, ghDecision(args));
    else if (bare === "docker" || bare === "docker-compose")
      result = worst(result, dockerDecision(args, ctx.remote));
    else if (bare === "rm") result = worst(result, rmDecision(args));
    else if (bare === "find" && args.includes("-delete"))
      result = worst(result, verdict("deny", "find-delete", "find -delete removes files in bulk."));
    else if (bare === "shred" || bare === "mkfs" || /^mkfs\./.test(bare))
      result = worst(result, verdict("deny", "disk-destructive", "Destructive disk command."));
    else if (bare === "dd" && args.some((x) => x.startsWith("of=/dev/")))
      result = worst(result, verdict("deny", "disk-destructive", "dd to a device is destructive."));
    else if (bare === "terraform" && args[0] === "destroy")
      result = worst(
        result,
        verdict("deny", "terraform-destroy", "terraform destroy removes infrastructure."),
      );
    else if (bare === "terraform" && args[0] === "apply")
      result = worst(
        result,
        verdict("ask", "terraform-apply", "terraform apply changes infrastructure."),
      );
    else if (bare === "oci" && /\b(terminate|delete|remove)\b/.test(args.join(" ")))
      result = worst(
        result,
        verdict(
          "deny",
          "oci-delete",
          "Deleting OCI resources (including backup buckets) is for a human.",
        ),
      );
    else if (
      ["oci", "aws", "gcloud", "az"].includes(bare) &&
      /\b(create|update|put|attach|detach|add)\b/.test(args.join(" "))
    )
      result = worst(
        result,
        verdict("ask", "cloud-change", "This changes cloud resources or IAM."),
      );
    else if (bare === "npm" && ["publish", "login", "adduser"].includes(args[0]))
      result = worst(
        result,
        verdict("ask", "npm-publish", "Publishing or logging in to npm needs a human."),
      );
    else if (["scp", "rsync", "sftp"].includes(bare))
      result = worst(
        result,
        verdict("ask", "remote-copy", "Copying files to or from a host needs a human."),
      );
    else if (["ssh-keygen", "ssh-add"].includes(bare))
      result = worst(result, verdict("ask", "ssh-keys", "SSH key handling needs a human."));
    else if (
      (bare === "curl" || bare === "wget") &&
      /api\.stripe\.com/.test(segment) &&
      /(-X\s*(POST|DELETE|PUT)|-d\b|--data)/i.test(segment)
    )
      result = worst(
        result,
        verdict("ask", "stripe-write", "A write to the Stripe API needs a human."),
      );
    else if (bare === "drizzle-kit" && /\b(push|drop)\b/.test(args.join(" ")))
      result = worst(result, verdict("ask", "db-schema-change", "Schema changes need a human."));

    // Quoted strings are commands too (ssh host '...', bash -c "...").
    const isRemote = bare === "ssh" || bare === "scp";
    for (const tok of tokens) {
      if (tok.quoted && /\s/.test(tok.text)) {
        const inner = isRemote || ["bash", "sh", "zsh"].includes(bare) || bare === "xargs";
        if (inner) {
          const sub = { ...nextCtx, remote: ctx.remote || isRemote };
          result = worst(result, evaluate(tok.text, sub, depth + 1));
          if (sub.remote) result = worst(result, remoteDecision(tok.text));
        }
      }
    }
    if (isRemote && !tokens.some((t) => t.quoted && /\s/.test(t.text))) {
      // Unquoted remote command: ssh host ls -l
      const rest = args
        .slice(args.findIndex((x) => /@|^[\w.-]+$/.test(x) && !x.startsWith("-")) + 1)
        .join(" ");
      if (rest) {
        result = worst(result, evaluate(rest, { ...nextCtx, remote: true }, depth + 1));
        result = worst(result, remoteDecision(rest));
      }
    }
    if (isRemote && args.some((x) => /^-[LRD]$/.test(x))) {
      result = worst(result, verdict("ask", "ssh-tunnel", "SSH port forwarding needs a human."));
    }
  }
  return result;
}

/**
 * @param {{ toolName: string, toolInput: Record<string, unknown>, branch?: string|null }} input
 * @returns {{ decision: "allow"|"ask"|"deny", rule: string|null, reason: string|null }}
 */
export function decide({ toolName, toolInput, branch = null }) {
  if (toolName === "Bash") {
    const command = String(toolInput?.command ?? "");
    return evaluate(command, { remote: false, sql: false, branch });
  }
  if (["Read", "Edit", "Write", "NotebookEdit", "MultiEdit"].includes(toolName)) {
    const file = String(toolInput?.file_path ?? toolInput?.notebook_path ?? "");
    if (isSecretPath(file)) {
      return verdict(
        "deny",
        "secret-file",
        `"${path.basename(file)}" holds secrets; agents must not read or edit it.`,
      );
    }
    if (toolName !== "Read" && /(^|\/)\.claude\/(settings(\.local)?\.json|hooks\/)/.test(file)) {
      return verdict(
        "ask",
        "guard-config",
        "This edits the agent's own guardrails; a human approves it.",
      );
    }
  }
  return ALLOW;
}

// ---------------------------------------------------------------- entry point

function currentBranch(cwd) {
  try {
    return execFileSync("git", ["-C", cwd || ".", "rev-parse", "--abbrev-ref", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    }).trim();
  } catch {
    return null;
  }
}

function audit(entry) {
  try {
    const dir = path.join(homedir(), ".claude", "logs");
    mkdirSync(dir, { recursive: true });
    appendFileSync(path.join(dir, "nexora-guard.jsonl"), `${JSON.stringify(entry)}\n`);
  } catch {
    // Logging must never break the gate.
  }
}

const mask = (s) => String(s).replace(SECRET_LITERAL, "[REDACTED]").slice(0, 160);

function main() {
  let event;
  try {
    event = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    process.stderr.write("nexora-guard: could not read the hook input; denying.\n");
    process.exit(2);
  }
  try {
    const toolName = event.tool_name ?? "";
    const toolInput = event.tool_input ?? {};
    const branch =
      toolName === "Bash" && /\bgit\b/.test(String(toolInput.command ?? ""))
        ? currentBranch(event.cwd)
        : null;
    const d = decide({ toolName, toolInput, branch });
    if (d.decision !== "allow") {
      audit({
        ts: new Date().toISOString(),
        tool: toolName,
        decision: d.decision,
        rule: d.rule,
        subject: mask(toolInput.command ?? toolInput.file_path ?? ""),
      });
    }
    if (d.decision === "deny") {
      process.stderr.write(`nexora-guard [${d.rule}]: ${d.reason}\n`);
      process.exit(2);
    }
    if (d.decision === "ask") {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "ask",
            permissionDecisionReason: `nexora-guard [${d.rule}]: ${d.reason}`,
          },
        }),
      );
    }
    process.exit(0);
  } catch (error) {
    process.stderr.write(`nexora-guard: internal error (${error?.message ?? error}); denying.\n`);
    process.exit(2);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
