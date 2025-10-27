'use client';

import React, { useState } from 'react';
import { ScrapedProduct } from '@/lib/product-uploader';
import { downloadProductsJson, downloadProductsJsonl, isValidShopifyDomain } from '@/lib/shopify-scraper';

interface UploadProgress {
    total: number;
    completed: number;
    failed: number;
    current?: string;
    errors: Array<{
        productTitle: string;
        error: string;
    }>;
}

const ScrapProductsPage = () => {
    // Scraping state
    const [domain, setDomain] = useState('');
    const [scraping, setScraping] = useState(false);
    const [scrapedProducts, setScrapedProducts] = useState<ScrapedProduct[]>([]);
    const [storeDomain, setStoreDomain] = useState<string>('');

    // Scraping progress state
    const [scrapeProgress, setScrapeProgress] = useState<{
        currentPage: number;
        totalProducts: number;
        status: string;
    }>({ currentPage: 0, totalProducts: 0, status: '' });

    // Selection state
    const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
    const [selectAll, setSelectAll] = useState(false);

    // Upload state
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState<UploadProgress | null>(null);
    const [showErrors, setShowErrors] = useState(false);

    // UI state
    const [activeTab, setActiveTab] = useState<'scrape' | 'upload'>('scrape');

    // Scrape products from domain with real-time streaming
    const handleScrape = async (domainToScrape?: string) => {
        const targetDomain = domainToScrape || domain;

        if (!targetDomain.trim()) {
            alert('Please enter a domain');
            return;
        }

        if (!isValidShopifyDomain(targetDomain)) {
            alert('Please enter a valid domain (e.g., henne.us or store.myshopify.com)');
            return;
        }

        // Update domain state if passed
        if (domainToScrape) {
            setDomain(domainToScrape);
        }

        setScraping(true);
        setScrapedProducts([]);
        setSelectedProducts(new Set());
        setProgress(null);
        setScrapeProgress({ currentPage: 0, totalProducts: 0, status: 'Starting...' });

        try {
            const response = await fetch('/api/shopify/scrape-stream', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ domain: targetDomain }),
            });

            if (!response.body) {
                throw new Error('No response body');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            const allProducts: ScrapedProduct[] = [];
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Keep incomplete line in buffer

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            console.log('SSE Event:', data.type, data);

                            switch (data.type) {
                                case 'start':
                                    setScrapeProgress({
                                        currentPage: 0,
                                        totalProducts: 0,
                                        status: `Connected to ${data.domain}`,
                                    });
                                    setStoreDomain(data.domain);
                                    allProducts.length = 0; // Clear array
                                    break;

                                case 'fetching':
                                    setScrapeProgress({
                                        currentPage: data.page,
                                        totalProducts: data.total,
                                        status: `Fetching page ${data.page}...`,
                                    });
                                    break;

                                case 'progress':
                                    setScrapeProgress({
                                        currentPage: data.page,
                                        totalProducts: data.total,
                                        status: `Fetched ${data.fetched} products from page ${data.page}`,
                                    });
                                    break;

                                case 'waiting':
                                    setScrapeProgress({
                                        currentPage: data.page - 1,
                                        totalProducts: data.total,
                                        status: `Waiting ${data.delay / 1000}s before next page...`,
                                    });
                                    break;

                                case 'complete':
                                    setStoreDomain(data.storeDomain);
                                    setScrapeProgress({
                                        currentPage: data.count > 0 ? Math.ceil(data.count / 250) : 0,
                                        totalProducts: data.count,
                                        status: `Receiving products... (${data.count} total)`,
                                    });
                                    break;

                                case 'products':
                                    // Accumulate product chunks
                                    allProducts.push(...data.chunk);
                                    console.log(`Accumulated ${allProducts.length} products so far`);
                                    setScrapeProgress(prev => ({
                                        ...prev,
                                        status: `Loading products... ${allProducts.length} of ${prev.totalProducts}`,
                                    }));
                                    break;

                                case 'done':
                                    console.log(`Final product count: ${allProducts.length}`);
                                    setScrapedProducts([...allProducts]);
                                    setScrapeProgress(prev => ({
                                        ...prev,
                                        status: `Complete! ${allProducts.length} products scraped`,
                                    }));
                                    setActiveTab('upload');
                                    break;

                                case 'error':
                                    throw new Error(data.error);

                                case 'warning':
                                    console.warn(data.message);
                                    setScrapeProgress(prev => ({
                                        ...prev,
                                        status: data.message,
                                    }));
                                    break;
                            }
                        } catch (parseError) {
                            console.error('Error parsing SSE data:', parseError, 'Line:', line);
                            // Continue processing other lines
                        }
                    }
                }
            }

            // Process any remaining data in buffer
            if (buffer.trim() && buffer.startsWith('data: ')) {
                try {
                    const data = JSON.parse(buffer.slice(6));
                    if (data.type === 'done') {
                        console.log(`Final product count (from buffer): ${allProducts.length}`);
                        setScrapedProducts([...allProducts]);
                        setActiveTab('upload');
                    }
                } catch (e) {
                    console.error('Error parsing final buffer:', e);
                }
            }
        } catch (error) {
            console.error('Scraping error:', error);
            alert(`Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            setScrapeProgress({
                currentPage: 0,
                totalProducts: 0,
                status: 'Failed',
            });
        } finally {
            setScraping(false);
        }
    };

    // Toggle product selection
    const toggleProduct = (productId: number) => {
        const newSelection = new Set(selectedProducts);
        if (newSelection.has(productId)) {
            newSelection.delete(productId);
        } else {
            newSelection.add(productId);
        }
        setSelectedProducts(newSelection);
        setSelectAll(newSelection.size === scrapedProducts.length);
    };

    // Toggle select all
    const toggleSelectAll = () => {
        if (selectAll) {
            setSelectedProducts(new Set());
        } else {
            setSelectedProducts(new Set(scrapedProducts.map(p => p.id)));
        }
        setSelectAll(!selectAll);
    };

    // Download JSON
    const handleDownload = () => {
        const productsToDownload = selectedProducts.size > 0
            ? scrapedProducts.filter(p => selectedProducts.has(p.id))
            : scrapedProducts;

        downloadProductsJson(productsToDownload, storeDomain || 'products');
        alert(`Downloaded ${productsToDownload.length} products as JSON`);
    };

    // Download JSONL
    const handleDownloadJsonl = () => {
        const productsToDownload = selectedProducts.size > 0
            ? scrapedProducts.filter(p => selectedProducts.has(p.id))
            : scrapedProducts;

        downloadProductsJsonl(productsToDownload, storeDomain || 'products');
        alert(`Downloaded ${productsToDownload.length} products as JSONL`);
    };

    // Upload selected products
    const handleUpload = async () => {
        if (selectedProducts.size === 0) {
            alert('Please select at least one product to upload');
            return;
        }

        const productsToUpload = scrapedProducts.filter(p => selectedProducts.has(p.id));

        if (!confirm(`Upload ${productsToUpload.length} products to your Shopify store?`)) {
            return;
        }

        setUploading(true);
        setProgress(null);

        try {
            const response = await fetch('/api/shopify/upload-scraped', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    products: productsToUpload,
                    batchSize: 10,
                    delayBetweenBatches: 1000,
                }),
            });

            const data = await response.json();

            if (data.success) {
                setProgress(data.result);
                alert(`Upload complete! ${data.result.completed} successful, ${data.result.failed} failed`);
            } else {
                alert(`Upload failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert(`Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
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
                                <a href="/scrap-products" className="text-gray-900 font-medium transition-colors">
                                    Scrape Products
                                </a>
                                <a href="/my-products" className="text-gray-600 hover:text-gray-900 transition-colors">
                                    My Products
                                </a>
                            </nav>
                        </div>
                    </div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto p-8">
                <div className="bg-white rounded-2xl shadow-xl p-8">
                    {/* Header */}
                    <div className="border-b border-gray-200 pb-6 mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">
                            🛍️ Shopify Product Scraper & Uploader
                        </h1>
                        <p className="text-gray-600">
                            Scrape products from any Shopify store and upload them to your own store
                        </p>
                    </div>

                    {/* Tabs */}
                    <div className="flex space-x-4 mb-8 border-b border-gray-200">
                        <button
                            onClick={() => setActiveTab('scrape')}
                            className={`pb-4 px-6 font-semibold transition-colors ${activeTab === 'scrape'
                                ? 'border-b-2 border-blue-600 text-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            1. Scrape Products
                        </button>
                        <button
                            onClick={() => setActiveTab('upload')}
                            className={`pb-4 px-6 font-semibold transition-colors ${activeTab === 'upload'
                                ? 'border-b-2 border-blue-600 text-blue-600'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                            disabled={scrapedProducts.length === 0}
                        >
                            2. Select & Upload
                            {scrapedProducts.length > 0 && (
                                <span className="ml-2 bg-blue-100 text-blue-600 px-2 py-1 rounded-full text-xs">
                                    {scrapedProducts.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'scrape' && (
                        <div>
                            {/* Quick Select Popular Stores */}
                            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6 mb-6">
                                <h2 className="text-xl font-semibold text-purple-900 mb-4">
                                    ⚡ Quick Select - Popular Stores
                                </h2>
                                <p className="text-sm text-gray-600 mb-4">
                                    Click any store below to instantly scrape their products
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {[
                                        { domain: 'honestpaws.com', count: '~38' },
                                        { domain: 'henne.us', count: '~390' },
                                        { domain: 'nutritionfaktory.com', count: 'TBD' },
                                        { domain: 'shopjoe.com', count: 'TBD' },
                                        { domain: 'slickproductsusa.com', count: 'TBD' },
                                        { domain: 'ridejetson.com', count: 'TBD' },
                                        { domain: 'arhaus.com', count: 'TBD' },
                                        { domain: 'hobbiesville.com', count: '~25K' },
                                    ].map((store) => (
                                        <button
                                            key={store.domain}
                                            onClick={() => {
                                                // Clear all previous state
                                                setScrapedProducts([]);
                                                setSelectedProducts(new Set());
                                                setSelectAll(false);
                                                setProgress(null);
                                                setScrapeProgress({ currentPage: 0, totalProducts: 0, status: '' });
                                                setActiveTab('scrape');

                                                // Start scraping with the store domain directly
                                                handleScrape(store.domain);
                                            }}
                                            disabled={scraping}
                                            className={`p-4 rounded-lg border-2 transition-all transform ${scraping
                                                ? 'bg-gray-100 border-gray-300 cursor-not-allowed'
                                                : domain === store.domain && scrapedProducts.length > 0
                                                    ? 'bg-blue-100 border-blue-500 shadow-md'
                                                    : 'bg-white border-purple-300 hover:border-purple-500 hover:shadow-lg hover:scale-105'
                                                }`}
                                        >
                                            <div className="text-left">
                                                <div className="font-semibold text-gray-900 text-sm truncate">
                                                    {store.domain}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {store.count} products
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Scraping Form */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
                                <h2 className="text-xl font-semibold text-blue-900 mb-4">
                                    🔍 Or Enter Custom Domain
                                </h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Store Domain
                                        </label>
                                        <input
                                            type="text"
                                            value={domain}
                                            onChange={(e) => setDomain(e.target.value)}
                                            placeholder="e.g., allbirds.com or store.myshopify.com"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            disabled={scraping}
                                            onKeyPress={(e) => e.key === 'Enter' && handleScrape()}
                                        />
                                        <p className="mt-2 text-sm text-gray-600">
                                            Enter the domain without http:// or https://
                                        </p>
                                    </div>

                                    <button
                                        onClick={() => handleScrape()}
                                        disabled={scraping}
                                        className={`w-full py-4 px-6 rounded-lg font-semibold text-white text-lg transition-all transform ${scraping
                                            ? 'bg-gray-400 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg hover:scale-105'
                                            }`}
                                    >
                                        {scraping ? (
                                            <span className="flex items-center justify-center">
                                                <svg
                                                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
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
                                                Scraping Products...
                                            </span>
                                        ) : (
                                            '🔍 Scrape Products'
                                        )}
                                    </button>
                                </div>

                                {/* Real-time Progress Display */}
                                {scraping && scrapeProgress.status && (
                                    <div className="mt-6 bg-white border border-blue-300 rounded-lg p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                Scraping Progress
                                            </h3>
                                            <div className="flex items-center space-x-2">
                                                <div className="animate-pulse h-3 w-3 bg-blue-600 rounded-full"></div>
                                                <span className="text-sm text-gray-600">Live</span>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Status */}
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-gray-700">Status:</span>
                                                <span className="text-sm text-blue-600 font-semibold">{scrapeProgress.status}</span>
                                            </div>

                                            {/* Current Page */}
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-gray-700">Current Page:</span>
                                                <span className="text-sm text-gray-900 font-bold">{scrapeProgress.currentPage}</span>
                                            </div>

                                            {/* Total Products */}
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm font-medium text-gray-700">Products Fetched:</span>
                                                <span className="text-xl text-green-600 font-bold">{scrapeProgress.totalProducts}</span>
                                            </div>

                                            {/* Progress Bar */}
                                            {scrapeProgress.currentPage > 0 && (
                                                <div className="mt-4">
                                                    <div className="flex justify-between text-xs text-gray-600 mb-2">
                                                        <span>Page {scrapeProgress.currentPage}</span>
                                                        <span>{scrapeProgress.totalProducts} products</span>
                                                    </div>
                                                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                                        <div
                                                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full transition-all duration-300 animate-pulse"
                                                            style={{ width: '100%' }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Instructions */}
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-yellow-900 mb-3">
                                    ℹ️ How It Works
                                </h3>
                                <ol className="list-decimal list-inside space-y-2 text-yellow-800">
                                    <li>Click a quick-select store button OR enter any custom Shopify store domain</li>
                                    <li>Watch real-time progress as products are fetched (page-by-page with delays to avoid rate limits)</li>
                                    <li>Review and select the products you want to upload</li>
                                    <li>Download as JSON/JSONL (optional) or upload directly to your store</li>
                                    <li>Monitor the upload progress and review any errors</li>
                                </ol>

                                <div className="mt-4 p-4 bg-yellow-100 rounded">
                                    <p className="text-sm text-yellow-900 font-medium">
                                        ✨ Features:
                                    </p>
                                    <ul className="mt-2 space-y-1 text-sm text-yellow-800">
                                        <li>• <strong>Real-time progress:</strong> See each page being fetched live</li>
                                        <li>• <strong>Smart pagination:</strong> Automatically handles all pages (up to 25K+ products)</li>
                                        <li>• <strong>Rate limiting:</strong> Built-in delays prevent blocking</li>
                                        <li>• <strong>Error handling:</strong> Automatic retries with exponential backoff</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'upload' && scrapedProducts.length > 0 && (
                        <div>
                            {/* Summary and Actions */}
                            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6 mb-6">
                                <div className="flex justify-between items-center mb-4">
                                    <div>
                                        <h2 className="text-2xl font-semibold text-gray-900">
                                            Scraped from: {storeDomain}
                                        </h2>
                                        <p className="text-gray-600 mt-1">
                                            {scrapedProducts.length} products found • {selectedProducts.size} selected
                                        </p>
                                    </div>

                                    <div className="flex space-x-3">
                                        <button
                                            onClick={handleDownload}
                                            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700 transition-colors"
                                        >
                                            📥 Download JSON
                                        </button>

                                        <button
                                            onClick={handleDownloadJsonl}
                                            className="px-4 py-2 bg-white border border-purple-300 rounded-lg hover:bg-purple-50 font-medium text-purple-700 transition-colors"
                                        >
                                            📄 Download JSONL
                                        </button>

                                        <button
                                            onClick={handleUpload}
                                            disabled={uploading || selectedProducts.size === 0}
                                            className={`px-6 py-2 rounded-lg font-semibold text-white transition-all ${uploading || selectedProducts.size === 0
                                                ? 'bg-gray-400 cursor-not-allowed'
                                                : 'bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 hover:shadow-lg'
                                                }`}
                                        >
                                            {uploading ? '⏳ Uploading...' : `🚀 Upload ${selectedProducts.size} Products`}
                                        </button>
                                    </div>
                                </div>

                                {/* Select All */}
                                <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
                                    <input
                                        title="Select all products"
                                        type="checkbox"
                                        checked={selectAll}
                                        onChange={toggleSelectAll}
                                        className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                    />
                                    <label className="font-medium text-gray-700">
                                        Select All Products
                                    </label>
                                </div>
                            </div>

                            {/* Products List */}
                            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
                                <div className="max-h-96 overflow-y-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50 sticky top-0">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                                                    Select
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                                                    Image
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Title
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Vendor
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Type
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Variants
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Price
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                                                    Link
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {scrapedProducts.map((product) => (
                                                <tr
                                                    key={product.id}
                                                    className={`hover:bg-gray-50 transition-colors ${selectedProducts.has(product.id) ? 'bg-blue-50' : ''
                                                        }`}
                                                >
                                                    <td className="px-4 py-4">
                                                        <input
                                                            title="Select product"
                                                            type="checkbox"
                                                            checked={selectedProducts.has(product.id)}
                                                            onChange={() => toggleProduct(product.id)}
                                                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {product.images[0] ? (
                                                            <img
                                                                src={product.images[0].src}
                                                                alt={product.title}
                                                                className="w-12 h-12 object-cover rounded"
                                                            />
                                                        ) : (
                                                            <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
                                                                No img
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="text-sm font-medium text-gray-900 max-w-md truncate">
                                                            {product.title}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="text-sm text-gray-600">{product.vendor}</div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="text-sm text-gray-600">{product.product_type}</div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="text-sm text-gray-600">{product.variants.length}</div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="text-sm font-medium text-gray-900">
                                                            ${product.variants[0]?.price}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        {product.url ? (
                                                            <a
                                                                href={product.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1"
                                                                title={product.url}
                                                            >
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
                                                                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                                                    />
                                                                </svg>
                                                                <span>View</span>
                                                            </a>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">N/A</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Upload Progress */}
                            {progress && (
                                <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
                                    <h2 className="text-2xl font-semibold text-gray-900 mb-6">
                                        Upload Complete! ✅
                                    </h2>

                                    {/* Progress Stats */}
                                    <div className="grid grid-cols-3 gap-4 mb-6">
                                        <div className="bg-white rounded-lg p-4 shadow">
                                            <p className="text-sm text-gray-600 mb-1">Total</p>
                                            <p className="text-3xl font-bold text-gray-900">{progress.total}</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-4 shadow">
                                            <p className="text-sm text-gray-600 mb-1">Successful</p>
                                            <p className="text-3xl font-bold text-green-600">{progress.completed}</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-4 shadow">
                                            <p className="text-sm text-gray-600 mb-1">Failed</p>
                                            <p className="text-3xl font-bold text-red-600">{progress.failed}</p>
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="mb-6">
                                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                                            <span>Progress</span>
                                            <span>
                                                {Math.round(((progress.completed + progress.failed) / progress.total) * 100)}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                            <div
                                                className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${((progress.completed + progress.failed) / progress.total) * 100}%`,
                                                }}
                                            ></div>
                                        </div>
                                    </div>

                                    {/* Errors */}
                                    {progress.errors.length > 0 && (
                                        <div className="bg-white rounded-lg p-4 border border-red-200">
                                            <button
                                                onClick={() => setShowErrors(!showErrors)}
                                                className="flex items-center justify-between w-full text-left"
                                            >
                                                <h3 className="text-lg font-semibold text-red-900">
                                                    Errors ({progress.errors.length})
                                                </h3>
                                                <span className="text-red-600">
                                                    {showErrors ? '▼' : '▶'}
                                                </span>
                                            </button>

                                            {showErrors && (
                                                <div className="mt-4 max-h-96 overflow-y-auto">
                                                    {progress.errors.map((error, idx) => (
                                                        <div
                                                            key={idx}
                                                            className="bg-red-50 rounded p-3 mb-3 last:mb-0"
                                                        >
                                                            <p className="font-medium text-red-900 mb-1">
                                                                {error.productTitle}
                                                            </p>
                                                            <p className="text-sm text-red-700">{error.error}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Configuration Warning */}
                            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                                <h3 className="text-lg font-semibold text-yellow-900 mb-3">
                                    ⚠️ Before Uploading
                                </h3>
                                <ul className="list-disc list-inside space-y-2 text-yellow-800">
                                    <li>Ensure your <code className="bg-yellow-100 px-2 py-1 rounded">.env.local</code> is configured with Shopify credentials</li>
                                    <li>Products will be uploaded in batches of 10 with 1-second delays</li>
                                    <li>All products will be created as ACTIVE in your store</li>
                                    <li>Images will be automatically linked from the source store</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScrapProductsPage;
