import { NextResponse } from "next/server";
import { createShopifyAdminClient } from "@/lib/shopify-admin-fetch";
import { fetchProducts } from "@/lib/shopify-mutations";

/**
 * Test endpoint to check product details including images and prices
 */
export async function GET() {
  try {
    const client = createShopifyAdminClient();

    // Fetch first product to inspect
    const result = await fetchProducts(client, { first: 5 });

    return NextResponse.json({
      success: true,
      productCount: result.products.length,
      sampleProduct: result.products[0] || null,
      allProducts: result.products,
    });
  } catch (error) {
    console.error("Test failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Test failed",
      },
      { status: 500 }
    );
  }
}
