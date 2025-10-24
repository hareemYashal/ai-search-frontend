import { NextRequest, NextResponse } from "next/server";
import { createShopifyAdminClient } from "@/lib/shopify-admin-fetch";
import { fetchProducts } from "@/lib/shopify-mutations";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const first = parseInt(searchParams.get("first") || "50");
    const after = searchParams.get("after") || undefined;
    const query = searchParams.get("query") || undefined;

    // Create Shopify Admin API client
    const client = createShopifyAdminClient();

    // Fetch products
    const result = await fetchProducts(client, {
      first,
      after,
      query,
    });

    return NextResponse.json({
      success: true,
      products: result.products,
      pageInfo: result.pageInfo,
    });
  } catch (error) {
    console.error("Failed to fetch products:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch products",
      },
      { status: 500 }
    );
  }
}
