# TrustCraft Europe-first payment deployment checklist

## Stripe platform
- [ ] Create/activate the platform Stripe account in a supported European country.
- [ ] Obtain Stripe approval for Connect marketplace use and the delayed separate-charges-and-transfers flow.
- [ ] Confirm provider connected-account country eligibility, Express account requirements and payout currencies.
- [ ] Configure branding, support contact, refund/cancellation policy, dispute handling, tax/VAT and provider terms.
- [ ] Activate eligible local payment methods in Stripe Dashboard. Checkout uses dynamic payment methods; do not hardcode a card-only allow-list.

## Firebase
- [ ] Register a Web app and set its real Web `appId` in `app.js`; do not use Android `mobilesdk_app_id`.
- [ ] Confirm the named Firestore database ID in `functions/index.js` matches the deployed project.
- [ ] Set `APP_BASE_URL` in `functions/.env.<project-id>` to the production HTTPS origin.
- [ ] Set `PLATFORM_COMMISSION_RATE` between 0.00 and 0.30.
- [ ] Store `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` using Firebase Functions secrets.
- [ ] Deploy Functions and verify their region is `europe-west1`.
- [ ] Register the `stripeWebhook` endpoint in Stripe for `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `account.updated`.
- [ ] Deploy Firestore rules and Hosting.

## Test sequence (Stripe test mode)
- [ ] Provider selects an allowed European country; local currency is auto-filled and cannot be manually mismatched.
- [ ] Provider completes Stripe Express onboarding using test data.
- [ ] Confirm `stripeChargesEnabled` and `stripePayoutsEnabled` become true in the provider document.
- [ ] Customer creates a booking; payment is unavailable until provider confirms it.
- [ ] Customer pays with a Stripe test payment method; webhook sets `paymentStatus=paid`.
- [ ] Customer confirms completion; exactly one transfer is created for provider net amount.
- [ ] Confirm commission ledger amount, transfer idempotency, and connected-account payout status.
- [ ] Test dynamic payment methods by country/currency, failed/abandoned Checkout, webhook replay, provider onboarding incomplete, refunds and disputes.

## Commands
```bash
cd functions
npm install
npm run lint
cd ..
firebase deploy --only functions,firestore:rules,hosting
```

Do not switch to live mode until the legal, operational, Stripe approval and test checks above are complete.
