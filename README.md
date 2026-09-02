# Wallet Pass Demo

Issue Apple Wallet (`.pkpass`) and Google Wallet passes from a Next.js app. Signing certificates, private keys, and Google service-account JSON stay on the server. The browser only calls `/api/wallet/*`.

This MVP has **no login or registration**. A visitor is identified by an httpOnly cookie (`wpd_owner`). That value is stored on `wallet_passes.user_id` and checked on every wallet request. You can swap it for Supabase Auth later by changing `getOwnerId()` in `src/lib/session.ts`.

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Copy **Project URL**, **anon public** key, and **service_role** key from Settings → API.
3. Run the migrations in order in the SQL editor (or `supabase db push` if you use the CLI):
   - `supabase/migrations/0001_wallet_passes.sql`
   - `supabase/migrations/0002_dynamic_passes.sql` (required — creates the `passes`, `pass_fields`, and related tables used by the app)
4. Confirm Row Level Security is enabled on the pass tables. The Next.js server uses the **service role** key (bypasses RLS) and enforces ownership in `src/lib/db/passes.ts`. The anon key cannot read or write rows.

Without Supabase, the app still runs in development using an in-memory store. Data is lost on restart.

## 2. Apple Developer setup

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/).
2. In Certificates, Identifiers & Profiles, note your **Team ID** (Membership details). That value is `APPLE_TEAM_ID`.

## 3. Apple Pass Type ID setup

1. Identifiers → **Pass Type IDs** → Register a Pass Type ID, for example `pass.com.yourcompany.membership`.
2. Put that identifier in `APPLE_PASS_TYPE_IDENTIFIER`.
3. The same identifier is embedded in every signed `.pkpass`. Changing it later invalidates existing passes.

## 4. Apple certificate setup

You need three PEM files:

