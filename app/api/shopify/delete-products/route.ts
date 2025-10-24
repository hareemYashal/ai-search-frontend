import { NextRequest, NextResponse } from "next/server";
import { createShopifyAdminClient } from "@/lib/shopify-admin-fetch";
import { deleteProducts } from "@/lib/shopify-mutations";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productIds } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No product IDs provided",
        },
        { status: 400 }
      );
    }

    // Create Shopify Admin API client
    const client = createShopifyAdminClient();

    // Delete products
    const result = await deleteProducts(client, productIds);

    return NextResponse.json({
      success: true,
      result: {
        successful: result.successful,
        failed: result.failed,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error("Failed to delete products:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to delete products",
      },
      { status: 500 }
    );
  }
}
