const { onDocumentUpdated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const { initializeApp, getApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Stripe = require('stripe');
const { EUROPE_COUNTRIES, COUNTRY_CURRENCY, toMinor } = require('./payment-config');

initializeApp();
// TrustCraft web uses the (default) Firestore database of project trustcraft-52c9e.
const db = getFirestore(getApp());
const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const PLATFORM_COMMISSION_RATE = defineString('PLATFORM_COMMISSION_RATE', { default: '0.10' });
const APP_BASE_URL = defineString('APP_BASE_URL', { default: 'https://trustcraft.example' });
const REGION = 'europe-west1';

const stripeClient = (key) => new Stripe(key);
const commissionRate = () => {
  const value = Number(PLATFORM_COMMISSION_RATE.value());
  if (!Number.isFinite(value) || value < 0 || value > 0.30) {
    throw new HttpsError('failed-precondition', 'PLATFORM_COMMISSION_RATE must be between 0 and 0.30.');
  }
  return value;
};
const safeBaseUrl = () => {
  const value = APP_BASE_URL.value().replace(/\/$/, '');
  if (!/^https:\/\//i.test(value) || value === 'https://trustcraft.example') {
    throw new HttpsError('failed-precondition', 'Set APP_BASE_URL to the deployed HTTPS TrustCraft URL.');
  }
  return value;
};
const requireAuth = (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to continue.');
  return request.auth.uid;
};

// Providers onboard through Stripe-hosted Express KYC. Bank details never pass through TrustCraft.
exports.createProviderOnboardingLink = onCall({ region: REGION, secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const uid = requireAuth(request);
  const providerRef = db.doc(`providers/${uid}`);
  const providerSnap = await providerRef.get();
  if (!providerSnap.exists || providerSnap.data().ownerId !== uid) {
    throw new HttpsError('failed-precondition', 'Create your provider profile before connecting payouts.');
  }
  const provider = providerSnap.data();
  const countryCode = String(provider.countryCode || '').toUpperCase();
  if (!EUROPE_COUNTRIES.has(countryCode)) {
    throw new HttpsError('failed-precondition', 'Automatic payouts are currently enabled for supported European provider countries only.');
  }
  if (String(provider.currency || '').toLowerCase() !== COUNTRY_CURRENCY[countryCode]) {
    throw new HttpsError('failed-precondition', `Set the provider price currency to ${COUNTRY_CURRENCY[countryCode].toUpperCase()} for this country before connecting payouts.`);
  }
  const stripe = stripeClient(STRIPE_SECRET_KEY.value());
  let accountId = provider.stripeAccountId;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: countryCode,
      email: request.auth.token.email || undefined,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      settings: { payouts: { schedule: { interval: 'daily' } } },
      metadata: { trustcraftUserId: uid, trustcraftProviderId: uid }
    }, { idempotencyKey: `trustcraft-connect-${uid}` });
    accountId = account.id;
    await providerRef.update({ stripeAccountId: accountId, stripeAccountStatus: 'onboarding', updatedAt: FieldValue.serverTimestamp() });
  }
  const base = safeBaseUrl();
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/?connect=refresh#profile`,
    return_url: `${base}/?connect=return#profile`,
    type: 'account_onboarding'
  });
  return { url: link.url, accountId };
});

exports.refreshProviderPayoutStatus = onCall({ region: REGION, secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const uid = requireAuth(request);
  const providerRef = db.doc(`providers/${uid}`);
  const providerSnap = await providerRef.get();
  if (!providerSnap.exists || providerSnap.data().ownerId !== uid) {
    throw new HttpsError('failed-precondition', 'Provider profile not found.');
  }
  const accountId = providerSnap.data().stripeAccountId;
  if (!accountId) return { connected: false, payoutsEnabled: false, chargesEnabled: false };
  const stripe = stripeClient(STRIPE_SECRET_KEY.value());
  const account = await stripe.accounts.retrieve(accountId);
  const status = account.payouts_enabled && account.charges_enabled ? 'active' : (account.details_submitted ? 'review' : 'onboarding');
  await providerRef.update({
    stripeAccountStatus: status,
    stripeChargesEnabled: !!account.charges_enabled,
    stripePayoutsEnabled: !!account.payouts_enabled,
    stripeRequirementsDue: account.requirements?.currently_due || [],
    updatedAt: FieldValue.serverTimestamp()
  });
  return { connected: !!account.details_submitted, payoutsEnabled: !!account.payouts_enabled, chargesEnabled: !!account.charges_enabled, status };
});

