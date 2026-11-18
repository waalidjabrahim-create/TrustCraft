# TrustCraft Global Marketplace — PWA v2

Responsive PWA source for Android, iPhone, tablet and desktop. The original Android project is preserved in `original-android/`.

## Product decisions implemented in this revision

- **WhatsApp contact by consent:** client may share WhatsApp/address in a separate private `bookingContacts/{bookingId}` record. Provider contact is copied from the provider's private profile only when the provider accepts the booking. The contact record is unreadable to the provider while a booking is pending.
- **Marketplace payments and payouts:** Stripe Checkout collects payment after provider confirmation. A signed Stripe webhook marks payment as paid. After customer-confirmed completion, a Cloud Function transfers the provider's net amount to the provider's Stripe Connect account and records the platform commission in an idempotent ledger. Bank payout timing is controlled by Stripe and the connected account schedule.
- **Phone verification:** Firebase Phone Authentication with SMS and reCAPTCHA. Provider applications require a verified Firebase phone number.
- **Identity verification:** users submit a JPG, PNG or PDF (maximum 10 MB) to a private Firebase Storage path. Only admins can read the file. Admins approve/reject requests using a Firebase custom claim.
- **Listing approval:** new provider listings are unpublished by default. Admins can publish only after identity approval.
- **Review integrity:** a review document is keyed by booking ID and can only be created by that booking's client after the booking is completed. A Cloud Function recalculates provider aggregate ratings.
- **Location privacy:** map coordinates are rounded to one decimal place (roughly 10 km). Do not collect/store exact home coordinates.
- **Booking estimate:** client chooses 1–24 hours; estimated amount is provider hourly rate × selected hours. Firestore rules independently verify the estimate against the provider's published rate.

## Important deployment setup

This ZIP is source code, not a live service. Before launch:

1. Register a Firebase **Web app** in the correct Firebase project. Confirm the `firebaseConfig` in `app.js`, especially `appId` and `storageBucket`.
2. Enable Phone and Google sign-in in Firebase Authentication. Add production domains to Authorized domains. Phone sign-in requires SMS region policy, quotas and billing configuration; SMS delivery/cost varies by country. Keep reCAPTCHA enabled.
3. Configure Firebase Storage and deploy `storage.rules`.
4. Deploy Firestore rules: `firebase deploy --only firestore:rules,storage`.
5. Install and deploy Cloud Functions:
   ```bash
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```
   Copy `functions/.env.example` to `functions/.env`, set `PLATFORM_COMMISSION_RATE=0.10`, and keep `.env` out of Git. The default is 0.10. Do not set the rate in client-side code.
6. Assign the `admin` custom claim only to trusted administrators. Keep the service-account JSON outside the repository:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/secure/path/admin-service-account.json node scripts/set-admin-claim.js FIREBASE_UID
   ```
   Sign out and back in after changing a custom claim.
7. Create a reCAPTCHA Enterprise site key for the production domain and replace `APP_CHECK_SITE_KEY` in `app.js`. Register the web app in App Check, monitor traffic, then enforce Firestore/Storage. Configure App Check separately for Android/iOS. Authentication App Check has additional Identity Platform requirements.
8. Test all rules with the Firebase Emulator Suite and two distinct test accounts (customer/provider), plus an admin account. Do not use real identity documents during testing.

## Security and privacy notes

- Never commit service-account JSON, private keys, `.env` secrets, production admin credentials or real identity documents.
- Identity documents are highly sensitive personal data. Before accepting real uploads, publish a privacy notice, retention/deletion policy, legal basis, access logging and a process for handling deletion requests. For a public/global product, strongly consider using a specialist identity-verification provider rather than manually retaining ID scans.
- The current admin review UI is a basic operational queue, not a full KYC/compliance system. It has no audit trail beyond status/reviewer/timestamps.
- WhatsApp is an external messaging channel, not an in-app chat. The phone number is shared only after booking acceptance and only where the user opted in.
- Payment collection and connected-account transfers are implemented in source, but are not live until Stripe approves the platform and funds flow, credentials/webhooks are configured, test-mode flows pass, and legal/tax/refund/dispute requirements are addressed. Do not advertise payments as live before deployment and end-to-end verification.
- A percentage commission can have legal, tax, consumer-protection and payment-services implications in each country. Obtain qualified advice and adult supervision before launching or collecting money.

## Phone authentication notes

Firebase web phone auth uses `RecaptchaVerifier` and `signInWithPhoneNumber` / `linkWithPhoneNumber`. SMS can incur charges and Firebase may throttle traffic. Restrict SMS regions to intended launch countries and monitor abuse. See the official Firebase phone-auth docs.

## Run locally

Serve the folder from localhost or HTTPS; do not open `index.html` via `file://`.
```bash
python -m http.server 8080
```
Open `http://localhost:8080`. Firebase Authorized Domains must include localhost for local testing.

