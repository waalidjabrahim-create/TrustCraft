# Release checklist — TrustCraft v2

- [ ] Register Firebase Web app and verify firebaseConfig.
- [ ] Enable Phone + Google providers; configure SMS region policy and billing.
- [ ] Configure Storage bucket and deploy storage.rules.
- [ ] Deploy firestore.rules and run emulator tests.
- [ ] Install/deploy Cloud Functions in europe-west1; configure APP_BASE_URL and PLATFORM_COMMISSION_RATE.
- [ ] Obtain Stripe Connect platform approval; configure STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET as Firebase secrets.
- [ ] Enable dynamic payment methods in Stripe Dashboard and register account.updated / checkout completion webhooks.
- [ ] Test provider Express onboarding, customer Checkout, delayed transfer after completion, HUF/ISK amount handling and idempotent webhook replay in test mode.
- [ ] Create admin custom claim using a protected service account.
- [ ] Enable App Check for Web (reCAPTCHA Enterprise), Android and iOS.
- [ ] Test: phone signup, Google signup, phone linking, invalid SMS, SMS quota failure.
- [ ] Test: identity upload by owner; read denied to other users; admin can review.
- [ ] Test: provider cannot publish self; admin cannot publish before identity approved.
- [ ] Test: booking contact hidden from provider while pending; visible after accepted.
- [ ] Test: reviews blocked unless booking is completed; duplicate review per booking blocked.
- [ ] Test: commission ledger and provider transfer are created once and amounts match provider rate × hours.
- [ ] Confirm local consumer/privacy rules, data retention, KYC provider, payment processor and taxes before public launch.
