'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { COUNTRY_CURRENCY, isSupportedProviderCountry, toMinor } = require('./payment-config');

test('supported provider countries always have a local currency', () => {
  for (const [country, currency] of Object.entries(COUNTRY_CURRENCY)) {
    assert.equal(isSupportedProviderCountry(country), true);
    assert.match(currency, /^[a-z]{3}$/);
  }
  assert.equal(isSupportedProviderCountry('MA'), false);
  assert.equal(isSupportedProviderCountry('US'), false);
});

test('two-decimal currencies convert to minor units', () => {
  assert.equal(toMinor(12.34, 'eur'), 1234);
  assert.equal(toMinor(10.5, 'gbp'), 1050);
});

test('zero-decimal currencies convert without multiplying', () => {
  assert.equal(toMinor(500, 'jpy'), 500);
});

test('ISK rejects fractional króna and uses Stripe two-decimal representation', () => {
  assert.equal(toMinor(5, 'isk'), 500);
  assert.throws(() => toMinor(5.5, 'isk'), /whole króna/);
});

test('HUF charges keep two-decimal minor units; Stripe bank payouts handle whole-forint payout constraints', () => {
  assert.equal(toMinor(10.45, 'huf'), 1045);
});
