import { UnifiedProduct, ProductIntent } from './types';

// ─── WooCommerce Adapter — scaffold ──────────────────────────────────────────
// To connect a WooCommerce store, add to your .env:
//   WOOCOMMERCE_URL=https://yourstore.com
//   WOOCOMMERCE_KEY=ck_xxxxxxxxxxxx
//   WOOCOMMERCE_SECRET=cs_xxxxxxxxxxxx
//
// WooCommerce REST API docs:
//   https://woocommerce.github.io/woocommerce-rest-api-docs/

const WOO_URL = process.env.WOOCOMMERCE_URL;
const WOO_KEY = process.env.WOOCOMMERCE_KEY;
const WOO_SECRET = process.env.WOOCOMMERCE_SECRET;

export async function woocommerceProviderSearch(intent: ProductIntent): Promise<UnifiedProduct[]> {
  if (!WOO_URL || !WOO_KEY || !WOO_SECRET) {
    // Silently skip — not configured
    return [];
  }

  try {
    const auth = Buffer.from(`${WOO_KEY}:${WOO_SECRET}`).toString('base64');
    const params = new URLSearchParams({
      search: intent.query,
      per_page: '8',
      status: 'publish',
      in_stock: 'true',
    });

    const res = await fetch(`${WOO_URL}/wp-json/wc/v3/products?${params}`, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!res.ok) {
      console.error(`[WooCommerce] API error: ${res.status}`);
      return [];
    }

    const items = await res.json() as any[];
    console.log(`[WooCommerce] Raw results: ${items.length} for "${intent.query}"`);

    const products: UnifiedProduct[] = items.map((item: any) => {
      const priceINR = Math.round(parseFloat(item.price || item.regular_price || '0'));
      return {
        id: `woo_${item.id}`,
        variantId: `woo_${item.id}`,
        title: item.name,
        vendor: item.brands?.[0]?.name ?? WOO_URL!.replace('https://', '').split('.')[0],
        priceINR,
        priceDisplay: `₹${priceINR.toLocaleString('en-IN')}`,
        description: (item.short_description ?? '').replace(/<[^>]+>/g, '').slice(0, 120),
        imageUrl: item.images?.[0]?.src ?? null,
        inStock: item.stock_status === 'instock',
        variants: (item.variations ?? []).map((v: any) => ({
          id: `woo_var_${v}`,
          name: 'Default',
          priceINR,
          priceDisplay: `₹${priceINR.toLocaleString('en-IN')}`,
          inStock: true,
        })),
        source: 'woocommerce',
        externalUrl: item.permalink,
      };
    });

    // Apply budget filter
    const filtered = intent.budget
      ? products.filter((p) => p.priceINR <= intent.budget!)
      : products;

    // Apply sort
    if (intent.sort === 'price_asc') filtered.sort((a, b) => a.priceINR - b.priceINR);
    else if (intent.sort === 'price_desc') filtered.sort((a, b) => b.priceINR - a.priceINR);

    return filtered.slice(0, 5);
  } catch (err: any) {
    console.error('[WooCommerce] Search failed:', err.message);
    return [];
  }
}
