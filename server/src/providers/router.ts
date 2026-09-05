import { shopifyProviderSearch } from './shopify.provider';
import { woocommerceProviderSearch } from './woocommerce.provider';
import { UnifiedProduct, ProductIntent } from './types';

// ─── Product Provider Router ──────────────────────────────────────────────────
// Queries all configured providers in parallel, merges results, applies
// global sort. This is the single entry point for ALL product searches.

export async function searchAllProviders(intent: ProductIntent): Promise<UnifiedProduct[]> {
  console.log(`\n[Router] ── Product Search ──`);
  console.log(`[Router] Query    : "${intent.query}"`);
  console.log(`[Router] Budget   : ${intent.budget ? `₹${intent.budget.toLocaleString('en-IN')}` : 'none'}`);
  console.log(`[Router] Sort     : ${intent.sort}`);
  console.log(`[Router] Prefs    : ${intent.preferences.join(', ') || 'none'}`);

  // Run all providers in parallel; capture failures without crashing
  const [shopifyResult, wooResult] = await Promise.allSettled([
    shopifyProviderSearch(intent),
    woocommerceProviderSearch(intent),
  ]);

  const merged: UnifiedProduct[] = [];

  if (shopifyResult.status === 'fulfilled') {
    console.log(`[Router] Shopify  : ${shopifyResult.value.length} results`);
    merged.push(...shopifyResult.value);
  } else {
    console.error('[Router] Shopify provider failed:', shopifyResult.reason);
  }

  if (wooResult.status === 'fulfilled' && wooResult.value.length > 0) {
    console.log(`[Router] WooCommerce: ${wooResult.value.length} results`);
    merged.push(...wooResult.value);
  }

  // Global sort across all merged results
  if (intent.sort === 'price_asc') {
    merged.sort((a, b) => a.priceINR - b.priceINR);
  } else if (intent.sort === 'price_desc') {
    merged.sort((a, b) => b.priceINR - a.priceINR);
  }

  console.log(`[Router] Total merged results: ${merged.length}`);
  console.log(`[Router] ──────────────────\n`);

  return merged.slice(0, 5);
}
