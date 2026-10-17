# MINUR UPDATE — FCM Push Notifications

Status: implementation plan and deployment prerequisites. This document does **not** mean FCM is active or deployed.

## Current project state

- `public/sw.js` already handles Web Push notifications. Preserve it; do not replace it with a Firebase service worker.
- The existing backend uses Cloudflare Workers and D1.
- Firebase has not been created yet, so valid Firebase config, a Web Push VAPID key, Android app registration, and FCM credentials do not exist.
- Do not change the SODARAMU login HTML/CSS or expose service-account private keys in browser code, Git, Apps Script source, or APK assets.

## Target architecture

1. Web/PWA and Android register their FCM token after an administrator explicitly opts in.
2. The backend stores tokens in D1 using `migrations/20261017_fcm_tokens.sql`; token hashes are primary keys. Tokens must never be returned by list APIs or written to logs.
3. Internal Stage 1 submission emits an event only after the server confirms the submission has been saved.
4. Google Forms uses an installable Apps Script form-submit trigger. The script sends an authenticated event to a dedicated backend webhook. It must not call the legacy `fcm.googleapis.com/fcm/send` endpoint.
5. The Worker obtains a short-lived OAuth access token from a Google service account and sends FCM HTTP v1 messages to `https://fcm.googleapis.com/v1/projects/{projectId}/messages:send`.
6. Event IDs are idempotent. The same submission must not create duplicate notifications on retries.

## Firebase project setup (required)

1. Create a Firebase project in the Google account that owns the app.
2. In Project settings, register the Web app and Android app. The Android application ID must match the actual app ID in `android-app/app/build.gradle`; debug uses the `.debug` suffix.
3. Enable Cloud Messaging. Generate a Web Push certificate/VAPID key for Web/PWA.
4. Create a service account with the minimum permissions needed to send FCM messages. Prefer workload identity where supported; otherwise keep its private key only as a Cloudflare Worker secret. Never commit the JSON key.
5. Add the Firebase Web config values as public app config only after the project is created. They are identifiers, not server credentials.
6. Download `google-services.json` separately for the release package and debug package if Firebase Android app registrations use distinct application IDs. Keep the file out of Git unless the repository owner explicitly approves its public exposure; it is generally safer to inject it during CI from protected secrets.

## Cloudflare configuration

Required secret/config names for the planned FCM sender:

- `FCM_PROJECT_ID` — non-secret project ID.
- `FCM_SERVICE_ACCOUNT_EMAIL` — service-account email.
- `FCM_PRIVATE_KEY` — service-account private key, stored as a Worker secret.
- `GOOGLE_FORMS_WEBHOOK_SECRET` — random high-entropy webhook secret, stored as a Worker secret and Apps Script Script Property.
- Existing `DB` D1 binding — migration must be applied before enabling endpoints.

Do not deploy the webhook until the Worker route verifies the secret using constant-time comparison, validates payload size/schema, rate limits requests, and accepts only the expected notification source. The webhook must not accept arbitrary title/body/URL values from the caller.

## Google Apps Script

Use the companion file `scripts/google-apps-script/minur-form-submit.gs`. Add it to the Google Form's linked Apps Script project, configure the Script Properties listed in that file, then create an installable `On form submit` trigger. Do not use a simple trigger for authenticated external requests. The backend webhook URL must be the actual deployed route; do not guess a production URL.

## Platform behavior and limitations

- Android 13+ requires notification permission at runtime. Ask after a clear user action.
- Android notification channels control sound/vibration; users can mute or change them in system settings.
- Web Push works only in supported browsers over HTTPS with permission granted. Browser support for app icon badges and vibration varies; iOS and desktop browsers do not guarantee identical behavior.
- A web notification's `sound` property is not standardized. Native Android channel sound is the supported route for configurable sound.
- Badge count behavior varies by launcher and platform. Never promise a universal numeric badge.
- Notification bodies must not contain respondent names, phone numbers, NIK, HIV status, or other sensitive information.

## Release checklist

- [ ] Firebase project created and web + Android apps registered.
- [ ] FCM HTTP v1 API and service account permissions verified.
- [ ] D1 migration applied.
- [ ] Backend routes for token registration, internal Stage 1 events, and authenticated Forms webhook implemented and reviewed.
- [ ] FCM token refresh and invalid-token cleanup implemented.
- [ ] Web permission flow is user initiated and does not run on page load.
- [ ] Android debug and release builds include the correct Firebase configuration and runtime permission/channel handling.
- [ ] Google Forms installable trigger configured and test submission verified.
- [ ] Tests cover authentication failures, duplicate events, expired tokens, and notification clicks.
- [ ] Deploy to staging, verify, then deploy production and publish release notes.

Until these checks pass, the existing Web Push remains the only previously present push path and FCM delivery must be treated as not enabled.
