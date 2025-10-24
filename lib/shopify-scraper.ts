/**
 * Shopify Store Scraper
 * Fetches product data from any Shopify store's products.json endpoint
 */

import { ScrapedProduct } from "./product-uploader";

export interface ScrapeResult {
  success: boolean;
  products?: ScrapedProduct[];
  count?: number;
  error?: string;
  storeDomain?: string;
}

/**
 * Extract domain from various URL formats
 */
export function extractDomain(input: string): string {
  try {
    // Remove protocol if present
    let domain = input.replace(/^https?:\/\//, "");

    // Remove path if present
    domain = domain.split("/")[0];

    // Remove port if present
    domain = domain.split(":")[0];

    // Remove www. prefix if present
    domain = domain.replace(/^www\./, "");

    return domain;
  } catch {
    return input;
  }
}

/**
 * Build Shopify products.json URL
 */
export function buildProductsUrl(domain: string): string {
  const cleanDomain = extractDomain(domain);

  // Check if it already has myshopify.com
  if (cleanDomain.includes("myshopify.com")) {
    return `https://${cleanDomain}/products.json?limit=250`;
  }

  // Otherwise use the custom domain
  return `https://${cleanDomain}/products.json?limit=250`;
}

/**
 * Fetch products from a Shopify store with pagination
 */
export async function scrapeShopifyStore(
  domain: string,
  options: {
    maxProducts?: number;
    includeAll?: boolean;
  } = {}
): Promise<ScrapeResult> {
  const { maxProducts = 250000, includeAll = true } = options;

  try {
    const cleanDomain = extractDomain(domain);
    const baseUrl = buildProductsUrl(cleanDomain);

    let allProducts: ScrapedProduct[] = [];
    let page = 1;
    let hasMore = true;

    // Shopify's products.json endpoint supports pagination
    // We'll fetch in batches of 250 (max per page)
    while (hasMore && (includeAll || allProducts.length < maxProducts)) {
      const url = page === 1 ? baseUrl : `${baseUrl}&page=${page}`;

      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; ProductScraper/1.0)",
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Store not found. Make sure the domain is correct.");
        }
        throw new Error(
          `Failed to fetch products: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      if (!data.products || !Array.isArray(data.products)) {
        throw new Error("Invalid response format from store");
      }

      // If no products returned, we've reached the end
      if (data.products.length === 0) {
        hasMore = false;
        break;
      }

      allProducts = [...allProducts, ...data.products];

      // Check if we got less than 250 products (indicates last page)
      if (data.products.length < 250) {
        hasMore = false;
      }

      page++;

      // Safety limit to prevent infinite loops
      if (page > 100) {
        console.warn("Reached maximum page limit (100)");
        break;
      }
    }

    return {
      success: true,
      products: allProducts,
      count: allProducts.length,
      storeDomain: cleanDomain,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Fetch all products without pagination limit (using limit parameter)
 */
export async function scrapeShopifyStoreUnlimited(
  domain: string
): Promise<ScrapeResult> {
  try {
    const cleanDomain = extractDomain(domain);
    // Use a very large limit to get all products in one request
    const url = `https://${cleanDomain}/products.json?limit=1000000000`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; ProductScraper/1.0)",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Store not found. Make sure the domain is correct.");
      }
      throw new Error(
        `Failed to fetch products: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();

    if (!data.products || !Array.isArray(data.products)) {
      throw new Error("Invalid response format from store");
    }

    return {
      success: true,
      products: data.products,
      count: data.products.length,
      storeDomain: cleanDomain,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Download products as JSON file
 */
export function downloadProductsJson(
  products: ScrapedProduct[],
  storeDomain: string
) {
  const dataStr = JSON.stringify({ products }, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${storeDomain}-products-${
    new Date().toISOString().split("T")[0]
  }.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Validate Shopify domain format
 */
export function isValidShopifyDomain(domain: string): boolean {
  if (!domain || domain.trim().length === 0) {
    return false;
  }

  const cleanDomain = extractDomain(domain);

  // Basic domain validation
  const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]*[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;

  return domainRegex.test(cleanDomain);
}
