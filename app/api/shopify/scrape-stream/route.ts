/**
 * API Route for scraping products from Shopify stores with real-time streaming
 * POST /api/shopify/scrape-stream
 */

import { NextRequest } from "next/server";
import {
  extractDomain,
  buildProductsUrl,
  getShopifyProductUrl,
} from "@/lib/shopify-scraper";
import { ScrapedProduct } from "@/lib/product-uploader";

/**
 * Helper function to fetch with retry and exponential backoff
 */
async function fetchWithRetry(
  url: string,
  maxRetries = 5,
  initialDelay = 2000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });

      // If rate limited, wait and retry with exponential backoff
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        const waitTime = retryAfter
          ? parseInt(retryAfter) * 1000
          : initialDelay * Math.pow(2, attempt);

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries - 1) {
        const waitTime = initialDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError || new Error("Failed to fetch after multiple retries");
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const { domain } = await request.json();

  if (!domain) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Domain is required",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const sendUpdate = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const cleanDomain = extractDomain(domain);
        const baseUrl = buildProductsUrl(cleanDomain);

        let allProducts: ScrapedProduct[] = [];
        let page = 1;
        let hasMore = true;
        const delayBetweenPages = 3000;

        sendUpdate({ type: "start", domain: cleanDomain });

        // Shopify pagination - fetch until we get less than 250 products or empty response
        while (hasMore) {
          sendUpdate({ type: "fetching", page, total: allProducts.length });

          const url = `${baseUrl}?limit=250&page=${page}`;
          const response = await fetchWithRetry(url);

          if (!response.ok) {
            if (response.status === 404) {
              throw new Error(
                "Store not found. Make sure the domain is correct."
              );
            }
            // If we got a bad request on page > 1, it might be pagination limit
            if (response.status === 400 && page > 1) {
              sendUpdate({
                type: "warning",
                message: `Received 400 error on page ${page}. Likely reached pagination limit. Stopping with ${allProducts.length} products.`,
              });
              hasMore = false;
              break;
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

          // Add URLs to products
          data.products.forEach((product: ScrapedProduct) => {
            product.url = getShopifyProductUrl(product, cleanDomain);
          });

          allProducts = [...allProducts, ...data.products];

          sendUpdate({
            type: "progress",
            page,
            fetched: data.products.length,
            total: allProducts.length,
          });

          // Check if we got less than 250 products (indicates last page)
          if (data.products.length < 250) {
            hasMore = false;
          }

          page++;

          // Add delay between requests to avoid rate limiting
          if (hasMore && delayBetweenPages > 0) {
            sendUpdate({
              type: "waiting",
              delay: delayBetweenPages,
              page,
              total: allProducts.length,
            });
            await new Promise((resolve) =>
              setTimeout(resolve, delayBetweenPages)
            );
          }

          // Shopify typically limits pagination to ~100 pages
          // If we've reached page 100, check if there are still products
          if (page >= 100) {
            sendUpdate({
              type: "warning",
              message: `Reached page ${page}. Shopify may have pagination limits. Total products: ${allProducts.length}`,
            });
            // Continue but be aware we might hit limits
          }

          // Safety limit to prevent infinite loops
          if (page > 150) {
            sendUpdate({
              type: "warning",
              message: `Stopping at page ${page} for safety. Total products: ${allProducts.length}`,
            });
            break;
          }
        }

        // Send completion metadata first
        sendUpdate({
          type: "complete",
          count: allProducts.length,
          storeDomain: cleanDomain,
        });

        // Send products in chunks to avoid JSON size limits
        const chunkSize = 100;
        for (let i = 0; i < allProducts.length; i += chunkSize) {
          const chunk = allProducts.slice(i, i + chunkSize);
          sendUpdate({
            type: "products",
            chunk,
            chunkIndex: Math.floor(i / chunkSize),
            totalChunks: Math.ceil(allProducts.length / chunkSize),
          });
        }

        sendUpdate({ type: "done" });
        controller.close();
      } catch (error) {
        sendUpdate({
          type: "error",
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
