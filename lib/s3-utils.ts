import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ScrapedProduct } from "./product-uploader";

const s3Client = new S3Client({
  region: process.env.S3_BUCKET_REGION || process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export interface S3UploadResult {
  success: boolean;
  key?: string;
  error?: string;
}

export async function uploadJsonlToS3(
  products: ScrapedProduct[],
  filename: string,
  directory: string = process.env.S3_DIRECTORY_NAME || "scraped-products"
): Promise<S3UploadResult> {
  try {
    // Validate environment variables
    if (
      !process.env.AWS_ACCESS_KEY_ID ||
      !process.env.AWS_SECRET_ACCESS_KEY ||
      !process.env.AWS_REGION ||
      !process.env.S3_BUCKET_NAME
    ) {
      throw new Error("AWS credentials or S3 configuration missing");
    }

    // Convert products to JSONL format
    const jsonlContent = products;

    // Create the key with directory
    const key = `${directory}/${filename}.jsonl`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      //@ts-ignore
      Body: jsonlContent,
      ContentType: "application/jsonl",
      Metadata: {
        "uploaded-at": new Date().toISOString(),
        "product-count": products.length.toString(),
        source: "shopify-scraper",
      },
    });

    await s3Client.send(command);

    return {
      success: true,
      key: key,
    };
  } catch (error) {
    console.error("S3 upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown S3 upload error",
    };
  }
}
