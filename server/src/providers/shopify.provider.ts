import { searchProducts } from '../services/shopify';
import { UnifiedProduct, UnifiedVariant, ProductIntent } from './types';

const USD_TO_INR = 84;

function toINR(usdStr: string): number {
  return Math.max(Math.round(parseFloat(usdStr) * USD_TO_INR), 10);
}

function fmt(inr: number): string {
  return `₹${inr.toLocaleString('en-IN')}`;
}

function mapVariant(v: any): UnifiedVariant {
  const priceINR = toINR(v.price);
  return {
    id: v.id,
    name: v.title,
    priceINR,
    priceDisplay: fmt(priceINR),
    inStock: v.available,
  };
}

function mapProduct(p: any): UnifiedProduct {
  // Sort variants by price asc — first available one is the default
  const sortedVariants = [...p.variants].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  const defaultVariant = sortedVariants.find((v) => v.available) ?? sortedVariants[0];
  const priceINR = toINR(defaultVariant?.price ?? p.priceRange.min);

  return {
    id: p.id,
    variantId: defaultVariant?.id ?? '',
    title: p.title,
    vendor: p.vendor,
    priceINR,
    priceDisplay: fmt(priceINR),
    description: p.description,
    imageUrl: p.imageUrl,
    inStock: p.variants.some((v: any) => v.available),
    variants: sortedVariants.map(mapVariant),
    source: 'shopify',
  };
}

export async function shopifyProviderSearch(intent: ProductIntent): Promise<UnifiedProduct[]> {
  console.log(`[Shopify Provider] Searching for: "${intent.query}" | budget: ${intent.budget ? fmt(intent.budget) : 'none'} | sort: ${intent.sort}`);

  // Fetch more than we need to allow budget filtering headroom
  const raw = await searchProducts(intent.query, 8);
  let products = raw.map(mapProduct);

  console.log(`[Shopify Provider] Raw results before filter: ${products.length}`);

  // Apply budget filter (uses INR-equivalent price)
  if (intent.budget !== null) {
    const beforeCount = products.length;
    products = products.filter((p) => p.priceINR <= intent.budget!);
    console.log(`[Shopify Provider] Budget filter ≤${fmt(intent.budget)}: ${beforeCount} → ${products.length} products`);
  }

  // Apply preference filter (color/material keyword matching on title)
  if (intent.preferences.length > 0) {
    const prefFiltered = products.filter((p) =>
      intent.preferences.some((pref) =>
        p.title.toLowerCase().includes(pref) ||
        p.description.toLowerCase().includes(pref) ||
        p.variants.some((v) => v.name.toLowerCase().includes(pref))
      )
    );
    // Only apply preference filter if it returns results; otherwise keep all
    if (prefFiltered.length > 0) products = prefFiltered;
  }

  // Apply sort
  if (intent.sort === 'price_asc') {
    products.sort((a, b) => a.priceINR - b.priceINR);
  } else if (intent.sort === 'price_desc') {
    products.sort((a, b) => b.priceINR - a.priceINR);
  }

  console.log(`[Shopify Provider] Final results: ${products.length}`);
  return products.slice(0, 5);
}
