/**
 * Shopify Admin API Mutations
 * Contains GraphQL mutations for creating/updating products, collections, etc.
 */

import { ShopifyAdminAPI } from "./shopify-admin-fetch";

// ==================== Types ====================

export interface ProductInput {
  title: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
  variants?: VariantInput[];
  images?: ImageInput[];
}

export interface VariantInput {
  price?: string;
  compareAtPrice?: string;
  sku?: string;
  barcode?: string;
  inventoryQuantities?: {
    availableQuantity: number;
    locationId: string;
  }[];
  weight?: number;
  weightUnit?: "KILOGRAMS" | "GRAMS" | "POUNDS" | "OUNCES";
  requiresShipping?: boolean;
  taxable?: boolean;
  inventoryPolicy?: "DENY" | "CONTINUE";
  inventoryManagement?: "SHOPIFY" | "NOT_MANAGED";
  options?: string[];
}

export interface ImageInput {
  src: string;
  altText?: string;
}

export interface ProductCreateResponse {
  productCreate: {
    product: {
      id: string;
      title: string;
      handle: string;
    };
    userErrors: Array<{
      field: string[];
      message: string;
    }>;
  };
}

export interface MediaCreateResponse {
  productCreateMedia: {
    media: Array<{
      id: string;
      mediaContentType: string;
    }>;
    mediaUserErrors: Array<{
      field: string[];
      message: string;
    }>;
  };
}

// ==================== Mutations ====================

/**
 * Create a new product in Shopify
 */
export async function createProduct(
  client: ShopifyAdminAPI,
  input: ProductInput
): Promise<ProductCreateResponse> {
  const mutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          title
          handle
          descriptionHtml
          vendor
          productType
          tags
          status
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  return client.mutate<ProductCreateResponse>(mutation, { input });
}

/**
 * Create product with variants
 */
export async function createProductWithVariants(
  client: ShopifyAdminAPI,
  productData: {
    title: string;
    descriptionHtml: string;
    vendor: string;
    productType: string;
    tags: string[];
    variants: Array<{
      price: string;
      sku?: string;
      compareAtPrice?: string;
      requiresShipping?: boolean;
      taxable?: boolean;
      weight?: number;
      weightUnit?: "GRAMS" | "KILOGRAMS" | "POUNDS" | "OUNCES";
    }>;
  }
): Promise<ProductCreateResponse> {
  // Step 1: Create the product WITHOUT variants
  // Shopify will auto-create a default variant
  const productInput = {
    title: productData.title,
    descriptionHtml: productData.descriptionHtml,
    vendor: productData.vendor,
    productType: productData.productType,
    tags: productData.tags,
    status: "ACTIVE" as const,
  };

  const productResponse = await createProduct(client, productInput);

  if (productResponse.productCreate.userErrors.length > 0) {
    return productResponse;
  }

  const productId = productResponse.productCreate.product.id;

  // Step 2: Get the default variant ID and update it with the first variant's data
  if (productData.variants && productData.variants.length > 0) {
    try {
      console.log(`\n🔧 Setting up variants for product: ${productData.title}`);
      console.log(
        `📊 Total variants to create: ${productData.variants.length}`
      );

      // Get the auto-created variant ID
      const defaultVariantId = await getDefaultVariantId(client, productId);
      console.log(`🎯 Default variant ID: ${defaultVariantId}`);

      if (defaultVariantId) {
        // Update the default variant with first variant's data
        const firstVariant = productData.variants[0];
        console.log(
          `💰 First variant price: ${firstVariant.price}, SKU: ${
            firstVariant.sku || "none"
          }`
        );

        // Update price using bulk update
        await updateProductVariantById(
          client,
          productId,
          defaultVariantId,
          firstVariant
        );

        // Update SKU separately (if provided)
        if (firstVariant.sku) {
          await updateVariantInventoryItem(
            client,
            defaultVariantId,
            firstVariant.sku
          );
        }
      }

      // Create additional variants if there are more than one
      if (productData.variants.length > 1) {
        console.log(
          `➕ Creating ${productData.variants.length - 1} additional variant(s)`
        );
        for (let i = 1; i < productData.variants.length; i++) {
          console.log(
            `   → Variant ${i + 1}: price ${productData.variants[i].price}`
          );
          await createProductVariant(
            client,
            productId,
            productData.variants[i]
          );
        }
      }

      console.log(`✅ All variants processed for: ${productData.title}\n`);
    } catch (error) {
      console.error("❌ Failed to create/update variants:", error);
    }
  }

  return productResponse;
}

/**
 * Add media (images) to a product
 */
