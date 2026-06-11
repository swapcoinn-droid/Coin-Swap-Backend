// Agarra rates en cache por 1 hora
let cache = { rates: null, fetchedAt: 0 };
const TTL = 60 * 60 * 1000; // la hora en cuestión

export async function getRates() {
  if (cache.rates && Date.now() - cache.fetchedAt < TTL) {
    return cache.rates;
  }
  const res = await fetch(
    `https://v6.exchangerate-api.com/v6/${process.env.EXCHANGE_API_KEY}/latest/USD`
  );
  if (!res.ok) throw new Error('Exchange rate API error');
  const data = await res.json();
  cache = { rates: data.conversion_rates, fetchedAt: Date.now() };
  return cache.rates;
}

// Convierte de moneda a moneda
export async function convert(amount, fromCode, toCode) {
  const rates = await getRates();
  const fromRate = rates[fromCode]; // precio de la moneda en USD
  const toRate = rates[toCode]; // precio de la moneda a convertir
  const inUSD = amount / fromRate; // convertir a USD
  return +(inUSD * toRate).toFixed(2);
}