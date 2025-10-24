/**
 * Product Uploader
 * Handles the conversion and upload of scraped product data to Shopify
 */

import { ShopifyAdminAPI } from "./shopify-admin-fetch";
import {
  createProductWithVariants,
  addProductMedia,
} from "./shopify-mutations";

// ==================== Types ====================

export interface ScrapedProduct {
  id: number;
  title: string;
  handle: string;
  body_html: string;
  published_at: string;
  created_at: string;
  updated_at: string;
  vendor: string;
  product_type: string;
  tags: string[];
  variants: ScrapedVariant[];
  images: ScrapedImage[];
}

export interface ScrapedVariant {
  id: number;
  title: string;
  option1: string | null;
  option2: string | null;
  option3: string | null;
  sku: string | null;
  requires_shipping: boolean;
  taxable: boolean;
  featured_image: any;
  available: boolean;
  price: string;
  grams: number;
  compare_at_price: string | null;
  position: number;
  product_id: number;
  created_at: string;
  updated_at: string;
}

export interface ScrapedImage {
  id: number;
  created_at: string;
  position: number;
  updated_at: string;
  product_id: number;
  variant_ids: number[];
  src: string;
  width: number;
  height: number;
  alt?: string;
}

export interface UploadProgress {
  total: number;
  completed: number;
  failed: number;
  current?: string;
  errors: Array<{
    productTitle: string;
    error: string;
  }>;
}

export type ProgressCallback = (progress: UploadProgress) => void;

// ==================== Upload Functions ====================

/**
 * Convert scraped product to Shopify format
 */
function convertToShopifyFormat(product: ScrapedProduct) {
  return {
    title: product.title,
    descriptionHtml: product.body_html,
    vendor: product.vendor,
    productType: product.product_type,
    tags: product.tags,
    variants: product.variants.map((variant) => ({
      price: variant.price,
      compareAtPrice: variant.compare_at_price || undefined,
      sku: variant.sku || undefined,
      requiresShipping: variant.requires_shipping,
      taxable: variant.taxable,
      weight: variant.grams,
      weightUnit: "GRAMS" as const,
    })),
  };
}

/**
 * Upload a single product to Shopify
 */
async function uploadSingleProduct(
  client: ShopifyAdminAPI,
  product: ScrapedProduct
): Promise<{ success: boolean; productId?: string; error?: string }> {
  try {
    console.log(`\n═══════════════════════════════════════════════`);
    console.log(`📦 Processing product: "${product.title}"`);
    console.log(`═══════════════════════════════════════════════`);

    // Step 1: Create the product with variants
    const productData = convertToShopifyFormat(product);
    console.log(`📋 Product data prepared:`);
    console.log(`   - Title: ${productData.title}`);
    console.log(`   - Vendor: ${productData.vendor}`);
    console.log(`   - Variants: ${productData.variants.length}`);
    productData.variants.forEach((v, i) => {
      console.log(
        `     ${i + 1}. Price: ${v.price}, SKU: ${v.sku || "none"}, Weight: ${
          v.weight
        }g`
      );
    });
    console.log(`   - Images: ${product.images.length}`);

    const createResponse = await createProductWithVariants(client, productData);

    if (createResponse.productCreate.userErrors.length > 0) {
      return {
        success: false,
        error: createResponse.productCreate.userErrors
          .map((e) => e.message)
          .join(", "),
      };
    }

    const createdProductId = createResponse.productCreate.product.id;

    // Step 2: Add images to the product
    if (product.images && product.images.length > 0) {
      try {
        // Add a small delay to ensure product is fully created
        await new Promise((resolve) => setTimeout(resolve, 500));

        const mediaInput = product.images.map((img) => ({
          originalSource: img.src,
          alt: img.alt || product.title || "",
        }));

        console.log(
          `Attempting to add ${mediaInput.length} images for "${product.title}"`
        );
        console.log(
          "Image URLs:",
          mediaInput.map((m) => m.originalSource)
        );

        const mediaResponse = await addProductMedia(
          client,
          createdProductId,
          mediaInput
        );

        // Check for media user errors
        if (mediaResponse.productCreateMedia.mediaUserErrors.length > 0) {
          console.error(
            `Media errors for product "${product.title}":`,
            JSON.stringify(
              mediaResponse.productCreateMedia.mediaUserErrors,
              null,
              2
            )
          );
        } else {
          console.log(
            `✅ Successfully added ${mediaResponse.productCreateMedia.media.length} images for "${product.title}"`
          );
        }
      } catch (imageError) {
        console.error(
          `❌ Failed to add images for product "${product.title}":`,
          imageError
        );
        // Continue even if images fail - product is still created
      }
    } else {
      console.log(`No images to add for product "${product.title}"`);
    }

    return {
      success: true,
      productId: createdProductId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Upload products in batches with progress tracking
 */
export async function uploadProducts(
  client: ShopifyAdminAPI,
  products: ScrapedProduct[],
  options: {
    batchSize?: number;
    delayBetweenBatches?: number;
    onProgress?: ProgressCallback;
  } = {}
): Promise<UploadProgress> {
  const {
    batchSize = 10,
    delayBetweenBatches = 1000, // 1 second delay between batches
    onProgress,
  } = options;

  const progress: UploadProgress = {
    total: products.length,
    completed: 0,
    failed: 0,
    errors: [],
  };

  // Process products in batches
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    // Process batch in parallel
    const results = await Promise.allSettled(
      batch.map((product) => uploadSingleProduct(client, product))
    );

    // Update progress
    results.forEach((result, index) => {
      const product = batch[index];

      if (result.status === "fulfilled" && result.value.success) {
        progress.completed++;
      } else {
        progress.failed++;
        const error =
          result.status === "fulfilled" ? result.value.error : result.reason;

        progress.errors.push({
          productTitle: product.title,
          error: String(error),
        });
      }
    });

    // Report progress
    if (onProgress) {
      progress.current = batch[batch.length - 1]?.title;
      onProgress({ ...progress });
    }

    // Delay between batches to avoid rate limits
    if (i + batchSize < products.length) {
      await new Promise((resolve) => setTimeout(resolve, delayBetweenBatches));
    }
  }

  return progress;
}

/**
 * Upload products from JSON file
 */
export async function uploadProductsFromJSON(
  client: ShopifyAdminAPI,
  jsonData: { products: ScrapedProduct[] },
  options?: {
    batchSize?: number;
    delayBetweenBatches?: number;
    onProgress?: ProgressCallback;
  }
): Promise<UploadProgress> {
  return uploadProducts(client, jsonData.products, options);
}

/**
 * Validate products before upload
 */
export function validateProducts(products: ScrapedProduct[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!Array.isArray(products) || products.length === 0) {
    errors.push("No products found in data");
    return { valid: false, errors };
  }

  products.forEach((product, index) => {
    if (!product.title) {
      errors.push(`Product at index ${index} is missing title`);
    }
    if (!product.variants || product.variants.length === 0) {
      errors.push(`Product "${product.title}" has no variants`);
    }
    if (product.variants) {
      product.variants.forEach((variant, vIndex) => {
        if (!variant.price) {
          errors.push(
            `Product "${product.title}" variant ${vIndex} is missing price`
          );
        }
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
