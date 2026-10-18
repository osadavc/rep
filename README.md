# rep

A minimal log for workouts, cardio, sleep and bodyweight, built for iPhone (Safari and Home Screen) at [rep.osada.vc](https://rep.osada.vc).

## How data is kept

- **Storage:** everything lives in one private Vercel Blob store (`rep-data`, Mumbai):
  - `prod/db.json`: the whole database (workouts, routines, bodyweight, sleep, settings).
  - `prod/sessions/<id>.json`: a second copy of every workout.
  - `prod/snapshots/<day>.json`: the state before the first change of each day. These are kept daily for 45 days, then one per month.
- **Local development and preview deployments** use the same store under `dev/`, so they never touch real data.
- **On the phone:** every change is applied right away and queued in `localStorage` until the server confirms it. A lost connection or a closed app never loses a change. The workout in progress is saved on every tap.
- **Server writes** are conditional (ETag), so two devices saving at once can't overwrite each other.
- **Recovery:** Settings has Export (full JSON, re-importable), CSV export, Import, and Restore from any backup.

## Sign-in

- **Passkeys only.** The passkey's public key is stored in `prod/auth.json`.
- **First passkey, or if every passkey is lost:** open `/setup` and enter `SETUP_SECRET` (in Vercel's environment variables).
- **Another device:** add it from Settings while signed in.

## Environment variables

| Name | What it's for |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Blob store access (added when the store was connected) |
| `SESSION_SECRET` | Signs the sign-in cookie |
| `SETUP_SECRET` | Lets a new passkey be registered without being signed in |

`vercel env pull .env.local` brings them down for local development.

## Develop

```sh
bun install
bun dev
```

Passkeys on `localhost` are separate from the ones on `rep.osada.vc`, so register one locally through `/setup`.
