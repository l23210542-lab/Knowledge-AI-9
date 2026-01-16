# KnowledgeHub AI

An internal knowledge platform that centralizes corporate documentation and enables querying through an AI assistant based on RAG (Retrieval-Augmented Generation).

## 📋 Description

KnowledgeHub AI is an MVP solution designed to solve the problem of scattered documentation in organizations. It allows users to upload internal documents (PDF, TXT, Markdown) and query them using natural language, obtaining accurate answers based exclusively on the provided documentation.

### Key Features

- 📄 **Document Management**: Upload and organize documents by departments
- 🤖 **AI Chat**: Intelligent querying using RAG (Retrieval-Augmented Generation)
- 🔍 **Semantic Search**: Search for relevant information using vector embeddings
- 💾 **Session Persistence**: Conversation history during browser session
- 🔐 **Supabase Integration**: PostgreSQL database with pgvector for semantic search

## 🛠️ Technologies Used

### Frontend
- **React 18** - UI Library
- **TypeScript** - Static typing
- **Vite** - Build tool and dev server
- **React Router** - Routing
- **Tailwind CSS** - Styling framework
- **shadcn/ui** - UI Components
- **Radix UI** - Accessible primitive components
- **Lucide React** - Icons

### Backend & Services
- **Supabase** - Backend as a Service
  - PostgreSQL with pgvector extension
  - Supabase Storage for files
  - Row Level Security (RLS)
- **OpenAI API** - AI and embeddings
  - `text-embedding-3-small` for embeddings
  - `gpt-4o-mini` for response generation
- **PDF.js** - PDF file processing

### Development Tools
- **ESLint** - Linter
- **TypeScript** - Type compiler
- **PostCSS** - CSS processing

## 📦 Prerequisites

Before starting, make sure you have installed:

