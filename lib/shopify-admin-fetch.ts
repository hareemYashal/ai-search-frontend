/**
 * Shopify Admin API Client
 * Handles authentication and GraphQL API calls
 */

export interface ShopifyAdminConfig {
  storeDomain: string;
  accessToken: string;
  apiVersion: string;
}

export class ShopifyAdminAPI {
  private config: ShopifyAdminConfig;
  private endpoint: string;

  constructor(config: ShopifyAdminConfig) {
    this.config = config;
    this.endpoint = `https://${config.storeDomain}/admin/api/${config.apiVersion}/graphql.json`;
  }

  /**
   * Make a GraphQL request to Shopify Admin API
   */
  async request<T = any>(
    query: string,
    variables?: Record<string, any>
  ): Promise<T> {
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": this.config.accessToken,
        },
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Shopify API Error (${response.status}): ${errorText}`);
      }

      const json = await response.json();

      // Check for GraphQL errors
      if (json.errors) {
        throw new Error(`GraphQL Error: ${JSON.stringify(json.errors)}`);
      }

      // Check for user errors in mutations
      if (json.data) {
        const dataKeys = Object.keys(json.data);
        for (const key of dataKeys) {
          if (
            json.data[key]?.userErrors &&
            json.data[key].userErrors.length > 0
          ) {
            throw new Error(
              `User Error: ${JSON.stringify(json.data[key].userErrors)}`
            );
          }
        }
      }

      return json.data as T;
    } catch (error) {
      console.error("Shopify Admin API Request Failed:", error);
      throw error;
    }
  }

  /**
   * Perform a mutation operation
   */
  async mutate<T = any>(
    mutation: string,
    variables?: Record<string, any>
  ): Promise<T> {
    return this.request<T>(mutation, variables);
  }

  /**
   * Perform a query operation
   */
  async query<T = any>(
    query: string,
    variables?: Record<string, any>
  ): Promise<T> {
    return this.request<T>(query, variables);
  }
}

/**
 * Create a Shopify Admin API client instance
 */
export function createShopifyAdminClient(): ShopifyAdminAPI {
  const config: ShopifyAdminConfig = {
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN || "",
    accessToken: process.env.SHOPIFY_ADMIN_API_ACCESS_TOKEN || "",
    apiVersion: process.env.SHOPIFY_API_VERSION || "2024-10",
  };

  // Validate configuration
  if (!config.storeDomain) {
    throw new Error("SHOPIFY_STORE_DOMAIN is not set in environment variables");
  }
  if (!config.accessToken) {
    throw new Error(
      "SHOPIFY_ADMIN_API_ACCESS_TOKEN is not set in environment variables"
    );
  }

  return new ShopifyAdminAPI(config);
}