| File | Source |
| --- | --- |
| Pass Type certificate (`signerCert.pem`) | Create a Pass Type ID certificate, download the `.cer`, convert to PEM |
| Private key (`signerKey.pem`) | Exported when you created the certificate signing request |
| Apple WWDR G4 intermediate (`wwdr.pem`) | [Apple PKI](https://www.apple.com/certificateauthority/) — Worldwide Developer Relations - G4 |

Example conversion (run locally, never commit the outputs):

```bash
openssl x509 -inform DER -in pass.cer -out certs/apple/signerCert.pem
openssl pkcs12 -in Certificates.p12 -nocerts -nodes -out certs/apple/signerKey.pem
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out certs/apple/wwdr.pem
```

On Vercel, prefer the `*_BASE64` variables instead of files:

```bash
base64 -i certs/apple/signerCert.pem | tr -d '\n'
```

Set `APPLE_PRIVATE_KEY_PASSWORD` if the key is encrypted. PKCS#12 (`.p12`) is not read directly — convert to PEM first.

`passkit-generator` builds `pass.json`, `manifest.json`, and the PKCS#7 `signature` inside Node. That material never leaves the server.

## 5. Google Wallet issuer setup

1. Open the [Google Pay & Wallet Console](https://pay.google.com/business/console).
2. Create an issuer and complete the business profile if prompted.
3. Copy the **Issuer ID**. That is `GOOGLE_ISSUER_ID`.
4. Under Google Wallet API, create a **Generic** class later is optional — this app creates the generic class on first issue (`GOOGLE_WALLET_CLASS_SUFFIX`).

## 6. Google service account setup

1. In Google Cloud, create (or reuse) a project linked to the Wallet issuer.
2. Enable the **Google Wallet API**.
3. Create a service account, download the JSON key.
4. In the Wallet Console, grant that service account the **Admin** (or Developer) role for your issuer.
5. Set:

```
GOOGLE_SERVICE_ACCOUNT_EMAIL=...@....iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Keep the `\n` escapes on one line. Never put this JSON in the client bundle, `localStorage`, or a `NEXT_PUBLIC_` variable.

Optional: `GOOGLE_WALLET_LOGO_URL` must be a public `https` image. Google does not accept data URIs.

## 7. Environment variables

Copy `.env.example` to `.env.local`. Nothing in that file is prefixed with `NEXT_PUBLIC_`.

| Variable | Purpose |
| --- | --- |
| `MOCK_WALLET_MODE` | `true` for UI work without certificates |
| `APP_BASE_URL` | Public origin, used as a Google Wallet JWT origin |
| `APPLE_*` | Team ID, pass type id, certificate, key, WWDR, optional password |
| `GOOGLE_*` | Issuer id, service account email and private key |
| `SUPABASE_*` | URL, anon key, service role key |
| `BRAND_*` | Name and colours used on both passes |

Never commit `.env.local`, `certs/`, or real keys. `.gitignore` already blocks PEM/P12/key files.

## 8. Local development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). There is no sign-in screen.

Recommended first run:

```
MOCK_WALLET_MODE=true
```

You can click **Create Demo Pass** and both wallet buttons. Apple returns a JSON mock. Google opens `/demo/google-mock`, which states that nothing was added to a wallet.

```bash
npm run test
npm run typecheck
npm run lint
```

## 9. Testing Apple Wallet

1. Set `MOCK_WALLET_MODE=false` and fill in every `APPLE_*` variable.
2. Create a demo pass, open it, click **Add to Apple Wallet**.
3. The API responds with `Content-Type: application/vnd.apple.pkpass`.
4. On iPhone/iPad/Safari, Wallet should offer to add the pass. On other desktops you get a `.pkpass` download — open it on a Mac with Wallet, or AirDrop it to an iPhone.
5. Confirm the pass shows member name, member ID, pass type, expiry, branding, and a QR code.

A pass will not install if the certificate does not match `APPLE_PASS_TYPE_IDENTIFIER` / `APPLE_TEAM_ID`, or if WWDR is missing.

## 10. Testing Google Wallet

1. Set `MOCK_WALLET_MODE=false` and fill in every `GOOGLE_*` variable.
2. Click **Add to Google Wallet**. The API returns `{ "saveUrl": "https://pay.google.com/gp/v/save/..." }`.
3. The browser redirects to Google’s save flow. Add the generic pass on Android or at [wallet.google.com](https://wallet.google.com).
4. The first request creates the generic class; later requests reuse `google_object_id` on the pass row.

The JWT is signed with the service-account private key on the server. The client only receives the save URL.

## 11. Deployment instructions

Deploy to Vercel (or any Node 20+ host):

1. Set every secret in the host’s environment UI. Do not upload private keys as git files.
2. For Apple on Vercel, use `APPLE_CERTIFICATE_BASE64`, `APPLE_PRIVATE_KEY_BASE64`, and `APPLE_WWDR_CERTIFICATE_BASE64`.
3. Set `APP_BASE_URL` to `https://your-domain.com` (Google Wallet origins must match).
4. Set `MOCK_WALLET_MODE=false` in production once credentials are in place.
5. Apply the Supabase migration to the production project.

```bash
npm run build
```

Runtime is Node (`export const runtime = "nodejs"` on wallet routes) because pass signing needs filesystem/crypto APIs that Edge does not provide.

## 12. Security notes

- Wallet private keys, Apple certificates, and Google service-account JSON are read only in server modules (`src/lib/config/env.ts`, `src/lib/wallet/apple`, `src/lib/wallet/google`).
- API error responses expose a stable `code` and a user-facing `message`. Stack traces, PEM contents, and provider payloads are logged server-side only.
- Mock mode must never look like a successful wallet add. Apple mock responses are JSON with `mock: true`. Google mock URLs point at this app, not `pay.google.com`.
- RLS is on. The browser never receives the service role key. The owner cookie is httpOnly and is not a credential for Apple or Google.
- Do not prefix secrets with `NEXT_PUBLIC_`. Do not store them in `localStorage`.

## Architecture

```
src/app/api/wallet/apple   →  issueAppleForOwner  →  lib/wallet/apple  (passkit-generator)
src/app/api/wallet/google  →  issueGoogleForOwner →  lib/wallet/google (Wallet API + JWT)
src/lib/db/*               →  Supabase (or memory store)
```

Pages: `/` (no account), `/dashboard`, `/passes/[id]`, `/admin/demo`.

Demo pass: **Demo Member** / **DEMO-001** / **Premium Membership** / **Demo Company**, expiry 12 months from creation.
