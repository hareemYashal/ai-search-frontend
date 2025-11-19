import { NextRequest, NextResponse } from "next/server";
import { uploadJsonlToS3 } from "@/lib/s3-utils";
import { ScrapedProduct } from "@/lib/product-uploader";

export async function POST(request: NextRequest) {
  try {
    const { products, filename } = await request.json();

    // Validate input
    if (!products) {
      return NextResponse.json(
        { success: false, error: "No products provided" },
        { status: 400 }
      );
    }

    if (
      !filename ||
      typeof filename !== "string" ||
      filename.trim().length === 0
    ) {
      return NextResponse.json(
        { success: false, error: "Filename is required" },
        { status: 400 }
      );
    }

    // Validate filename (no path traversal, reasonable length)
    const cleanFilename = filename.trim();
    if (cleanFilename.length > 100 || /[\\/:*?"<>|]/.test(cleanFilename)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid filename. Use only letters, numbers, spaces, and basic punctuation.",
        },
        { status: 400 }
      );
    }

    // Upload to S3
    const result = await uploadJsonlToS3(products, cleanFilename);

    if (result.success) {
      return NextResponse.json({
        success: true,
        key: result.key,
        message: `Successfully uploaded ${products.length} products to S3 as ${cleanFilename}.jsonl`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("S3 upload API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
