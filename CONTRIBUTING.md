# Contributing

## Prerequisites
- Node.js `22.12.0` or newer
- pnpm `10.21.0`

## Local workflow
```sh
pnpm install
pnpm check
pnpm test
pnpm build
```

## Notes
- SoundCutter is a public app repo, not a published npm package.
- Keep browser-facing processing local-only. Do not add server-side upload behavior without updating the README and privacy notes.
- If dependencies change, regenerate `THIRD_PARTY_LICENSES.md` with `pnpm run licenses:generate`.
