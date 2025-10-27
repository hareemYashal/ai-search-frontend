/**
 * API Route for scraping products from Shopify stores
 * POST /api/shopify/scrape
 */

import { NextRequest, NextResponse } from "next/server";
import { scrapeShopifyStore } from "@/lib/shopify-scraper";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain } = body;

    if (!domain) {
      return NextResponse.json(
        {
          success: false,
          error: "Domain is required",
        },
        { status: 400 }
      );
    }

    // Scrape the store with retry logic and delays
    console.log(`Starting scrape for domain: ${domain}`);
    const result = await scrapeShopifyStore(domain, {
      includeAll: true,
      delayBetweenPages: 3000, // 3 second delay between pages
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      products: result.products,
      count: result.count,
      storeDomain: result.storeDomain,
    });
  } catch (error) {
    console.error("Scrape error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}
