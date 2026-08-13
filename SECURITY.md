# Security policy

This is the browser half of Vantage. It renders output from a language model,
owns the OAuth flow, and holds the session cookie — so its risks are XSS,
open redirects, and cookie handling. The rule engine and archive containment
live in
[`vantage-backend`](https://github.com/Asmodeus14/vantage-backend/blob/master/SECURITY.md).

## Reporting a vulnerability

**Please do not open a public issue.**

Use GitHub's private vulnerability reporting — the **Security** tab on this
repository, then *Report a vulnerability*. If that is unavailable, email
<singhabhay3145@gmail.com> with `SECURITY` in the subject.

Include the affected route or component, the steps, and what an attacker gains.
A proof of concept against your own instance beats a description.

This is a personal project. Expect an acknowledgement within a few days and a
fix timeline that depends on severity. There is no bounty.

**Please do not test against the hosted instance** — run it locally. It works
with no configuration at all.

## Supported versions

The `master` branch. There are no tagged releases receiving backports.

## What is already defended, and how

### Model output is never trusted as markup

Responses go through `react-markdown` with `remark-gfm`. **`rehype-raw` is
deliberately absent**, so HTML in a response is escaped and displayed as text
rather than executed, and `rehype-sanitize` runs on top as defence in depth
against a future plugin reintroducing HTML parsing. The sanitiser schema is
GitHub's, widened only for language classes on `code` and disabled checkboxes.

Nothing in that pipeline is string manipulation — no regex rewriting, no
assembling HTML from response text. Fenced code is read off the hast node and
handed to Shiki, which escapes every token it emits and only ever receives
plain text.

If you find a way to get script execution out of a model response, that is the
report worth making.

### The session cookie is first-party, on purpose

The OAuth code exchange happens on **this** server, not the API. Two
consequences: `GITHUB_CLIENT_SECRET` never has to exist on the API, and the
session cookie is same-site with the page. A cookie set by the API would be
third-party in production and blocked outright by Safari and by Firefox in
strict mode.

The cookie is `HttpOnly`, so JavaScript cannot read it. This is why a direct
ZIP upload uses a narrow, short-lived **upload ticket** rather than being handed
the session token.

### The OAuth `state` is signed, not stored

A server-side map would fail under more than one worker, because the callback
can land on a different process than the redirect. The signed value carries an
expiry and the return path, and `safeReturnTo` refuses absolute URLs and the
protocol-relative `//host` and `/\host` forms — so sign-in cannot become an
open redirect.

GitHub answers **HTTP 200 with an error body** for a reused or bad code, so the
callback inspects the payload rather than the status.

### Scopes are requested narrowly

`read:user` alone by default. `repo` — which GitHub scopes as read **and write**
to every private repository on the account — is requested only through an
explicit opt-in on the Settings page.

## Known and accepted

- **Sign-in has not been exercised against real GitHub in Safari or Firefox
  strict mode.** The consent step needs a human. This is the failure mode that
  passes every Chrome test.
- **Upload tickets are replayable within their lifetime** — see the backend
  policy.

## Reporting something in an analysed repository

If Vantage's *output* worries you — a detected secret shown in a report — that
is not a vulnerability in Vantage. Detected values are redacted before display.
Rotate the credential; the report id is unguessable but the credential is the
thing that matters.