export async function addProductMedia(
  client: ShopifyAdminAPI,
  productId: string,
  media: Array<{ originalSource: string; alt?: string }>
): Promise<MediaCreateResponse> {
  const mutation = `
    mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media {
          id
          mediaContentType
          alt
          ... on MediaImage {
            image {
              url
            }
          }
        }
        mediaUserErrors {
          field
          message
        }
      }
    }
  `;

  // Transform media to include required mediaContentType
  const formattedMedia = media.map((item) => ({
    originalSource: item.originalSource,
    alt: item.alt,
    mediaContentType: "IMAGE" as const,
  }));

  return client.mutate<MediaCreateResponse>(mutation, {
    productId,
    media: formattedMedia,
  });
}

/**
 * Update product inventory
 */
export async function updateInventory(
  client: ShopifyAdminAPI,
  inventoryItemId: string,
  locationId: string,
  availableQuantity: number
): Promise<any> {
  const mutation = `
    mutation inventoryAdjustQuantity($input: InventoryAdjustQuantityInput!) {
      inventoryAdjustQuantity(input: $input) {
        inventoryLevel {
          id
          available
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  return client.mutate(mutation, {
    input: {
      inventoryLevelId: `gid://shopify/InventoryLevel/${inventoryItemId}?inventory_item_id=${inventoryItemId}`,
      availableDelta: availableQuantity,
    },
  });
}

/**
 * Fetch products from Shopify store
 */
export async function fetchProducts(
  client: ShopifyAdminAPI,
  options: {
    first?: number;
    after?: string;
    query?: string;
  } = {}
): Promise<{
  products: Array<{
    id: string;
    title: string;
    handle: string;
    descriptionHtml: string;
    vendor: string;
    productType: string;
    tags: string[];
    status: string;
    createdAt: string;
    updatedAt: string;
    images: Array<{
      id: string;
      url: string;
      altText: string;
    }>;
    variants: Array<{
      id: string;
      title: string;
      price: string;
      sku: string;
      compareAtPrice: string;
      inventoryQuantity: number;
    }>;
  }>;
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string;
  };
}> {
  const { first = 50, after, query } = options;

  const queryStr = `
    query getProducts($first: Int!, $after: String, $query: String) {
      products(first: $first, after: $after, query: $query) {
        edges {
          node {
            id
            title
            handle
            descriptionHtml
            vendor
            productType
            tags
            status
            createdAt
            updatedAt
            featuredImage {
              id
              url
              altText
            }
            images(first: 10) {
              edges {
                node {
                  id
                  url
                  altText
                }
              }
            }
            media(first: 10) {
              edges {
                node {
                  mediaContentType
                  alt
                  ... on MediaImage {
                    id
                    image {
                      url
                      altText
                    }
                  }
                }
              }
            }
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  price
                  sku
                  compareAtPrice
                  inventoryQuantity
                  image {
                    id
                    url
                    altText
                  }
                }
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const response = await client.query(queryStr, { first, after, query });

  return {
    products: response.products.edges.map((edge: any) => {
      // Try to get images from media first, then fall back to images
      let productImages: Array<{ id: string; url: string; altText: string }> =
        [];

      // First, try media (this is where uploaded images are stored)
      if (edge.node.media?.edges && edge.node.media.edges.length > 0) {
        productImages = edge.node.media.edges
          .filter(
            (mediaEdge: any) => mediaEdge.node.mediaContentType === "IMAGE"
          )
          .map((mediaEdge: any) => ({
            id: mediaEdge.node.id,
            url: mediaEdge.node.image?.url || "",
            altText: mediaEdge.node.image?.altText || mediaEdge.node.alt || "",
          }))
          .filter((img: any) => img.url); // Remove any without URLs
      }

      // If no media images, fall back to images field
      if (productImages.length === 0 && edge.node.images?.edges) {
        productImages = edge.node.images.edges.map((imgEdge: any) => ({
          id: imgEdge.node.id,
          url: imgEdge.node.url,
          altText: imgEdge.node.altText || "",
        }));
      }

      // If still no images, try featured image
      if (productImages.length === 0 && edge.node.featuredImage) {
        productImages = [
          {
            id: edge.node.featuredImage.id,
            url: edge.node.featuredImage.url,
            altText: edge.node.featuredImage.altText || "",
          },
        ];
      }

      return {
        id: edge.node.id,
        title: edge.node.title,
        handle: edge.node.handle,
        descriptionHtml: edge.node.descriptionHtml,
        vendor: edge.node.vendor,
        productType: edge.node.productType,
        tags: edge.node.tags,
        status: edge.node.status,
        createdAt: edge.node.createdAt,
        updatedAt: edge.node.updatedAt,
        images: productImages,
        variants: edge.node.variants.edges.map((variantEdge: any) => ({
          id: variantEdge.node.id,
          title: variantEdge.node.title,
          price: variantEdge.node.price || "0.00",
          sku: variantEdge.node.sku || "",
          compareAtPrice: variantEdge.node.compareAtPrice || "",
          inventoryQuantity: variantEdge.node.inventoryQuantity || 0,
        })),
      };
    }),
    pageInfo: response.products.pageInfo,
  };
}

/**
 * Delete a product by ID
 */
export async function deleteProduct(
  client: ShopifyAdminAPI,
  productId: string
): Promise<{ success: boolean; error?: string }> {
  const mutation = `
    mutation productDelete($input: ProductDeleteInput!) {
      productDelete(input: $input) {
        deletedProductId
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const response = await client.mutate(mutation, {
      input: { id: productId },
    });

    if (response.productDelete.userErrors.length > 0) {
      return {
        success: false,
        error: response.productDelete.userErrors
          .map((e: any) => e.message)
          .join(", "),
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to delete product",
    };
  }
}

/**
 * Delete multiple products
 */
export async function deleteProducts(
  client: ShopifyAdminAPI,
  productIds: string[]
): Promise<{
  successful: number;
  failed: number;
  errors: Array<{ productId: string; error: string }>;
}> {
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as Array<{ productId: string; error: string }>,
  };

  for (const productId of productIds) {
    const result = await deleteProduct(client, productId);
    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
      results.errors.push({
        productId,
        error: result.error || "Unknown error",
      });
    }
  }

  return results;
}

