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
- AWS account (for S3 uploads)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:

   Create a `.env.local` file in the root directory with the following AWS S3 configuration:

   ```env
   # AWS S3 Configuration (Required for S3 uploads)
   AWS_ACCESS_KEY_ID=your_aws_access_key_id_here
   AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here
   AWS_REGION=us-east-1
   S3_BUCKET_NAME=shopify-ai-s3-bucket
   S3_BUCKET_REGION=us-east-2
   S3_DIRECTORY_NAME=data

   # Shopify Configuration (Required for product uploads)
   # Add your Shopify credentials here
   ```

   **Important:**
   - Make sure `AWS_REGION` or `S3_BUCKET_REGION` matches the actual region where your S3 bucket is located. If you get a "PermanentRedirect" error, update the region to match your bucket's region (e.g., `us-east-2`).
   - `S3_DIRECTORY_NAME` specifies the folder inside your bucket where files will be stored. Files will be saved as: `{S3_DIRECTORY_NAME}/{filename}-{timestamp}.jsonl`

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

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
