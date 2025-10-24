"use client";

import { useState, useEffect } from "react";

interface ShopifyProduct {
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
}

interface PageInfo {
    hasNextPage: boolean;
    endCursor: string;
}

export default function MyProductsPage() {
    const [products, setProducts] = useState<ShopifyProduct[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [pageInfo, setPageInfo] = useState<PageInfo>({
        hasNextPage: false,
        endCursor: "",
    });
    const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
        new Set()
    );
    const [deleting, setDeleting] = useState(false);
    const [deleteSuccess, setDeleteSuccess] = useState<string>("");

    const fetchProducts = async (after?: string, query?: string) => {
        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams();
            params.append("first", "50");
            if (after) params.append("after", after);
            if (query) params.append("query", query);

            const response = await fetch(`/api/shopify/products?${params.toString()}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Failed to fetch products");
            }

            if (after) {
                // Append to existing products for pagination
                setProducts((prev) => [...prev, ...data.products]);
            } else {
                // Replace products for new search
                setProducts(data.products);
            }

            setPageInfo(data.pageInfo);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch products");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchProducts(undefined, searchQuery);
    };

    const handleLoadMore = () => {
        if (pageInfo.hasNextPage) {
            fetchProducts(pageInfo.endCursor, searchQuery);
        }
    };

    const handleSelectProduct = (productId: string) => {
        const newSelected = new Set(selectedProducts);
        if (newSelected.has(productId)) {
            newSelected.delete(productId);
        } else {
            newSelected.add(productId);
        }
        setSelectedProducts(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedProducts.size === products.length) {
            setSelectedProducts(new Set());
        } else {
            setSelectedProducts(new Set(products.map((p) => p.id)));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedProducts.size === 0) {
            return;
        }

        if (
            !confirm(
                `Are you sure you want to delete ${selectedProducts.size} product(s)? This action cannot be undone.`
            )
        ) {
            return;
        }

        setDeleting(true);
        setError("");
        setDeleteSuccess("");

        try {
            const response = await fetch("/api/shopify/delete-products", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    productIds: Array.from(selectedProducts),
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "Failed to delete products");
            }

            // Show success message
            setDeleteSuccess(
                `Successfully deleted ${data.result.successful} product(s)` +
                (data.result.failed > 0
                    ? `. Failed: ${data.result.failed}`
                    : "")
            );

            // Remove deleted products from the list
            setProducts((prev) =>
                prev.filter((p) => !selectedProducts.has(p.id))
            );
            setSelectedProducts(new Set());

            // Auto-hide success message after 5 seconds
            setTimeout(() => setDeleteSuccess(""), 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete products");
        } finally {
            setDeleting(false);
        }
    };

    const formatPrice = (price: string) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(parseFloat(price));
    };

    const stripHtml = (html: string) => {
        const tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-8">
                            <h1 className="text-2xl font-bold text-gray-900">AI Search</h1>
                            <nav className="hidden md:flex gap-6">
                                <a href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                                    Search
                                </a>
                                <a href="/scrap-products" className="text-gray-600 hover:text-gray-900 transition-colors">
                                    Scrape Products
                                </a>
                                <a href="/my-products" className="text-gray-900 font-medium transition-colors">
                                    My Products
                                </a>
                            </nav>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">My Products</h1>
                    <p className="text-gray-600">
                        View and manage products in your Shopify store
                    </p>
                </div>

                {/* Search Bar and Actions */}
                <form onSubmit={handleSearch} className="mb-6">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search products by title, vendor, or tag..."
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        >
                            Search
                        </button>
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery("");
                                    fetchProducts();
                                }}
                                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </form>

                {/* Bulk Actions Bar */}
                {products.length > 0 && (
                    <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={
                                        products.length > 0 &&
                                        selectedProducts.size === products.length
                                    }
                                    onChange={handleSelectAll}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                    title="Select all products"
                                />
                                <span className="text-sm font-medium text-gray-700">
                                    Select All
                                </span>
                            </label>
                            <span className="text-sm text-gray-600">
                                {selectedProducts.size} of {products.length} selected
                            </span>
                        </div>
                        <button
                            onClick={handleDeleteSelected}
                            disabled={selectedProducts.size === 0 || deleting}
                            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            title="Delete selected products"
                        >
                            {deleting ? (
                                <>
                                    <svg
                                        className="animate-spin h-4 w-4"
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        ></circle>
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        ></path>
                                    </svg>
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                    </svg>
                                    Delete Selected ({selectedProducts.size})
                                </>
                            )}
                        </button>
                    </div>
                )}

                {/* Success Message */}
                {deleteSuccess && (
                    <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-green-800">{deleteSuccess}</p>
                    </div>
                )}

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-800">{error}</p>
                    </div>
                )}

                {/* Loading State */}
                {loading && products.length === 0 && (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                )}

                {/* Products Grid */}
                {!loading && products.length === 0 && !error && (
                    <div className="text-center py-12">
                        <p className="text-gray-500 text-lg">No products found</p>
                        <p className="text-gray-400 mt-2">
                            {searchQuery
                                ? "Try adjusting your search query"
                                : "Upload some products to get started"}
                        </p>
                    </div>
                )}

                {products.length > 0 && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                            {products.map((product) => (
                                <div
                                    key={product.id}
                                    className={`bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all relative ${selectedProducts.has(product.id)
                                        ? "ring-2 ring-blue-500"
                                        : ""
                                        }`}
                                >
                                    {/* Selection Checkbox */}
                                    <div className="absolute top-2 left-2 z-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedProducts.has(product.id)}
                                            onChange={() => handleSelectProduct(product.id)}
                                            className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                            title={`Select ${product.title}`}
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    </div>
                                    {/* Product Image */}
                                    <div className="aspect-square bg-gray-100 relative">
                                        {product.images.length > 0 ? (
                                            <img
                                                src={product.images[0].url}
                                                alt={product.images[0].altText || product.title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <svg
                                                    className="w-20 h-20 text-gray-300"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                    />
                                                </svg>
                                            </div>
                                        )}
                                        {/* Status Badge */}
                                        <div className="absolute top-2 right-2">
                                            <span
                                                className={`px-2 py-1 text-xs font-semibold rounded ${product.status === "ACTIVE"
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-gray-100 text-gray-800"
                                                    }`}
                                            >
                                                {product.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Product Info */}
                                    <div className="p-4">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                                            {product.title}
                                        </h3>

                                        {product.vendor && (
                                            <p className="text-sm text-gray-500 mb-2">
                                                by {product.vendor}
                                            </p>
                                        )}

                                        {product.descriptionHtml && (
                                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                                {stripHtml(product.descriptionHtml)}
                                            </p>
                                        )}

                                        {/* Price */}
                                        {product.variants.length > 0 && (
                                            <div className="mb-3">
                                                <span className="text-xl font-bold text-gray-900">
                                                    {formatPrice(product.variants[0].price)}
                                                </span>
                                                {product.variants[0].compareAtPrice && (
                                                    <span className="ml-2 text-sm text-gray-500 line-through">
                                                        {formatPrice(product.variants[0].compareAtPrice)}
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Variants Info */}
                                        <div className="text-sm text-gray-500 mb-2">
                                            {product.variants.length} variant(s)
                                        </div>

                                        {/* Tags */}
                                        {product.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-3">
                                                {product.tags.slice(0, 3).map((tag, idx) => (
                                                    <span
                                                        key={idx}
                                                        className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded"
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                                {product.tags.length > 3 && (
                                                    <span className="px-2 py-1 text-xs bg-gray-50 text-gray-600 rounded">
                                                        +{product.tags.length - 3} more
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        {/* Product Type */}
                                        {product.productType && (
                                            <p className="text-xs text-gray-400">
                                                Type: {product.productType}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Load More Button */}
                        {pageInfo.hasNextPage && (
                            <div className="flex justify-center">
                                <button
                                    onClick={handleLoadMore}
                                    disabled={loading}
                                    className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                >
                                    {loading ? "Loading..." : "Load More Products"}
                                </button>
                            </div>
                        )}

                        {/* Products Count */}
                        <div className="text-center mt-6 text-gray-500">
                            Showing {products.length} product(s)
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