/**
 * Get inventory location ID (needed for inventory updates)
 */
export async function getLocationId(client: ShopifyAdminAPI): Promise<string> {
  const query = `
    query {
      locations(first: 1) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `;

  const response = await client.query<{
    locations: {
      edges: Array<{
        node: {
          id: string;
          name: string;
        };
      }>;
    };
  }>(query);

  if (response.locations.edges.length === 0) {
    throw new Error("No locations found in Shopify store");
  }

  return response.locations.edges[0].node.id;
}

/**
 * Create a collection
 */
export async function createCollection(
  client: ShopifyAdminAPI,
  title: string,
  descriptionHtml?: string
): Promise<any> {
  const mutation = `
    mutation collectionCreate($input: CollectionInput!) {
      collectionCreate(input: $input) {
        collection {
          id
          title
          handle
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  return client.mutate(mutation, {
    input: {
      title,
      descriptionHtml,
    },
  });
}

/**
 * Get the default variant ID for a product
 */
export async function getDefaultVariantId(
  client: ShopifyAdminAPI,
  productId: string
): Promise<string | null> {
  const query = `
    query getProduct($id: ID!) {
      product(id: $id) {
        variants(first: 1) {
          edges {
            node {
              id
            }
          }
        }
      }
    }
  `;

  try {
    const response = await client.query(query, { id: productId });
    const variants = response.product?.variants?.edges;
    return variants && variants.length > 0 ? variants[0].node.id : null;
  } catch (error) {
    console.error("Failed to get default variant ID:", error);
    return null;
  }
}

/**
 * Update a product variant by ID using bulk update
 */
export async function updateProductVariantById(
  client: ShopifyAdminAPI,
  productId: string,
  variantId: string,
  variant: {
    price: string;
    sku?: string;
    compareAtPrice?: string;
    requiresShipping?: boolean;
    taxable?: boolean;
    weight?: number;
    weightUnit?: "GRAMS" | "KILOGRAMS" | "POUNDS" | "OUNCES";
  }
): Promise<any> {
  console.log(`📝 Updating variant ${variantId} with price: ${variant.price}`);

  const mutation = `
    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          title
          sku
          price
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // ProductVariantsBulkInput only accepts: id, price, compareAtPrice
  // Other fields like SKU, weight, etc. are not supported
  const variants = [
    {
      id: variantId,
      price: variant.price,
      compareAtPrice: variant.compareAtPrice || undefined,
    },
  ];

  console.log(
    `📤 Sending variant update (price only):`,
    JSON.stringify(variants[0], null, 2)
  );
  console.log(
    `⚠️  Note: SKU (${variant.sku}), weight (${variant.weight}g), and other fields cannot be updated via bulk mutation`
  );

  const response = await client.mutate(mutation, { productId, variants });

  if (response.productVariantsBulkUpdate?.userErrors?.length > 0) {
    console.error(
      `❌ Variant update errors:`,
      response.productVariantsBulkUpdate.userErrors
    );
  } else {
    console.log(
      `✅ Variant updated successfully: ${response.productVariantsBulkUpdate?.productVariants?.[0]?.price}`
    );
  }

  return response;
}

/**
 * Update a product variant (legacy - kept for compatibility)
 */
