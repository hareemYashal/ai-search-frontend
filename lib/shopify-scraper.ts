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
 *
 * @param domain - The domain of the Shopify store
 * @returns The URL of the Shopify store
 */

export function getShopifyProductUrl(product: ScrapedProduct, domain: string) {
  if (!product || !product.handle) {
    throw new Error("Invalid product object");
  }
  return `https://${domain}/products/${product.handle}`;
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

      data.products.forEach((product: ScrapedProduct) => {
        product.url = getShopifyProductUrl(product, cleanDomain);
      });

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

    // Add product URLs to each product
    data.products.forEach((product: ScrapedProduct) => {
      product.url = getShopifyProductUrl(product, cleanDomain);
    });

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
 * Convert scraped products to JSONL format
 * Each line is a JSON object with: product_id, title, text, price, url, image, in_stock, category, tags
 */
export function convertToJsonl(
  products: ScrapedProduct[],
  storeDomain: string
): string {
  return products
    .map((product) => {
      // Extract the first variant price (as a number)
      const price = product.variants?.[0]?.price
        ? parseFloat(product.variants[0].price)
        : 0.0;

      // Get the first image URL
      const image = product.images?.[0]?.src || "";

      // Determine in_stock status (if any variant is available)
      const in_stock = product.variants?.some((v) => v.available) || false;

      // Use product_type as category
      const category = product.product_type || "";

      // Convert tags array to array (keep as is if it's already an array)
      const tags = Array.isArray(product.tags) ? product.tags : [];

      // Create the JSONL object
      const jsonlObject = {
        product_id: product.id.toString(),
        title: product.title || "",
        text: product.body_html ? stripHtml(product.body_html) : "",
        price: price,
        url: product.url || "",
        image: image,
        in_stock: in_stock,
        category: category,
        tags: tags,
      };

      return JSON.stringify(jsonlObject);
    })
    .join("\n");
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, " ");

  // Replace multiple spaces with single space
  text = text.replace(/\s+/g, " ");

  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");

  // Trim whitespace
  return text.trim();
}

/**
 * Download products as JSONL file
 */
export function downloadProductsJsonl(
  products: ScrapedProduct[],
  storeDomain: string
) {
  const jsonlContent = convertToJsonl(products, storeDomain);
  const dataBlob = new Blob([jsonlContent], { type: "application/jsonl" });
  const url = URL.createObjectURL(dataBlob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `${storeDomain}-products-${
    new Date().toISOString().split("T")[0]
  }.jsonl`;
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
