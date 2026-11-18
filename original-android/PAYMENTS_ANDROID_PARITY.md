# Android payment parity

The native Android client uses the same shared Firebase backend as the PWA.

- Provider payout onboarding: `ProfileScreen.kt` calls `createProviderOnboardingLink` and opens the returned Stripe-hosted onboarding URL.
- Provider payout status: the repository exposes `refreshProviderPayoutStatus`.
- Booking payment: `MarketplaceRepository.createBookingCheckoutUrl` calls `createBookingCheckoutSession`; the app opens the returned HTTPS Checkout URL.
- Webhook verification, payment-state updates, commission calculation and connected-account transfers remain server-side. Never place Stripe secret keys in Android.
- Provider country and local currency are checked in the listing form and repository; the Cloud Function remains authoritative.
- Arabic, English, French and Spanish resources are retained.

## Build and release
Run `./gradlew :app:assembleDebug` with a working Gradle distribution download, Android SDK and Java toolchain. Complete Stripe test-mode onboarding, payment, webhook, completion and payout tests before enabling live mode.
