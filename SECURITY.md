# Security Policy

ChronoKey is a fully offline password manager. This page is the honest version of what it does and does not protect against, how the crypto works, and how to verify any of it yourself.

## Trust model (read this first)

This is a solo v0.3 project. It has **not** been third-party audited, and it should not get trust for free. If your threat model is "industry standard or nothing", use Bitwarden or KeePassXC — that is the correct answer, not a marketing concession.

What ChronoKey offers instead is a small, readable codebase: the entire crypto path is a few hundred lines, all standard algorithms, no custom crypto. You can read it in an evening instead of trusting a logo.

## What it protects against

- Disk theft / copied vault files — all data encrypted at rest (Argon2id + AES-256-GCM)
- Network eavesdropping or exfiltration — the app has zero network permissions; see below
- Malicious websites / browser exploits — Electron renderer sandbox, no remote content
- Clipboard residue — copied secrets auto-clear (default 20 s)
- Casual screenshots / screen recording — window content protection (Windows: `SetWindowDisplayAffinity`)

## What it does NOT protect against

- OS-level malware (keyloggers, memory scanning) — nothing on a compromised OS is safe
- Cold-boot attacks / physical access to an unlocked session
- A weak master password — no crypto fixes that
- Someone who has both your master password and your recovery code
- Implementation bugs. No audit yet; if you find one, see Reporting below.

## The crypto path (all of it)

| Purpose | What | Where |
|---|---|---|
| Key derivation | Argon2id (m=64 MiB, t=3, p=1, random 16-byte salt) | `electron/crypto.cjs` |
| Vault encryption | AES-256-GCM with AAD context binding | `electron/crypto.cjs` |
| Key wrapping | Random 32-byte data key, wrapped separately by master password and recovery code (password change never re-encrypts the vault) | `electron/vault.cjs` |
| TOTP | RFC 6238, WebCrypto, no secrets in scope beyond the key you enter | `src/lib/totp.js` |
| Recovery code | 25-char Crockford Base32 (~125 bits) | `electron/crypto.cjs` |

Keys live only in the main process; the renderer never sees the data key, and it is zeroed on lock.

## "Zero network" — how to check, not trust

- CSP sets `connect-src 'none'`; the main process additionally blocks every http/https/ws request via `webRequest.onBeforeRequest` (`electron/main.cjs`, `lockDownNetwork()`).
- Verify it yourself: run any packet capture (Wireshark / Process Monitor) while using the app — there is nothing to capture. Or read the ~30 lines that enforce it.

## Development model

Development is heavily AI-assisted, with every line human-reviewed before it lands. That is stated plainly because open source already makes it visible — holes are findable, not hidden, and independent review is welcome. AI assistance is a claim about process, not a security guarantee; the guarantees above come from the algorithms and the architecture, and those are what you should verify.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting (Security tab → Report a vulnerability) rather than public issues. Include a description, reproduction steps, and affected version. Please do not test vulnerabilities against other people's vaults or servers — there are none anyway; everything is local.
