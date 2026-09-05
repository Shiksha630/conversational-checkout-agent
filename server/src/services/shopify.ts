import { config } from '../config';

const SHOPIFY_URL = `https://${config.shopify.storeDomain}/api/${config.shopify.apiVersion}/graphql.json`;
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Shopify-Storefront-Access-Token': config.shopify.storefrontToken,
};

async function shopifyGQL(query: string, variables: Record<string, any> = {}): Promise<any> {
  const res = await fetch(SHOPIFY_URL, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`Shopify API error: ${res.status} ${res.statusText}`);
  const json = await res.json() as any;
  if (json.errors?.length) throw new Error(`Shopify GraphQL error: ${json.errors[0].message}`);
  return json.data;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  vendor: string;
  priceRange: { min: string; max: string; currency: string };
  imageUrl: string | null;
  variants: ShopifyVariant[];
  handle: string;
}

export interface ShopifyVariant {
  id: string;
  title: string;
  price: string;
  currency: string;
  available: boolean;
}

export interface ShopifyCart {
  cartId: string;
  checkoutUrl: string;
  totalAmount: string;
  currency: string;
  lines: Array<{ title: string; quantity: number; price: string }>;
}

export async function searchProducts(query: string, limit = 5): Promise<ShopifyProduct[]> {
  const gql = `
    query SearchProducts($query: String!, $first: Int!) {
      products(first: $first, query: $query) {
        edges {
          node {
            id title description vendor handle
            featuredImage { url }
            priceRange {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            variants(first: 5) {
              edges {
                node {
                  id title
                  price { amount currencyCode }
                  availableForSale
                }
              }
            }
          }
        }
      }
    }
  `;
  const data = await shopifyGQL(gql, { query, first: limit });
  const edges = data?.products?.edges ?? [];
  return edges.map((e: any) => {
    const p = e.node;
    const minPrice = p.priceRange.minVariantPrice;
    const maxPrice = p.priceRange.maxVariantPrice;
    return {
      id: p.id, title: p.title,
      description: (p.description || '').slice(0, 120),
      vendor: p.vendor, handle: p.handle,
      imageUrl: p.featuredImage?.url ?? null,
      priceRange: {
        min: parseFloat(minPrice.amount).toFixed(2),
        max: parseFloat(maxPrice.amount).toFixed(2),
        currency: minPrice.currencyCode,
      },
      variants: p.variants.edges.map((v: any) => ({
        id: v.node.id, title: v.node.title,
        price: parseFloat(v.node.price.amount).toFixed(2),
        currency: v.node.price.currencyCode,
        available: v.node.availableForSale,
      })),
    } as ShopifyProduct;
  });
}

export async function getProduct(productId: string): Promise<ShopifyProduct | null> {
  const gql = `
    query GetProduct($id: ID!) {
      product(id: $id) {
        id title description vendor handle
        featuredImage { url }
        priceRange {
          minVariantPrice { amount currencyCode }
          maxVariantPrice { amount currencyCode }
        }
        variants(first: 10) {
          edges { node { id title price { amount currencyCode } availableForSale } }
        }
      }
    }
  `;
  const data = await shopifyGQL(gql, { id: productId });
  const p = data?.product;
  if (!p) return null;
  const minPrice = p.priceRange.minVariantPrice;
  const maxPrice = p.priceRange.maxVariantPrice;
  return {
    id: p.id, title: p.title,
    description: (p.description || '').slice(0, 120),
    vendor: p.vendor, handle: p.handle,
    imageUrl: p.featuredImage?.url ?? null,
    priceRange: {
      min: parseFloat(minPrice.amount).toFixed(2),
      max: parseFloat(maxPrice.amount).toFixed(2),
      currency: minPrice.currencyCode,
    },
    variants: p.variants.edges.map((v: any) => ({
      id: v.node.id, title: v.node.title,
      price: parseFloat(v.node.price.amount).toFixed(2),
      currency: v.node.price.currencyCode,
      available: v.node.availableForSale,
    })),
  };
}

export async function createCart(variantId: string, quantity = 1): Promise<ShopifyCart> {
  const gql = `
    mutation CreateCart($variantId: ID!, $quantity: Int!) {
      cartCreate(input: { lines: [{ merchandiseId: $variantId, quantity: $quantity }] }) {
        cart {
          id checkoutUrl
          cost { totalAmount { amount currencyCode } }
          lines(first: 10) {
            edges {
              node {
                quantity
                merchandise {
                  ... on ProductVariant {
                    title price { amount currencyCode }
                    product { title }
                  }
                }
              }
            }
          }
        }
        userErrors { field message }
      }
    }
  `;
  const data = await shopifyGQL(gql, { variantId, quantity });
  const errors = data?.cartCreate?.userErrors ?? [];
  if (errors.length > 0) throw new Error(`Cart creation failed: ${errors[0].message}`);
  const cart = data.cartCreate.cart;
  const total = cart.cost.totalAmount;
  const lines = (cart.lines.edges ?? []).map((e: any) => {
    const m = e.node.merchandise;
    return { title: `${m.product.title} — ${m.title}`, quantity: e.node.quantity, price: parseFloat(m.price.amount).toFixed(2) };
  });
  return { cartId: cart.id, checkoutUrl: cart.checkoutUrl, totalAmount: parseFloat(total.amount).toFixed(2), currency: total.currencyCode, lines };
}

// Convert USD → INR for Razorpay (demo store prices in USD; real Indian Shopify stores use INR)
export function toINR(usdAmount: string): number {
  return Math.max(Math.round(parseFloat(usdAmount) * 84), 10);
}
