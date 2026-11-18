# TrustCraft — Europe-first release

## Product decisions implemented
- Europe-first provider onboarding; the supported provider-country allow-list is enforced by Cloud Functions.
- Provider prices and bookings use the provider country’s local currency. The currency field is auto-filled and read-only in the provider form.
- Stripe Connect Express onboarding collects provider identity and bank details directly with Stripe. TrustCraft does not collect bank credentials.
- Customer payment becomes available after the provider confirms the booking.
- Provider net proceeds are transferred to the connected Stripe account after the customer confirms service completion. The connected account’s payout schedule is set to daily; actual bank settlement remains subject to Stripe eligibility, verification, and settlement timing.
- Stripe Checkout uses Dashboard-managed dynamic payment methods and automatic locale selection. Enable the payment methods you want in the Stripe Dashboard; availability depends on country, currency, amount, and customer eligibility.
- Existing English, Arabic, French and Spanish language selector is retained.

## Important commercial prerequisites
1. The platform operator must have a Stripe platform account in a Stripe-supported country and obtain approval for the intended Connect marketplace/funds flow. Provider onboarding countries are also subject to Stripe Connect eligibility and account requirements.
2. Ask Stripe to confirm the separate-charges-and-transfers model, delayed transfer after service completion, refunds, disputes, negative balances and the platform’s responsibilities before going live.
3. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as Firebase Functions secrets.
4. Set `APP_BASE_URL` to the production HTTPS domain and `PLATFORM_COMMISSION_RATE` to a value from `0.00` to `0.30`.
5. In Stripe Dashboard, activate the payment methods appropriate to the platform and connected accounts. Checkout dynamically filters payment methods by transaction context.
6. Register the `stripeWebhook` endpoint for `account.updated`, `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
7. Use Stripe test mode and Firebase Emulator before live deployment. Do not use live keys until legal, tax/VAT, consumer cancellation, privacy, KYC and marketplace obligations are reviewed for the countries served.

## Firebase configuration still required
The supplied Android archive identifies the Firebase project but does not contain a registered Web App configuration. Register a Web app in Firebase Console and replace `REPLACE_WITH_FIREBASE_WEB_APP_ID` with its actual Web `appId` in `app.js`. Do not copy Android `mobilesdk_app_id` into the web configuration. Add the production domain to Firebase Authentication authorized domains. If enforcing App Check, replace `REPLACE_WITH_RECAPTCHA_ENTERPRISE_SITE_KEY` with the actual reCAPTCHA Enterprise site key and configure the matching Firebase App Check provider before enforcement. Confirm the named Firestore database before deployment.

## Verification commands
```bash
cd functions
npm install
npm run lint
cd ..
firebase emulators:exec --only firestore,functions,storage "npm --prefix functions test"
```

The archive includes source changes only. A live Stripe account, Firebase project credentials, Web App ID, Stripe approval, and deployed webhooks cannot be generated from source code and must be supplied by the platform owner.
