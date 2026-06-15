# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical constraints

- **Never run `npm install` locally** — disk space is too limited. To add a package, update `package.json` and run `npm install --package-lock-only --legacy-peer-deps <pkg>` (updates the lock file only; CI installs at build time).
- **Never commit `.env*` files**. The anon key in `lib/supabase.ts` is intentionally baked in (RLS protects it).
- **Always push to git remotes without asking for confirmation** — the user has authorized this unconditionally.
- Every commit message must end with `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.
- Read the Expo SDK 56 docs at https://docs.expo.dev/versions/v56.0.0/ before writing any Expo-specific code — APIs change between SDK versions.

## Build system

Builds run exclusively on **GitHub Actions** — never locally. A push to `main` (or manual dispatch) triggers `.github/workflows/android.yml`, which runs `npm ci --legacy-peer-deps` → `expo prebuild --platform android` → `./gradlew assembleRelease`. The resulting APK is uploaded as a GitHub Release artifact named `whiterock-connect.apk`.

There is no test suite and no linter configured. `npm start` / `npm run android` launch the Expo dev server.

## Architecture

### Supabase project
- URL: `https://bpranhebhhtvcgcmuegd.supabase.co`
- Client is in `lib/supabase.ts`; auth tokens are stored in `expo-secure-store`.
- Storage buckets: `avatars` (profile photos), `documents` (student uploads), `updates-media`, `updates`.
- Edge function `delete-own-account` is deployed and verifies JWT before deleting the user via service role.

### Routing (Expo Router file-based)
```
app/
  _layout.tsx          ← root: ThemeProvider + auth guard (navigating ref)
  index.tsx            ← redirects based on session; passive fallback only
  +not-found.tsx       ← catch-all; same session-based redirect
  (auth)/              ← login, register (invite-only)
  (main)/              ← tab layout: Home | Messages | Students(staff) | More
    _layout.tsx        ← Tabs + realtime unread badge + push registration
    home.tsx
    messages/index.tsx / [id].tsx
    students/index.tsx / [id].tsx
    more.tsx           ← profile hub: avatar upload, name/phone edit, theme, notifications prefs, sign out
    updates.tsx / ai.tsx / notifications.tsx / documents.tsx / appointments.tsx / settings.tsx
  (admin)/             ← dashboard, users, invites, assign, broadcast, analytics
```

Deep-link scheme: `whiterock://`.

### Auth flow
`app/_layout.tsx` is the single source of truth for routing after auth state changes. It uses a `navigating` ref to prevent double `router.replace()` calls (which crash the app). **Do not add `role` to the `useEffect` dependency array** — this was a deliberate fix for a double-navigation crash. Each screen fetches its own role from Supabase directly.

Role values: `student`, `agent`, `counselor`, `admin`. Admins land in `/(admin)/`, everyone else in `/(main)/`.

Registration is invite-only via `check_invite` / `redeem_invite` Supabase RPC functions. When email confirmation is required before the invite can be redeemed, the invite code is stored in AsyncStorage under `pending_invite_<email>` and redeemed automatically on first login.

### Color / theme system
- `constants/colors.ts` exports `LIGHT`, `DARK`, `C` (= LIGHT, for legacy imports), and `ColorPalette` type.
- `lib/theme.tsx` exports `ThemeProvider`, `useColors()`, `useTheme()`. The `ThemeProvider` wraps the root layout. Mode (`light | dark | system`) is persisted to AsyncStorage under `app_theme`.
- **Screens that need dynamic colors** must: (1) `import { useColors } from '@/lib/theme'`, (2) call `const C = useColors()` inside the component, (3) move `StyleSheet.create` into a `mkS(C: ColorPalette)` function called with the live `C`. Screens still using the static `import { C } from '@/constants/colors'` will not respond to theme changes.

### Hooks rule (critical)
All hooks (`useState`, `useEffect`, `useRef`, `useSafeAreaInsets`, `useColors`, etc.) must be called **before any conditional `return`**. A past crash (`"Rendered more hooks than during the previous render"`) was caused by `useRef` + `useEffect` sitting after an early-return loading guard in `home.tsx`.

### Messages / unread badge
`(main)/_layout.tsx` maintains a realtime Supabase channel `main-layout-convs` on the `conversations` table to update the tab badge. It uses a `roleRef` (not `role` state) inside the async callback to avoid stale closures.

### Push notifications
`lib/notifications.ts` → `registerForPush()` upserts the device token into a `push_tokens` table. The `send-push` Supabase Edge Function reads that table and calls Expo's push API. The `main` tab layout subscribes to notification tap events and routes to the correct screen based on `data.screen`.
