# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sitemap Crawler is a full-stack web application for analyzing XML sitemaps and tracking URL redirect chains. It consists of a Node.js backend and a React frontend, designed to help monitor website URL structures and identify SEO issues.

## Architecture

### Backend (Node.js/Express)
- **Location**: `backend/server.js`
- **Port**: 3001
- **Type**: ES Module (uses `import`/`export`)
- **Core functionality**:
  - `followRedirects()`: Recursively follows redirect chains with retry logic, extracts page titles and meta descriptions from HTML responses
  - `parseSitemap()`: Handles both XML sitemap index files and regular sitemaps, with support for text-based sitemaps
  - Two main endpoints: `/api/crawl` (full sitemap) and `/api/crawl-single` (single URL)
- **Concurrency**: Uses `p-limit` for controlling parallel requests
- **Key dependencies**: axios, xml2js, cors, p-limit

### Frontend (React)
- **Location**: `frontend/src/components/SitemapCrawler.js`
- **Port**: 3000 (development)
- **Tech stack**: React 19, Tailwind CSS, Lucide Icons
- **State management**: React hooks (useState, useMemo, useCallback)
- **Core features**:
  - Real-time filtering and sorting of crawl results
  - Expandable/collapsible rows for detailed view
  - SEO analysis (title/description length validation)
  - Issue categorization with severity levels
  - CSV export functionality
  - Statistics dashboard with issue breakdown

## Development Commands

### Installation
```bash
# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

### Running in Development
```bash
# Quick start (both servers)
./start-dev.sh

# Or manually:
# Backend
cd backend && node server.js

# Frontend
cd frontend && npm start
```

### Building
```bash
# Build entire project (syntax check + production build)
./build.sh

# Frontend build only
cd frontend && npm run build
```

### Testing
```bash
cd frontend && npm test
```

## Key Implementation Details

### API Communication
- Backend and frontend communicate via REST API at `http://localhost:3001`
- All crawl operations accept configuration options: `concurrency`, `timeout`, `maxRedirects`, `retries`
- Results include full redirect chains with status codes, response times, and extracted metadata

### Data Flow
1. User submits sitemap URL → Frontend sends POST to `/api/crawl`
2. Backend parses sitemap (handles sitemap index recursively)
3. URLs crawled concurrently with `p-limit` controlling parallelism
4. Each URL follows redirect chain, extracting page metadata
5. Results streamed back with full chain data
6. Frontend processes results for display, sorting, filtering, and SEO analysis

### SEO Analysis
The frontend performs client-side SEO validation:
- Page titles: warns if > 70 characters (optimal: 50-70)
- Meta descriptions: warns if > 160 characters (optimal: 150-160)
- Issue categorization: redirect loops, long chains, HTTP errors, DNS failures

### Error Handling
- Backend includes retry logic with exponential backoff (configurable via `retries` option)
- Timeout handling for slow/unresponsive URLs
- DNS resolution errors and connection failures are categorized separately
- All errors include detailed messages and are preserved in the response chain

## Code Style Notes

- Backend uses ES modules (`import`/`export`, not `require`)
- Frontend uses modern React patterns (hooks, functional components)
- Tailwind CSS for styling with responsive design
- Error states include both error messages and detailed response data when available
