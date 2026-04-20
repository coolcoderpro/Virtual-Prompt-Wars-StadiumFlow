# Security Policy

## Supported Versions

This project is a hackathon MVP; only the `main` branch receives security
updates.

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| others  | :x:                |

## Reporting a Vulnerability

**Please do not open public issues for security vulnerabilities.**

If you believe you have found a security issue in StadiumFlow, email the
maintainer privately with:

- A description of the issue and potential impact.
- Step-by-step reproduction (proof-of-concept code is welcome).
- Any suggested remediation.

You can expect an acknowledgement within **72 hours** and a coordinated
disclosure timeline thereafter. Please give us a reasonable window to
investigate and patch before public disclosure.

## Handling of Secrets

- Server credentials (`service-account.json`, `.env`, `.env.local`) are
  git-ignored and must never be committed.
- Firebase Admin credentials live only on the server; the browser bundle
  is restricted to `NEXT_PUBLIC_*` values.
- API keys for Gemini / Groq are read from server-side env and never
  exposed to the client.

## Dependency Management

- Dependabot scans `package.json` weekly (see
  `.github/dependabot.yml`) and opens PRs for security updates.
- `npm audit` is expected to report zero high or critical
  vulnerabilities on `main`.

## Responsible Use

StadiumFlow processes pseudonymous session data (anonymous Firebase auth
uids) and aggregated crowd/wait metrics. No personally identifiable
information is collected.