// Customers pay only after the provider accepts. Funds stay on the platform balance until the job is completed.
exports.createBookingCheckoutSession = onCall({ region: REGION, secrets: [STRIPE_SECRET_KEY] }, async (request) => {
  const uid = requireAuth(request);
  const bookingId = String(request.data?.bookingId || '');
  if (!/^[A-Za-z0-9_-]{10,150}$/.test(bookingId)) throw new HttpsError('invalid-argument', 'Invalid booking ID.');
  const bookingRef = db.doc(`bookings/${bookingId}`);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) throw new HttpsError('not-found', 'Booking not found.');
  const booking = bookingSnap.data();
  if (booking.clientId !== uid) throw new HttpsError('permission-denied', 'Only the customer can pay for this booking.');
  if (booking.status !== 'confirmed') throw new HttpsError('failed-precondition', 'Payment becomes available after the provider confirms the booking.');
  if (booking.paymentStatus === 'paid') throw new HttpsError('already-exists', 'This booking is already paid.');
  const providerSnap = await db.doc(`providers/${booking.providerId}`).get();
  if (!providerSnap.exists) throw new HttpsError('failed-precondition', 'Provider profile is unavailable.');
  const provider = providerSnap.data();
  if (!provider.stripeAccountId || !provider.stripeChargesEnabled || !provider.stripePayoutsEnabled) {
    throw new HttpsError('failed-precondition', 'The provider must finish Stripe identity and bank-account onboarding before accepting online payment.');
  }
  const currency = String(booking.currency || '').toLowerCase();
  const providerCountryCode = String(provider.countryCode || '').toUpperCase();
  if (!EUROPE_COUNTRIES.has(providerCountryCode) || currency !== COUNTRY_CURRENCY[providerCountryCode] || currency !== String(provider.currency || '').toLowerCase()) {
    throw new HttpsError('failed-precondition', 'The provider country and local currency do not match. Ask the provider to correct their profile.');
  }
  if (!/^[a-z]{3}$/.test(currency)) throw new HttpsError('failed-precondition', 'Booking currency is invalid.');
  const amount = toMinor(booking.estimatedPrice, currency);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new HttpsError('failed-precondition', 'Booking amount is invalid.');
  const stripe = stripeClient(STRIPE_SECRET_KEY.value());
  if (booking.checkoutSessionId) {
    try {
      const previous = await stripe.checkout.sessions.retrieve(booking.checkoutSessionId);
      if (previous.status === 'open' && previous.url) return { url: previous.url };
      if (previous.payment_status === 'paid') throw new HttpsError('already-exists', 'This booking is already paid.');
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.warn('Could not reuse previous Checkout session; creating a new attempt.', err.message);
    }
  }
  const attempt = Number(booking.checkoutAttempt || 0) + 1;
  const base = safeBaseUrl();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    locale: 'auto',
    billing_address_collection: 'auto',
    client_reference_id: bookingId,
    customer_email: request.auth.token.email || undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency,
        unit_amount: amount,
        product_data: { name: `TrustCraft booking: ${String(booking.serviceTitle || 'Service').slice(0, 100)}` }
      }
    }],
    payment_intent_data: { transfer_group: `trustcraft_booking_${bookingId}`, metadata: { bookingId, providerId: booking.providerId, customerId: uid } },
    metadata: { bookingId, providerId: booking.providerId, customerId: uid },
    success_url: `${base}/?payment=success&booking=${encodeURIComponent(bookingId)}#bookings`,
    cancel_url: `${base}/?payment=cancelled&booking=${encodeURIComponent(bookingId)}#bookings`
  }, { idempotencyKey: `trustcraft-checkout-${bookingId}-${attempt}` });
  await bookingRef.update({ paymentStatus: 'checkout_started', checkoutSessionId: session.id, checkoutAttempt: attempt, updatedAt: FieldValue.serverTimestamp() });
  return { url: session.url };
});

