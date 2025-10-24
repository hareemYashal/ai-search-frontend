/**
 * API Route for uploading products to Shopify
 * POST /api/shopify/upload
 */

import { NextRequest, NextResponse } from "next/server";
import { createShopifyAdminClient } from "@/lib/shopify-admin-fetch";
import {
  uploadProductsFromJSON,
  validateProducts,
} from "@/lib/product-uploader";
import productsData from "@/heme-products.json";

export async function POST(request: NextRequest) {
  try {
    // Parse request body for options
    const body = await request.json().catch(() => ({}));
    const { batchSize = 10, delayBetweenBatches = 1000 } = body;

    // Validate products
    const validation = validateProducts(productsData.products);
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
    const result = await uploadProductsFromJSON(client, productsData, {
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

export async function GET() {
  try {
    // Return product count and validation status
    const validation = validateProducts(productsData.products);

    return NextResponse.json({
      totalProducts: productsData.products.length,
      validation,
    });
  } catch (error) {
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
