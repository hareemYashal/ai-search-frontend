'use client'

import { useState, useEffect } from 'react'
import { Search, MessageCircle, Send, Loader2, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
  product_id: string
  title: string
  price: number
  url: string
  image: string
  in_stock: boolean
  category: string
  tags: string[]
  score: number
  boosted_score: number
  reason: string
}

interface SearchResponse {
  items: SearchResult[]
  suggested_filters: string[]
  search_time_ms: number
  total_results: number
}

interface ChatMessage {
  id: string
  text: string
  isUser: boolean
  timestamp: Date
  items_cited?: string[]
  product_links?: ProductLink[]
}

interface ProductLink {
  product_id: string
  url: string
}

interface ChatResponse {
  answer: string
  items_cited: string[]
  search_time_ms: number
  reasoning: string
  product_links?: ProductLink[]
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchMetadata, setSearchMetadata] = useState<{
    total_results: number
    search_time_ms: number
    suggested_filters: string[]
  } | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      text: 'Hello! How can I help you today?',
      isUser: false,
      timestamp: new Date()
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  // Real API search function
  const performSearch = async (query: string) => {
    setIsSearching(true)
    
    try {
      const response = await fetch('http://0.0.0.0:8000/search-fast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`)
      }
      
      const data: SearchResponse = await response.json()
      setSearchResults(data.items)
      setSearchMetadata({
        total_results: data.total_results,
        search_time_ms: data.search_time_ms,
        suggested_filters: data.suggested_filters
      })
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
      setSearchMetadata(null)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      performSearch(searchQuery.trim())
    }
  }

  const clearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
    setSearchMetadata(null)
  }

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: chatInput,
      isUser: true,
      timestamp: new Date()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsTyping(true)

    try {
      const response = await fetch('http://0.0.0.0:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: chatInput }),
      })
      
      if (!response.ok) {
        throw new Error(`Chat failed: ${response.status}`)
      }
      
      const data: ChatResponse = await response.json()
      
      // Clean up the response text
      let cleanAnswer = data.answer
      if (cleanAnswer.startsWith('Assistant:')) {
        cleanAnswer = cleanAnswer.substring(10).trim()
      }
      
      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: cleanAnswer,
        isUser: false,
        timestamp: new Date(),
        items_cited: data.items_cited,
        product_links: data.product_links
      }
      
      setChatMessages(prev => [...prev, botMessage])
    } catch (error) {
      console.error('Chat error:', error)
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I'm having trouble connecting right now. Please try again.",
        isUser: false,
        timestamp: new Date()
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">AI Search</h1>
            </div>
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="relative p-2 text-gray-600 hover:text-primary-600 transition-colors"
            >
              <MessageCircle className="h-6 w-6" />
              {chatMessages.length > 1 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {chatMessages.length - 1}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Fixed Search Bar */}
      <div className="fixed top-16 left-0 right-0 bg-white border-b shadow-sm z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for products, categories, or anything..."
                className="input-field pl-10"
                onSubmit={handleSearch}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              disabled={!searchQuery.trim()}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              <Search className="h-4 w-4" />
              Search
            </button>
            {(searchResults.length > 0 || searchMetadata) && (
              <button
                type="button"
                onClick={clearSearch}
                className="btn-secondary flex items-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="pt-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

          {/* Loading State */}
          {isSearching && (
            <div className="card">
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="mb-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Searching products...</h3>
                  <p className="text-gray-600">Finding the best matches for your query</p>
                </div>
              </div>
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && !isSearching && (
            <div className="card">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Search Results ({searchResults.length})
                </h3>
                {searchMetadata && (
                  <div className="text-sm text-gray-500">
                    {searchMetadata.total_results} total • {searchMetadata.search_time_ms.toFixed(0)}ms
                  </div>
                )}
              </div>
              
              {/* Suggested Filters */}
              {searchMetadata?.suggested_filters && searchMetadata.suggested_filters.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">Suggested filters:</p>
                  <div className="flex flex-wrap gap-2">
                    {searchMetadata.suggested_filters.map((filter, index) => (
                      <span key={index} className="bg-primary-100 text-primary-800 text-xs px-2 py-1 rounded-full">
                        {filter}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {searchResults.map((result) => (
                  <div key={result.product_id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                      {result.image ? (
                        <img src={result.image} alt={result.title} className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <div className="text-gray-400 text-sm">No Image</div>
                      )}
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1">{result.title}</h4>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-lg font-semibold text-primary-600">${result.price}</div>
                      <div className={`text-xs px-2 py-1 rounded-full ${
                        result.in_stock 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {result.in_stock ? 'In Stock' : 'Out of Stock'}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                        {result.category}
                      </span>
                      {result.tags.slice(0, 2).map((tag, index) => (
                        <span key={index} className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="text-xs text-gray-500">
                      Score: {(result.boosted_score * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {searchResults.length === 0 && !isSearching && searchQuery && (
            <div className="card text-center py-12">
              <div className="text-gray-400 mb-4">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No results found</h3>
              <p className="text-gray-600">Try adjusting your search terms or browse our categories.</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Modal */}
      {chatOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setChatOpen(false)}
          />
          
          {/* Modal Container */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl h-[80vh] flex flex-col transform transition-all">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 rounded-t-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">AI Chat Assistant</h3>
                    <p className="text-sm text-gray-500">Ask me anything about our products</p>
                  </div>
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {chatMessages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.isUser ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[70%] rounded-2xl px-4 py-3 shadow-sm",
                        message.isUser
                          ? "bg-primary-600 text-white"
                          : "bg-gray-100 text-gray-900"
                      )}
                    >
                      <div className="text-sm whitespace-pre-line leading-relaxed">{message.text}</div>
                      {message.items_cited && message.items_cited.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs text-gray-600 mb-2">Referenced products:</div>
                          <div className="flex flex-wrap gap-1">
                            {message.items_cited.map((itemId, index) => (
                              <span key={index} className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                                #{itemId}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {message.product_links && message.product_links.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <div className="text-xs text-gray-600 mb-2">Product links:</div>
                          <div className="flex flex-wrap gap-2">
                            {message.product_links.map((link, index) => (
                              <a
                                key={index}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-primary-100 text-primary-700 text-xs px-3 py-2 rounded-lg hover:bg-primary-200 transition-colors inline-flex items-center gap-1"
                              >
                                <span>View Product #{link.product_id}</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      <p className="text-xs opacity-70 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-6 border-t border-gray-200 rounded-b-xl bg-gray-50">
                <form onSubmit={handleChatSubmit} className="flex gap-3">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all duration-200 bg-white"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="btn-primary px-6 py-3 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Send
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