exports.stripeWebhook = onRequest({ region: REGION, secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const stripe = stripeClient(STRIPE_SECRET_KEY.value());
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET.value());
  } catch (err) {
    console.error('Stripe webhook signature verification failed.', err.message);
    return res.status(400).send('Invalid webhook signature');
  }
  if (event.type === 'account.updated') {
    const account = event.data.object;
    const uid = account.metadata?.trustcraftUserId;
    if (uid) {
      await db.doc(`providers/${uid}`).set({
        stripeAccountStatus: account.payouts_enabled && account.charges_enabled ? 'active' : (account.details_submitted ? 'review' : 'onboarding'),
        stripeChargesEnabled: !!account.charges_enabled,
        stripePayoutsEnabled: !!account.payouts_enabled,
        stripeRequirementsDue: account.requirements?.currently_due || [],
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId || session.client_reference_id;
    if (bookingId && session.payment_status === 'paid') {
      await db.doc(`bookings/${bookingId}`).set({
        paymentStatus: 'paid',
        paymentProvider: 'stripe',
        stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }
  return res.json({ received: true });
});

async function processProviderPayout(bookingId, booking, stripe) {
  const ledgerRef = db.doc(`commissionLedger/${bookingId}`);
  const existing = await ledgerRef.get();
  if (existing.exists && existing.data().status === 'transferred') return;
  const providerSnap = await db.doc(`providers/${booking.providerId}`).get();
  const provider = providerSnap.data() || {};
  if (!provider.stripeAccountId || !provider.stripePayoutsEnabled) {
    await db.doc(`bookings/${bookingId}`).set({ payoutStatus: 'awaiting_provider_onboarding', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return;
  }
  const gross = Math.round(Number(booking.estimatedPrice || 0) * 100) / 100;
  const rate = commissionRate();
  const fee = Math.round(gross * rate * 100) / 100;
  const net = Math.round((gross - fee) * 100) / 100;
  const amount = toMinor(net, booking.currency);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Provider net transfer amount is invalid.');
  if (!booking.stripePaymentIntentId) throw new Error('Paid booking is missing its Stripe PaymentIntent reference.');
  const paymentIntent = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId, { expand: ['latest_charge'] });
  const sourceTransaction = typeof paymentIntent.latest_charge === 'string' ? paymentIntent.latest_charge : paymentIntent.latest_charge?.id;
  if (!sourceTransaction) throw new Error('Stripe charge is not available for the provider transfer yet.');
  const transfer = await stripe.transfers.create({
    amount,
    currency: String(booking.currency).toLowerCase(),
    destination: provider.stripeAccountId,
    source_transaction: sourceTransaction,
    transfer_group: `trustcraft_booking_${bookingId}`,
    metadata: { bookingId, providerId: booking.providerId, providerOwnerId: booking.providerOwnerId }
  }, { idempotencyKey: `trustcraft-provider-transfer-${bookingId}` });
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ledgerRef);
    if (snap.exists && snap.data().status === 'transferred') return;
    tx.set(ledgerRef, {
      bookingId,
      clientId: booking.clientId,
      providerId: booking.providerId,
      providerOwnerId: booking.providerOwnerId,
      currency: booking.currency,
      grossAmount: gross,
      commissionRate: rate,
      commissionAmount: fee,
      providerNetAmount: net,
      status: 'transferred',
      stripeTransferId: transfer.id,
      transferredAt: FieldValue.serverTimestamp(),
      createdAt: snap.exists ? (snap.data().createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp()
    });
    tx.set(db.doc(`bookings/${bookingId}`), { payoutStatus: 'transferred_to_connected_account', stripeTransferId: transfer.id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

// Release the provider's net amount only when the booking is completed and the customer payment is confirmed.
exports.releaseProviderPayout = onDocumentUpdated({ document: 'bookings/{bookingId}', region: REGION, retry: true, secrets: [STRIPE_SECRET_KEY] }, async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  const wasReady = before.status === 'completed' && before.paymentStatus === 'paid';
  const isReady = after.status === 'completed' && after.paymentStatus === 'paid';
  if (!isReady || wasReady) return;
  await processProviderPayout(event.params.bookingId, after, stripeClient(STRIPE_SECRET_KEY.value()));
});

// If the customer paid and the provider completed the job before finishing Connect onboarding,
// retry the pending release as soon as the provider's payout account becomes active.
exports.retryProviderPayouts = onDocumentUpdated({ document: 'providers/{providerId}', region: REGION, retry: true, secrets: [STRIPE_SECRET_KEY] }, async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};
  if (before.stripePayoutsEnabled === after.stripePayoutsEnabled || !after.stripePayoutsEnabled) return;
  const pending = await db.collection('bookings')
    .where('providerId', '==', event.params.providerId)
    .where('status', '==', 'completed')
    .where('paymentStatus', '==', 'paid')
    .get();
  const stripe = stripeClient(STRIPE_SECRET_KEY.value());
  for (const bookingDoc of pending.docs) {
    if (bookingDoc.data().payoutStatus === 'transferred_to_connected_account') continue;
    await processProviderPayout(bookingDoc.id, bookingDoc.data(), stripe);
  }
});

// Keep provider averages correct after review creation, edits, or deletion.
exports.recalculateProviderRating = onDocumentWritten({ document: 'providers/{providerId}/reviews/{reviewId}', region: REGION, retry: true }, async (event) => {
  const providerId = event.params.providerId;
  const reviews = await db.collection(`providers/${providerId}/reviews`).get();
  const valid = reviews.docs.map((d) => d.data()).filter((r) => r.published === true && Number(r.rating) >= 1 && Number(r.rating) <= 5);
  const average = valid.length ? valid.reduce((sum, r) => sum + Number(r.rating), 0) / valid.length : 0;
  await db.doc(`providers/${providerId}`).update({
    rating: Math.round(average * 100) / 100,
    reviewCount: valid.length,
    updatedAt: FieldValue.serverTimestamp()
  });
});
