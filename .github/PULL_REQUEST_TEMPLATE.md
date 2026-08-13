## What and why

<!-- What changes, and what problem it solves. -->

## Checks

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build` — several App Router mistakes only appear here
- [ ] Documentation updated in this PR

## If this changes the API contract

- [ ] `lib/types.ts` matches the backend's `app/schemas.py`, and the backend PR
      is linked

## Interface changes

- [ ] Works in light and dark
- [ ] Interactive elements have accessible names; tests query by role
- [ ] Any new chart renders its hidden data table and states the trend in words
- [ ] No arbitrary colour values — semantic tokens only
- [ ] Nothing depends on animation to be understood

## If this touches security

The markdown renderer, the OAuth callback, or `lib/session.ts` — say so here.
