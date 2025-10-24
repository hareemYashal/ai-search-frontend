/**
 * API Route for uploading scraped products to Shopify
 * POST /api/shopify/upload-scraped
 */

import { NextRequest, NextResponse } from "next/server";
import { createShopifyAdminClient } from "@/lib/shopify-admin-fetch";
import {
  uploadProducts,
  validateProducts,
  ScrapedProduct,
} from "@/lib/product-uploader";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { products, batchSize = 10, delayBetweenBatches = 1000 } = body;

    if (!products || !Array.isArray(products)) {
      return NextResponse.json(
        {
          success: false,
          error: "Products array is required",
        },
        { status: 400 }
      );
    }

    // Validate products
    const validation = validateProducts(products as ScrapedProduct[]);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Product validation failed",
          details: validation.errors,
        },
        { status: 400 }
      );
    }

    // Create Shopify client
    const client = createShopifyAdminClient();

    // Upload products
    const result = await uploadProducts(client, products as ScrapedProduct[], {
      batchSize,
      delayBetweenBatches,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    console.error("Upload error:", error);
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
