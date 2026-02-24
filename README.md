# ChatQA 🚀

A production-ready, full-stack chat application with AI-powered document processing and retrieval-augmented generation (RAG). Built as a monorepo with NestJS backend, React frontend, and Azure cloud services integration.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Development](#development)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [Roadmap](#roadmap)

## 🎯 Overview

ChatQA is a comprehensive chat application designed to serve as a starting point for building AI-powered conversational interfaces. It combines document processing, vector search, and streaming chat capabilities to deliver a complete RAG (Retrieval-Augmented Generation) solution.

### Key Capabilities

- **Document Library**: Upload and process documents (PDF, DOCX) with automatic text extraction and indexing
- **Intelligent Chat**: Chat with AI using grounded knowledge from your document library
- **Real-time Streaming**: WebSocket-based streaming responses for instant feedback
- **Advanced Search**: Hybrid search (semantic + vector) powered by Azure AI Search
- **Custom Markdown Components**: Rich rendering with citations, galleries, diagrams, and more
- **Comprehensive Logging**: Detailed event logs for debugging and monitoring
- **User Management**: Role-based access control with Microsoft authentication

## ✨ Features

### Core Features

- ✅ **Document Upload & Processing**
  - Support for PDF and DOCX files
  - Automatic text extraction using Azure Document Intelligence
  - Figure/image extraction from documents
  - Queue-based asynchronous processing
  - Status tracking (pending → processing → completed/failed)

- ✅ **AI-Powered Chat**
  - Streaming responses via WebSocket
  - Context-aware conversations using document library
  - Message history and persistence
  - Feedback collection (sentiment analysis)
  - Tool calling for document retrieval

- ✅ **Vector Search & RAG**
  - Hybrid search (keyword + semantic)
  - Automatic embedding generation
  - Document chunking and indexing
  - Relevance-based context retrieval

- ✅ **Rich Markdown Rendering**
  - Citations with document references
  - Image galleries with lightbox
  - Mermaid diagram rendering
  - Document lists with summaries
  - Custom table styling
  - Error message display

- ✅ **Real-time Updates**
  - WebSocket connections for live updates
  - Document processing status notifications
  - Chat message streaming
  - Connection state management

- ✅ **Event Logging**
  - Comprehensive event logging system
  - Filterable logs by level, group, and date
  - Automatic log purging (30-day TTL)
  - Stack trace capture for errors

- ✅ **Authentication & Authorization**
  - Microsoft Identity Platform (MSAL) integration
  - JWT-based authentication
  - Role-based access control (USER, ADMINISTRATOR)
  - Secure API endpoints

- ✅ **Progressive Web App (PWA)**
  - Offline support with service workers
  - Automatic update notifications
  - Installable on mobile and desktop
  - Cached assets for faster loading

## 🏗️ Architecture

### System Architecture

```
┌─────────────────┐
│   React SPA      │  ← User Interface (Vite + React + TypeScript)
│   (Static Web)   │
└────────┬────────┘
         │ HTTPS
         │ WebSocket
         ▼
┌─────────────────┐
│   NestJS API    │  ← REST API + WebSocket Gateway
│   (App Service) │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬──────────────┬─────────────┐
    │         │          │              │             │
    ▼         ▼          ▼              ▼             ▼
┌────────┐ ┌──────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ MongoDB│ │Azure │ │  Azure   │ │  Azure   │ │  Azure   │
│        │ │Storage│ │   AI     │ │  Search  │ │ Document │
│        │ │       │ │  OpenAI  │ │          │ │Intelligence│
└────────┘ └──────┘ └──────────┘ └──────────┘ └──────────┘
```

### Data Flow

1. **Document Upload Flow**:
   - User uploads document → API creates record → File stored in Azure Blob Storage
   - Queue service picks up document → Document Intelligence extracts text
   - Text is chunked and embedded → Chunks indexed in Azure AI Search
   - Status updated to "completed"

2. **Chat Flow**:
   - User sends message → WebSocket event emitted
   - System retrieves relevant context from document library (hybrid search)
   - OpenAI generates streaming response with citations
   - Messages saved to MongoDB
   - Real-time updates sent via WebSocket

## 🛠️ Tech Stack

### Backend (API)

- **Framework**: NestJS 11.0.1
- **Language**: TypeScript 5.7.3
- **Database**: MongoDB with Mongoose
- **Real-time**: Socket.IO
- **Validation**: Zod
- **Authentication**: JWT + Microsoft Identity Platform
- **Scheduling**: @nestjs/schedule (CRON jobs)
- **Rate Limiting**: @nestjs/throttler
- **Containerization**: Docker

### Frontend (SPA)

- **Framework**: React 19.2.0
- **Build Tool**: Vite 7.2.2
- **Language**: TypeScript 5.9.3
- **Styling**: SCSS Modules
- **Routing**: React Router 7.9.5
- **State Management**: React Context + Hooks
- **Markdown**: react-markdown with custom components
- **Diagrams**: Mermaid.js
- **Authentication**: MSAL Browser
- **PWA**: vite-plugin-pwa

### Cloud Services (Azure)

- **AI Services**:
  - Azure OpenAI (GPT models, embeddings)
  - Azure Document Intelligence
  - Azure AI Search (vector + semantic search)

- **Storage & Compute**:
  - Azure Blob Storage
  - Azure App Service (API)
  - Azure Static Web Apps (SPA)
  - Azure Container Registry (for Docker images)

- **Communication**:
  - Azure Communication Services (Email)

### Infrastructure

- **IaC**: Azure Bicep + scripted setup via `infra/setup.js`
- **CI/CD**: GitHub Actions workflows (configured for API and SPA)
  - API: Docker-based deployment to Azure App Service
  - SPA: Static Web Apps deployment

## 📁 Project Structure

```
chatqa/
├── api/                    # NestJS REST API + WebSocket Gateway
│   ├── src/
│   │   ├── modules/        # Feature modules
│   │   │   ├── chats/      # Chat functionality
│   │   │   ├── documents/   # Document management
│   │   │   ├── event-logs/ # Logging system
│   │   │   ├── health/     # Health checks
│   │   │   ├── socket/     # WebSocket gateway
│   │   │   ├── users/      # User management & auth
│   │   │   └── shared/     # Shared services
│   │   ├── pipes/          # Validation pipes
│   │   ├── types/          # Shared types
│   │   ├── utils/          # Utility functions
│   │   ├── app.module.ts   # Root module
│   │   └── main.ts         # Application entry
│   ├── tests/              # Test files
│   └── package.json
│
├── spa/                    # React Single Page Application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── markdown/   # Custom markdown components
│   │   │   ├── layout/     # Layout components
│   │   │   └── ...
│   │   ├── pages/          # Page components
│   │   │   ├── chat/       # Chat interface
│   │   │   ├── documents/  # Document library
│   │   │   └── logs/       # Event logs viewer
│   │   ├── services/       # API clients & services
│   │   ├── hooks/          # Custom React hooks
│   │   ├── context/        # React context providers
│   │   ├── types/          # TypeScript types
│   │   └── router/         # Route configuration
│   └── package.json
│
├── infra/                  # Infrastructure as Code
│   ├── main.bicep          # Bicep templates
│   └── resources/           # Bicep resource modules
│
├── .github/
│   └── workflows/           # GitHub Actions workflows
│       ├── api-docker.yml   # API deployment workflow
│       └── static-web-app.yml  # SPA deployment workflow
│
└── README.md               # This file
```

## 📋 Prerequisites

### Required Software

- **Node.js**: v18 or higher (v20 recommended)
- **npm**: v9 or higher (or compatible package manager)
- **MongoDB**: v6 or higher (local or cloud instance)
- **Azure CLI**: Latest version (for deployment)
- **Docker**: Latest version (for API containerization)
- **GitHub CLI** (`gh`): Required for scripted infrastructure + CI/CD setup (`infra/setup.js`)

### Required Azure Services

This project uses the following Azure services. They are provisioned automatically when you run `node infra/setup.js` (recommended). If you are provisioning manually, ensure you have:

1. **AI Search** - Vector and semantic search
2. **OpenAI** (Azure OpenAI or OpenAI.com) - LLM and embeddings
3. **MongoDB** - Database (Azure Cosmos DB for MongoDB API or standalone)
4. **Storage Account** - Blob storage for documents
5. **Document Intelligence** - Document text extraction
6. **Email Communication Service** (optional) - For email notifications
7. **App Registration** - For MSAL authentication
8. **App Service Plan & Web App** - For REST API hosting
9. **Static Web App** - For React frontend hosting
10. **Container Registry** - For Docker image storage (optional, for CI/CD)

> **Note**: Infrastructure + CI/CD is fully automated via `node infra/setup.js` (deploys `infra/main.bicep` and configures GitHub Actions). See `infra/README.md`.

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd chatqa
```

### 2. Install Dependencies

Install dependencies for all projects:

```bash
# Install API dependencies
cd api
npm install
cd ..

# Install SPA dependencies
cd spa
npm install
cd ..
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env  # If you have an example file
# Or create .env manually
```

See [Environment Variables](#environment-variables) section for required variables.

### 4. Start Development Servers

**Terminal 1 - API Server:**
```bash
cd api
npm run start:dev
```
API will be available at `http://localhost:3000`

**Terminal 2 - SPA Server:**
```bash
cd spa
npm run dev
```
SPA will be available at `http://localhost:5173`

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3000
- **API Health Check**: http://localhost:3000/healthz

## 🔐 Environment Variables

All environment variables are stored in a `.env` file at the project root. This file is shared across all projects in the monorepo.

### Required Variables

```env
# ============================================
# Authentication
# ============================================
JWT_SIGNING_SECRET=your-jwt-secret-key-here
MSAL_AUDIENCE=your-azure-ad-app-client-id

# ============================================
# Database
# ============================================
MONGODB_URI=mongodb://localhost:27017/chatqa
# Or for Azure Cosmos DB:
# MONGODB_URI=mongodb://account.mongo.cosmos.azure.com:10255/db?ssl=true&replicaSet=globaldb

# ============================================
# Azure Storage
# ============================================
STORAGE_ACCOUNT_NAME=yourstorageaccount
STORAGE_ACCOUNT_KEY=your-storage-account-key

# ============================================
# Azure OpenAI
# ============================================
# For Azure OpenAI (leave OPENAI_ENDPOINT blank to use OpenAI.com)
OPENAI_ENDPOINT=https://your-resource.openai.azure.com
OPENAI_KEY=your-openai-api-key

# ============================================
# Azure Document Intelligence
# ============================================
DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com
DOCUMENT_INTELLIGENCE_KEY=your-document-intelligence-key

# ============================================
# Azure AI Search
# ============================================
SEARCH_ENDPOINT=https://your-resource.search.windows.net
SEARCH_KEY=your-search-api-key
SEARCH_INDEX_NAME=nodes_index  # Default: nodes_index

# ============================================
# Azure Email Communication Service (Optional)
# ============================================
EMAIL_CONNECTION_STRING=endpoint=https://your-resource.communication.azure.com/;accesskey=your-key
EMAIL_DEFAULT_SENDER=DoNotReply@yourdomain.com

# ============================================
# Frontend (SPA) Variables
# ============================================
VITE_API_URL=http://localhost:3002
VITE_MSAL_CLIENT_ID=your-azure-ad-app-client-id
VITE_MSAL_TENANT_ID=your-azure-ad-tenant-id
```

### Optional Variables

```env
# API Port (default: 3002)
PORT=3002

# Node Environment
NODE_ENV=development
```

### Infrastructure setup variables (for `node infra/setup.js`)

If you're using the scripted Azure deployment + CI/CD setup, `infra/setup.js` reads these from the repo-root `/.env`:

```env
# Deploy app (GitHub Actions → Azure via OIDC)
DEPLOY_APP_CLIENT_ID=...
DEPLOY_APP_TENANT_ID=...
AZURE_SUBSCRIPTION_ID=...  # or legacy: DEPLOY_APP_SUBSCRIPTION_ID

# SPA build variables (used for workflow variables + MSAL redirect URI update)
VITE_MSAL_CLIENT_ID=...
VITE_MSAL_TENANT_ID=...

# Container registry credentials (used by API workflow + Web App env vars)
DOCKER_REGISTRY_SERVER_URL=...
DOCKER_REGISTRY_SERVER_USERNAME=...
DOCKER_REGISTRY_SERVER_PASSWORD=...
```

> **Note**: For local development, configure the application runtime variables above manually in `/.env`. For Azure deployment + CI/CD wiring, run `node infra/setup.js` (details in `infra/README.md`).

## 💻 Development

### API Development

```bash
cd api

# Start in development mode (watch mode)
npm run start:dev

# Start in debug mode
npm run start:debug

# Build for production
npm run build

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov

# Lint code
npm run lint

# Format code
npm run format
```

### SPA Development

```bash
cd spa

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Code Style

- **TypeScript**: Strict type checking enabled, no `any` types allowed
- **Linting**: ESLint with TypeScript rules
- **Formatting**: Prettier
- **Validation**: Zod schemas for runtime validation

### Creating New Types

See `docs/Create-Type.md` for guidelines on creating new types using Zod schemas.

### Testing

- **Unit Tests**: Jest for API, Vitest for SPA (if configured)
- **E2E Tests**: Available in API project
- **Test Coverage**: Aim for >80% coverage

## 🚢 Deployment

### API Deployment

The API is deployed to Azure App Service using Docker containers. GitHub Actions workflows are configured for automatic deployment via Azure Container Registry.

**CI/CD Pipeline:**
- Workflow file: `.github/workflows/api-docker.yml`
- Builds Docker image from `api/Dockerfile`
- Pushes to Azure Container Registry
- Deploys to Azure App Service

**Manual Deployment:**
```bash
cd api
npm run build

# Build Docker image
docker build -t chatqa-api .

# Or deploy using Azure CLI or VS Code Azure extension
```

### SPA Deployment

The SPA is deployed to Azure Static Web Apps. GitHub Actions workflows are configured for automatic deployment.

**CI/CD Pipeline:**
- Workflow file: `.github/workflows/static-web-app.yml`
- Automatically builds and deploys on push to `main` branch

**Manual Deployment:**
```bash
cd spa
npm run build
# Deploy using Azure Static Web Apps CLI or VS Code extension
```

### Infrastructure

Infrastructure + CI/CD can be deployed/configured end-to-end via the scripted setup in `/infra`.

**Deploy infrastructure + configure CI/CD (recommended):**
```bash
node infra/setup.js
```

This script:
- Deploys `infra/main.bicep` to a resource group (location currently hardcoded by the script)
- Generates and passes a JWT signing secret to the deployment
- Configures GitHub Actions variables/secrets for `.github/workflows/`
- Updates the MSAL app registration redirect URIs for the deployed Static Web App
- Creates/updates the Azure AI Search index (`infra/search-index.json`)
- Triggers the API + SPA workflows (`workflow_dispatch`)

See `infra/README.md` for prerequisites, required permissions, and full behavior.

## 📚 API Documentation

Comprehensive API documentation is available in the `api/README.md` file. It includes:

- Complete endpoint reference
- WebSocket event documentation
- Service descriptions
- Database schema
- Environment variable reference

**Key Endpoints:**

- `GET /healthz` - Health check
- `GET /chats/history` - Get chat history
- `POST /chats/:chatId/feedback` - Submit feedback
- `GET /documents` - List documents
- `POST /documents` - Create document
- `GET /event-logs` - Query event logs
- `GET /users` - List users

**WebSocket Events:**

- `chat` - Send chat message (streaming response)
- `ping` - Health check

See `api/README.md` for complete documentation.

## 🤝 Contributing

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Follow code style guidelines
4. **Write tests**: Ensure new features are tested
5. **Commit changes**: Use conventional commit messages
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**: Provide a clear description of changes

### Development Guidelines

- Follow TypeScript strict mode (no `any` types)
- Use Zod for runtime validation
- Write comprehensive tests
- Update documentation for new features
- Follow existing code patterns and structure

## 🗺️ Roadmap

### Planned Features

- [ ] **Document Upload in Chat**
  - Upload documents directly in chat interface
  - Inline document processing

- [ ] **OpenAI Advanced Features**
  - Image generation
  - Code interpreter
  - Web search integration

- [ ] **Custom Connectors**
  - SharePoint integration
  - Google Drive integration
  - OneDrive integration
  - Other document sources

- [ ] **Enhanced Infrastructure**
  - Extend/parameterize templates (regions, SKUs, optional resources)
  - Improve least-privilege role guidance / deployment options

- [ ] **Additional Features**
  - Multi-language support
  - Advanced analytics
  - Export chat conversations
  - Document versioning

### Known Limitations

- `infra/setup.js` currently hardcodes the Azure location to **Australia East** (see `infra/README.md`)
- Some features may require additional Azure service configuration

## 📝 License

Proprietary - See individual package.json files for license information.

## 👤 Author

**Bradley Searle**

## 🙏 Acknowledgments

- Built with [NestJS](https://nestjs.com/)
- Powered by [React](https://react.dev/)
- AI capabilities via [Azure OpenAI](https://azure.microsoft.com/en-us/products/ai-services/openai-service)
- Vector search by [Azure AI Search](https://azure.microsoft.com/en-us/products/search)

---

**Need Help?** Check the documentation in the `/docs` directory or open an issue on GitHub.
