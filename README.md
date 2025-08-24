# Video Exporter - Multi-Platform Video Management Tool

A comprehensive web application that allows you to export video titles, thumbnails, and metadata from multiple video hosting platforms to Excel files. Features AI-powered title generation using OpenAI's advanced vision models.

## 🌟 Features

### Supported Video Platforms
- **Vimeo** - Export from albums and folders
- **Bunny.net Storage** - Static file management and export
- **Bunny.net Stream** - Streaming videos with collections support
- **Wistia** - Project-based video organization

### Core Capabilities
- 📊 **Excel Export** - Export video data to formatted Excel files
- 🤖 **AI Title Generation** - Generate descriptive titles from video thumbnails using OpenAI GPT-4o
- 🔍 **Smart Filtering** - Filter videos by date, search terms, and metadata
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices
- 🔒 **Secure** - API tokens stored temporarily in memory only, never saved to database

### AI Features
- **Dual AI Access Methods:**
  - System password protection using server's OpenAI credits
  - Personal OpenAI API key for users with their own credits
- **Bulk Processing** - Analyze multiple video thumbnails simultaneously
- **Caching** - AI-generated titles are cached to avoid redundant processing
- **Smart Analysis** - Extracts text from thumbnails and generates meaningful titles

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- OpenAI API key (optional, for AI features)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd video-exporter
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
Create a `.env` file in the root directory:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/video_exporter
OPENAI_API_KEY=your_openai_api_key_here
```

4. **Set up the database**
```bash
npm run db:push
```

5. **Start the development server**
```bash
npm run dev
```

The application will be available at `http://localhost:5000`

## 📖 How to Use

### 1. Select Your Video Platform
Choose from the supported platforms in the dropdown menu.

### 2. Configure API Access
Each platform requires different credentials:

#### Vimeo
- Create an API token at [Vimeo Developer Console](https://developer.vimeo.com/apps)
- Required scopes: `public`, `private`

#### Bunny.net Storage
- Get your Storage API key from Bunny.net Dashboard
- Provide your Storage Zone name

#### Bunny.net Stream
- Get your Stream API key from Bunny.net Dashboard  
- Provide your Video Library ID

#### Wistia
- Create an API token at Wistia Account Settings → API Access
- Required permissions: Read access to projects and media

### 3. Load Your Content
Choose one of two options:

**Option A: Browse Collections/Projects/Folders**
1. Click "Load Projects/Collections/Folders"
2. Select the specific collection you want to export
3. Click "Fetch Videos" to load videos from that collection

**Option B: Load All Videos**
1. Click "Load All Videos" to fetch all videos from your account
2. Use filters to narrow down the results

### 4. AI Title Enhancement (Optional)
Unlock AI features using either:
- **System Password:** Use `MG2025` to access AI features using server credits
- **Personal API Key:** Enter your own OpenAI API key to use your credits

AI features include:
- Individual video title generation from thumbnails
- Bulk processing for multiple videos
- Smart text extraction and content analysis

### 5. Filter and Search
- **Date Filter:** Filter videos by creation date (last week, month, year, or all)
- **Search:** Search through titles, descriptions, and other metadata
- **Real-time Updates:** Filters apply instantly as you type

### 6. Export to Excel
Click "Export to Excel" to download a formatted spreadsheet containing:
- Video titles (original and AI-generated)
- Video URLs and embed codes
- Thumbnails and metadata
- Creation dates and statistics
- Platform-specific data

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Shadcn/ui** component library
- **Wouter** for client-side routing
- **TanStack Query** for server state management
- **React Hook Form** with Zod validation

### Backend
- **Express.js** with TypeScript
- **Drizzle ORM** for database operations
- **PostgreSQL** for data persistence
- **OpenAI API** for AI features
- **Session management** with PostgreSQL store

### Development
- **Vite** for build tooling and development server
- **Hot Module Replacement** for fast development
- **TypeScript** for type safety
- **ESLint** for code quality

## 🔧 API Reference

### Video Platforms Integration

#### Vimeo API
- **Base URL:** `https://api.vimeo.com`
- **Authentication:** Bearer token
- **Endpoints Used:**
  - `/me/albums` - Get user albums
  - `/albums/{album_id}/videos` - Get videos in album
  - `/me/videos` - Get all user videos

#### Bunny.net Storage API
- **Base URL:** `https://storage.bunnycdn.com`
- **Authentication:** AccessKey header
- **Endpoints Used:**
  - `/{zone}/` - List files in storage zone

#### Bunny.net Stream API
- **Base URL:** `https://video.bunnycdn.com`
- **Authentication:** AccessKey header
- **Endpoints Used:**
  - `/library/{library_id}/videos` - Get videos
  - `/library/{library_id}/collections` - Get collections

#### Wistia API
- **Base URL:** `https://api.wistia.com/v1`
- **Authentication:** Bearer token
- **Endpoints Used:**
  - `/projects.json` - Get projects
  - `/medias.json` - Get media files

## 🔒 Security & Privacy

- **API Token Security:** All API tokens are stored temporarily in browser memory only
- **No Persistent Storage:** Tokens are automatically cleared when you close or refresh the app
- **Database Safety:** Only video metadata and AI-generated titles are stored in the database
- **Session-based:** All credentials are session-only and never persisted
- **Compliance:** Respects all platform terms of service and API usage guidelines

## 🎨 Customization

The application supports easy customization:

- **Themes:** Built-in light/dark mode support
- **Providers:** Extensible architecture for adding new video platforms
- **UI Components:** Modular design system using Shadcn/ui
- **Export Formats:** Easy to extend for additional export formats

## 🤝 Contributing

This project is open source and welcomes contributions! Areas where you can help:

- **New Platform Support:** Add support for additional video hosting platforms
- **Export Formats:** Add support for CSV, JSON, or other export formats
- **AI Features:** Enhance AI analysis capabilities
- **UI/UX Improvements:** Improve user interface and experience
- **Performance:** Optimize for larger video libraries
- **Testing:** Add comprehensive test coverage

## 📝 License

This project is free to use and modify. See the LICENSE file for details.

## 👨‍💻 Creator

Created by **Davide Volpato** with ❤️

## 🐛 Issues & Support

If you encounter any issues or need support:

1. Check the console for error messages
2. Verify your API credentials are correct
3. Ensure your API tokens have the required permissions
4. Check that the video platform's API is accessible

## 🚀 Deployment

### Replit Deployment
This application is optimized for deployment on Replit:
- Automatic dependency management
- Built-in PostgreSQL database
- Environment variable management
- One-click deployment

### Manual Deployment
For other platforms:
1. Set up a PostgreSQL database
2. Configure environment variables
3. Run `npm run build` to build the production version
4. Deploy using your preferred hosting service

## 📊 Performance

- **Batch Processing:** Handles large video libraries efficiently
- **Caching:** AI results are cached to avoid redundant API calls
- **Rate Limiting:** Respects API rate limits of all platforms
- **Optimized Queries:** Database queries are optimized for performance
- **Lazy Loading:** Videos and thumbnails are loaded on demand

---

**Happy exporting! 🎬✨**