- **Node.js** >= 18.x ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- **npm** >= 9.x (included with Node.js)
- **Supabase Account** ([create account](https://supabase.com))
- **OpenAI API Key** ([get it here](https://platform.openai.com/api-keys))

## 🚀 Installation

### 1. Clone the repository

```bash
git clone <YOUR_GIT_URL>
cd blueprint-builder-main
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# OpenAI Configuration
VITE_OPENAI_API_KEY=sk-proj-your_openai_api_key

# API URL (optional, for development)
VITE_API_URL=http://localhost:3000
```

**Note**: The `.env` file is already included in `.gitignore` and will not be committed to the repository.

### 4. Configure Supabase

Follow the complete guide in [`docs/SUPABASE_SETUP.md`](./docs/SUPABASE_SETUP.md) to:

1. Create tables in Supabase
2. Configure Supabase Storage
3. Configure RLS policies
4. Enable pgvector extension

**Quick summary**:

```sql
-- Execute in Supabase SQL Editor
-- See docs/SUPABASE_SETUP.md for the complete script
```

### 5. Copy PDF.js worker

The PDF.js worker must be in the `public/` folder:

```bash
# Windows (PowerShell)
Copy-Item "node_modules\pdfjs-dist\build\pdf.worker.min.mjs" -Destination "public\pdf.worker.min.mjs" -Force

# Linux/Mac
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
```

## ▶️ Running

### Development Mode

```bash
npm run dev
```

The application will be available at `http://localhost:8080`

### Production Build

```bash
npm run build
```

Compiled files will be generated in the `dist/` folder

### Build Preview

```bash
npm run preview
```

### Linting

```bash
npm run lint
```

## 📁 Project Structure

```
blueprint-builder-main/
├── public/                 # Static files
│   ├── pdf.worker.min.mjs # PDF.js worker
│   └── ...
├── src/
│   ├── frontend/          # Frontend code
│   │   ├── components/    # React components
│   │   │   ├── dashboard/ # Dashboard components
│   │   │   ├── layout/    # Layout and navigation
│   │   │   └── ui/        # UI components (shadcn/ui)
│   │   ├── pages/         # Application pages
│   │   │   ├── Chat.tsx   # AI chat page
│   │   │   ├── Documents.tsx # Document listing
│   │   │   ├── Upload.tsx # Document upload
│   │   │   └── ...
│   │   ├── hooks/         # Custom hooks
│   │   ├── lib/           # Frontend utilities
│   │   ├── App.tsx        # Main component
│   │   └── main.tsx       # Entry point
│   │
│   └── backend/           # Backend code
│       ├── lib/
│       │   ├── api/       # API services
│       │   │   ├── chat.ts              # RAG and chat logic
│       │   │   ├── documents.ts         # Document management
│       │   │   ├── documentProcessing.ts # PDF/TXT/MD processing
│       │   │   ├── departments.ts       # Department management
│       │   │   └── users.ts             # User management
│       │   ├── supabase.ts              # Supabase client
│       │   └── checkSupabaseConfig.ts   # Config verification
│       └── database.sql   # Database schema
│
├── docs/                  # Documentation
│   ├── prd.md            # Product Requirement Document
│   ├── SUPABASE_SETUP.md # Supabase setup guide
│   ├── ENV_SETUP.md      # Environment variables setup
│   ├── OPENAI_SETUP.md   # OpenAI setup
│   ├── STRUCTURE.md      # Project structure
│   └── ...
│
├── .env                   # Environment variables (not versioned)
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Vite configuration
└── tailwind.config.ts    # Tailwind configuration
```

## 🎯 Usage

### Upload Documents

1. Navigate to the **"Upload"** page
2. Select one or more files (PDF, TXT, MD)
3. Assign a department to each document
4. Click **"Process"** to upload and process

**Supported formats**:
- PDF (`.pdf`)
- Plain text (`.txt`)
- Markdown (`.md`)

**Limits**:
- Maximum size: 10MB per file
- Documents are automatically processed during upload

### Query with AI

1. Navigate to the **"Chat"** page
2. Type your question in natural language
3. The system will search for relevant information in uploaded documents
4. You will receive an answer based on the document content

**Chat features**:
- Conversation history during the session
- Cited information sources
- Answers based exclusively on uploaded documents

### View Documents

1. Navigate to the **"Documents"** page
2. View all uploaded documents
3. Filter by department
4. See the processing status of each document

## 🔧 Advanced Configuration

### Environment Variables

See [`docs/ENV_SETUP.md`](./docs/ENV_SETUP.md) for details on:
- Environment variable configuration
- Troubleshooting common issues
- Credential validation

### Supabase

See [`docs/SUPABASE_SETUP.md`](./docs/SUPABASE_SETUP.md) for:
- Complete Supabase setup
- Table and RLS policy creation
- Storage configuration
- RLS troubleshooting

### OpenAI

See [`docs/OPENAI_SETUP.md`](./docs/OPENAI_SETUP.md) for:
- API key acquisition
- Project configuration
- Troubleshooting

## 📚 Additional Documentation

- [`docs/prd.md`](./docs/prd.md) - Complete Product Requirement Document
- [`docs/STRUCTURE.md`](./docs/STRUCTURE.md) - Detailed project structure
- [`docs/SUPABASE_SETUP.md`](./docs/SUPABASE_SETUP.md) - Supabase setup guide
- [`docs/ENV_SETUP.md`](./docs/ENV_SETUP.md) - Environment variables setup
- [`docs/OPENAI_SETUP.md`](./docs/OPENAI_SETUP.md) - OpenAI setup
- [`docs/STORAGE_RLS_FIX.md`](./docs/STORAGE_RLS_FIX.md) - Storage RLS troubleshooting

## 🐛 Troubleshooting

### Error: "Supabase credentials not found"

- Verify that the `.env` file exists in the project root
- Make sure variables start with `VITE_`
- Restart the development server after modifying `.env`

### Error: "StorageApiError: new row violates row-level security policy"

- See [`docs/STORAGE_RLS_FIX.md`](./docs/STORAGE_RLS_FIX.md)
- Configure RLS policies for the `documents` bucket in Supabase

### Error: "OpenAI is not configured"

- Verify that `VITE_OPENAI_API_KEY` is in your `.env` file
- Make sure the API key is valid and has available credits

### PDFs are not processed

- Verify that `public/pdf.worker.min.mjs` exists
- Check the browser console for specific errors
- Make sure you have an internet connection (the worker may require external resources)

### Conversation is cleared when changing pages

- This is normal: the conversation persists during the session but is cleared on reload
- History is saved in browser `sessionStorage`

## 🚢 Deployment

### Production Build

```bash
npm run build
```

### Environment Variables in Production

Make sure to configure the same environment variables on your deployment platform:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OPENAI_API_KEY`

### Recommended Platforms

- **Vercel** - Automatic deployment from Git
- **Netlify** - Similar to Vercel
- **Supabase Hosting** - Native Supabase integration

## 📝 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Starts the development server |
| `npm run build` | Creates a production build |
| `npm run build:dev` | Creates a development build |
| `npm run preview` | Preview of the production build |
| `npm run lint` | Runs the linter |

## 🤝 Contributing

This is an MVP project. To contribute:

1. Fork the repository
2. Create a branch for your feature (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is private and under active development.

## 👥 Author

Developed as part of an internal knowledge platform project.

---

**Note**: This is an MVP project. Some features may be under active development.
