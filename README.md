# Search App

A modern Next.js application with search functionality and chat feature.

## Features

- 🔍 **Advanced Search**: Search for products with real-time results
- 💬 **Chat Assistant**: Interactive chat feature for user assistance
- 📱 **Responsive Design**: Works perfectly on desktop and mobile
- 🎨 **Modern UI**: Clean and intuitive interface with Tailwind CSS
- ⚡ **Fast Performance**: Built with Next.js 14 and optimized for speed

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main page component
├── lib/
│   └── utils.ts             # Utility functions
├── components/              # Reusable components (to be added)
└── public/                  # Static assets
```

## Features Overview

### Search Functionality
- Real-time search with loading states
- Filtered results based on query
- Product cards with images, descriptions, and pricing
- Category-based filtering

### Chat Feature
- Interactive chat interface
- Message history
- Typing indicators
- Responsive sidebar design

### UI Components
- Modern card-based layout
- Responsive grid system
- Interactive buttons and inputs
- Loading states and animations

## Customization

### Adding Real API Integration

Replace the mock search function in `app/page.tsx` with your actual API calls:

```typescript
const performSearch = async (query: string) => {
  setIsSearching(true)
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
    const results = await response.json()
    setSearchResults(results)
  } catch (error) {
    console.error('Search failed:', error)
  } finally {
    setIsSearching(false)
  }
}
```

### Styling

The app uses Tailwind CSS with custom components. You can modify the styles in:
- `app/globals.css` for global styles
- `tailwind.config.js` for theme customization

## Deployment

Build the application for production:

```bash
npm run build
npm start
```

## Technologies Used

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **clsx & tailwind-merge** - Utility functions