## Install

- Android: open the HTTPS site in Chrome → Install app / Add to Home screen.
- iPhone: open the HTTPS site in Safari → Share → Add to Home Screen.

## Current limits

- WhatsApp is a link to WhatsApp, not native chat or guaranteed message delivery.
- Identity verification is manual admin review of an uploaded document. It is not automated KYC and is not sufficient by itself for global legal compliance.
- The PWA has not been deployed, Firebase rules have not been deployed to your project, and no production Stripe, production SMS, or Firebase Emulator end-to-end test has been run here.
- The original Android project is included and its Kotlin payment/payout entry points use the shared callable Functions. A native APK build and device test still need to be completed in an environment with Android SDK/Gradle dependencies available.


## Europe-first payments and provider payouts

TrustCraft now includes a Stripe Connect Express onboarding and Checkout integration for eligible European provider countries. The four existing app languages (English, Arabic, French and Spanish) are preserved. Provider country selection suggests the local currency (EUR, GBP, CHF, NOK, DKK, SEK, PLN, CZK, HUF, RON and ISK); the currency field is read-only and must match the supported provider country. The discover filter and map are set to Europe-first, while the worldwide filter remains available.

### Payment and payout flow

1. A provider creates a listing and connects a Stripe Express account from Profile → Provider payouts. Stripe hosts identity and bank-account verification.
2. A customer sends a booking request. The provider confirms it.
3. The customer selects **Pay securely** from the confirmed booking and pays through Stripe Checkout in the booking currency. The Stripe webhook—not the browser redirect—marks the booking paid.
4. After the customer confirms completion, a Cloud Function transfers the provider's net amount to the provider's connected Stripe account. The configured platform commission is retained by the platform. Stripe's connected-account payout schedule is set to daily; actual bank arrival depends on eligibility, country, settlement and risk review.

This is a separate-charges-and-transfers design. It does not represent an escrow service, and the platform's legal/payment-services obligations must be reviewed before live launch. Refunds, disputes, taxes/VAT, invoices, cancellation rules and negative balances require additional production workflows and operational policy. Do not describe a transfer to a connected Stripe balance as money already received in the provider's bank.

### Deployment configuration

- Set `APP_BASE_URL` in `functions/.env.<project-id>` to the deployed HTTPS hosting URL.
- Set secrets: `firebase functions:secrets:set STRIPE_SECRET_KEY` and `firebase functions:secrets:set STRIPE_WEBHOOK_SECRET`.
- Set `PLATFORM_COMMISSION_RATE` to a decimal from `0.00` to `0.30` (example `0.10`).
- Deploy Functions in `europe-west1`. Configure a Stripe webhook to the deployed `stripeWebhook` URL for `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `account.updated`.
- Enable Stripe Connect for the platform and request access/approval for the countries and account capabilities in which providers will be onboarded. Stripe onboarding requirements vary by country and account type.
- Use Stripe test keys and test connected accounts first. Do not put Stripe secret keys in the PWA, Android app, Firestore or source control.

### Important limits in this package

- Stripe live credentials, platform approval, legal entity onboarding and webhook registration must be supplied by the project owner; they cannot be generated in source code.
- Both PWA and native Android clients call the shared Cloud Functions for provider onboarding and booking Checkout. The Android client opens the secure Stripe-hosted URLs in the browser; no Stripe secret is stored on-device. Android build/device verification remains outstanding.
- Country/currency pairs are checked by the web and Android clients and revalidated by the server before payment.
- Cash Plus is not part of the Europe-first payment path.
