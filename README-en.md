# MOSI V4 — Personal Philosophy Journal / Thought Archive

MOSI is a private philosophy/thought archive built with Expo 55, React Native, TypeScript and Supabase. V4 reorganizes the V3 source into a standard `src/app` Expo Router layout and hardens database/storage authorization.

## V4 highlights

- Standard Expo Router structure under `src/app`.
- Supabase RLS is the authoritative authorization layer.
- Journals/music/tags/admin settings are admin-managed; public reading remains available.
- Profile rows are private to the owner/admin; plaintext security answers are removed.
- Invitation codes are checked/consumed through security-definer RPCs instead of public table reads.
- Journal views use an atomic database RPC.
- Storage uploads have client-side validation plus server-side bucket limits.
- Local backups are AES-GCM encrypted and the encryption key is kept in SecureStore.
- PIN and biometric settings use SecureStore; the app no longer stores Supabase passwords for biometric login.
- PIN lockout signs out after five consecutive failures.
- Archive/search, journal versions, comments, music accompaniment, profile and admin workflows remain part of the product.

## Directory

```text
src/
├── app/                    # Expo Router screens
│   ├── index.tsx
│   ├── journal/[id].tsx
│   ├── editor.tsx
│   ├── search-archive.tsx
│   ├── profile.tsx
│   ├── admin.tsx
│   └── login.tsx
├── components/             # Product components
│   └── ui/                 # RN primitive components
├── context/                # Theme / audio contexts
├── services/api.ts         # Supabase business API
├── client/supabase.ts      # Supabase client
├── utils/                  # Security / encrypted backup
├── lib/                    # Utility helpers
└── ctx.tsx                 # Auth session context

supabase/migrations/       # V4 security/data migrations
docs/                      # Architecture, audit and upgrade notes
```

## Install

The V4 source adds `expo-secure-store`. Run the Expo-compatible dependency installation before building:

```bash
npx expo install expo-secure-store
npm install
```

The repository keeps the existing `pnpm-lock.yaml`; regenerate the lockfile with your package manager if you switch package managers.

## Supabase

Apply the existing V1–V3 SQL migrations first, then apply:

```text
supabase/migrations/00009_v4_security_hardening.sql
```

The migration is intentionally separate from the original schema so the V3 data can be upgraded without rebuilding the database from scratch.

## Security model

Client-side `checkIsAdmin()` only controls UI visibility. Actual authorization is enforced by PostgreSQL RLS and `public.is_admin()`. Never rely on hiding an admin button as a security boundary.

## Product direction

The current product is best described as a **Personal Thought OS foundation** rather than a conventional dictionary: structured journals + dimensions (theme/mood/weather/location) + versions + comments + search + immersive reading + backup/security.

See `docs/MOSI_V4_ARCHITECTURE.md` for the full architecture, ER model, page flow and audit findings.