export async function updateProductVariant(
  client: ShopifyAdminAPI,
  productId: string,
  variantId: string,
  variant: {
    price: string;
    sku?: string;
    compareAtPrice?: string;
    requiresShipping?: boolean;
    taxable?: boolean;
    weight?: number;
    weightUnit?: "GRAMS" | "KILOGRAMS" | "POUNDS" | "OUNCES";
  }
): Promise<any> {
  const mutation = `
    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          title
          sku
          price
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variants = [
    {
      id: variantId,
      price: variant.price,
      sku: variant.sku,
      compareAtPrice: variant.compareAtPrice,
      requiresShipping: variant.requiresShipping ?? true,
      taxable: variant.taxable ?? true,
      weight: variant.weight,
      weightUnit: variant.weightUnit || "GRAMS",
      inventoryManagement: "SHOPIFY",
      inventoryPolicy: "DENY",
    },
  ];

  return client.mutate(mutation, { productId, variants });
}

/**
 * Update variant inventory item (for SKU)
 * Note: This requires fetching the inventoryItem ID first from the variant
 */
export async function updateVariantInventoryItem(
  client: ShopifyAdminAPI,
  variantId: string,
  sku?: string
): Promise<any> {
  if (!sku) return; // Skip if no SKU

  console.log(
    `📝 Attempting to update SKU for variant ${variantId} to: ${sku}`
  );

  try {
    // First, get the inventory item ID from the variant
    const variantQuery = `
      query getVariant($id: ID!) {
        productVariant(id: $id) {
          id
          inventoryItem {
            id
          }
        }
      }
    `;

    const variantResponse = await client.query(variantQuery, { id: variantId });
    const inventoryItemId = variantResponse.productVariant?.inventoryItem?.id;

    if (!inventoryItemId) {
      console.warn(`⚠️  No inventory item found for variant ${variantId}`);
      return;
    }

    console.log(`🔍 Found inventory item ID: ${inventoryItemId}`);

    // Now update the inventory item
    const mutation = `
      mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
        inventoryItemUpdate(id: $id, input: $input) {
          inventoryItem {
            id
            sku
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const response = await client.mutate(mutation, {
      id: inventoryItemId,
      input: { sku },
    });

    if (response.inventoryItemUpdate?.userErrors?.length > 0) {
      console.error(
        `❌ SKU update errors:`,
        response.inventoryItemUpdate.userErrors
      );
    } else {
      console.log(`✅ SKU updated successfully: ${sku}`);
    }

    return response;
  } catch (error) {
    console.error(`❌ Failed to update SKU:`, error);
    // Don't throw - SKU update is not critical
  }
}

/**
 * Create a product variant
 * Note: productVariantsBulkCreate only supports: price, compareAtPrice
 * Other fields like SKU need to be updated separately
 */
export async function createProductVariant(
  client: ShopifyAdminAPI,
  productId: string,
  variant: {
    price: string;
    sku?: string;
    compareAtPrice?: string;
    requiresShipping?: boolean;
    taxable?: boolean;
    weight?: number;
    weightUnit?: "GRAMS" | "KILOGRAMS" | "POUNDS" | "OUNCES";
  }
): Promise<any> {
  console.log(
    `➕ Creating variant with price: ${variant.price}, SKU: ${
      variant.sku || "none"
    }`
  );

  const mutation = `
    mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants) {
        productVariants {
          id
          title
          sku
          price
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // ProductVariantsBulkInput only accepts: price, compareAtPrice
  const variants = [
    {
      price: variant.price,
      compareAtPrice: variant.compareAtPrice || undefined,
    },
  ];

  console.log(
    `📤 Creating variant (price only):`,
    JSON.stringify(variants[0], null, 2)
  );

  const response = await client.mutate(mutation, { productId, variants });

  if (response.productVariantsBulkCreate?.userErrors?.length > 0) {
    console.error(
      `❌ Variant creation errors:`,
      response.productVariantsBulkCreate.userErrors
    );
    return response;
  }

  // If variant was created successfully and has SKU, update it
  const createdVariant =
    response.productVariantsBulkCreate?.productVariants?.[0];
  if (createdVariant?.id && variant.sku) {
    console.log(`🔄 Updating SKU for newly created variant...`);
    await updateVariantInventoryItem(client, createdVariant.id, variant.sku);
  }

  console.log(`✅ Variant created successfully: ${variant.price}`);

  return response;
}

/**
 * Add products to a collection
 */
export async function addProductsToCollection(
  client: ShopifyAdminAPI,
  collectionId: string,
  productIds: string[]
): Promise<any> {
  const mutation = `
    mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
      collectionAddProducts(id: $id, productIds: $productIds) {
        collection {
          id
          title
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  return client.mutate(mutation, {
    id: collectionId,
    productIds,
  });
}
