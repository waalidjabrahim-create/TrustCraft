'use strict';

const EUROPE_COUNTRIES = new Set([
  'AT','BE','BG','CH','CY','CZ','DE','DK','EE','ES','FI','FR','GB','GI','GR','HR','HU','IE','IS','IT','LI','LT','LU','LV','MT','NL','NO','PL','PT','RO','SE','SI','SK'
]);
const COUNTRY_CURRENCY = Object.freeze({
  AT:'eur', BE:'eur', BG:'eur', CH:'chf', CY:'eur', CZ:'czk', DE:'eur', DK:'dkk', EE:'eur', ES:'eur', FI:'eur', FR:'eur', GB:'gbp', GI:'gbp', GR:'eur', HR:'eur', HU:'huf', IE:'eur', IS:'isk', IT:'eur', LI:'chf', LT:'eur', LU:'eur', LV:'eur', MT:'eur', NL:'eur', NO:'nok', PL:'pln', PT:'eur', RO:'ron', SE:'sek', SI:'eur', SK:'eur'
});
const ZERO_DECIMAL = new Set(['bif','clp','djf','gnf','jpy','kmf','krw','mga','pyg','rwf','ugx','vnd','vuv','xaf','xof','xpf']);
const isSupportedProviderCountry = (countryCode) => EUROPE_COUNTRIES.has(String(countryCode || '').toUpperCase()) && !!COUNTRY_CURRENCY[String(countryCode || '').toUpperCase()];
const toMinor = (amount, currency) => {
  const value = Number(amount);
  const code = String(currency || '').toLowerCase();
  if (!Number.isFinite(value) || value < 0) throw new Error('Amount must be a non-negative finite number.');
  if (code === 'isk' && !Number.isInteger(value)) throw new Error('ISK amounts must be whole króna.');
  return Math.round(value * (ZERO_DECIMAL.has(code) ? 1 : 100));
};
module.exports = { EUROPE_COUNTRIES, COUNTRY_CURRENCY, ZERO_DECIMAL, isSupportedProviderCountry, toMinor };
