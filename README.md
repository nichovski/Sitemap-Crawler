# Sitemap Crawler

A modern web application for crawling XML sitemaps and analyzing URL redirect chains. Built with React and Node.js, this tool helps you understand and monitor your website's URL structure and redirect patterns.

![Sitemap Crawler Screenshot](screenshot.png)

## Features

- 🚀 Crawl entire XML sitemaps with concurrent requests
- 📊 Analyze redirect chains and status codes
- ⏱️ Track response times for each request
- 🔄 Retry individual URLs
- 📝 Export results to CSV
- 🎯 Support for sitemap index files
- 📱 Responsive modern UI with Tailwind CSS

### Advanced Options

- Concurrent request limit
- Request timeout
- Maximum redirects
- Retry attempts

## Tech Stack

- Frontend:
  - React
  - Tailwind CSS
  - Lucide Icons
  
- Backend:
  - Node.js
  - Express
  - Axios
  - xml2js

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/sitemap-crawler.git
cd sitemap-crawler
```

2. Install dependencies for both frontend and backend:
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

3. Start the backend server:
```bash
cd backend
node server.js
```

4. Start the frontend development server:
```bash
cd frontend
npm start
```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

1. Enter a sitemap URL (e.g., `https://example.com/sitemap.xml`)
2. (Optional) Configure advanced options:
   - Concurrent Requests: Number of simultaneous requests (1-10)
   - Timeout: Maximum time to wait for each request (in milliseconds)
   - Max Redirects: Maximum number of redirects to follow
   - Retries: Number of retry attempts for failed requests

3. Click "Start Crawling" to begin the analysis
4. View results in the table:
   - URL and metadata from sitemap
   - Complete redirect chains
   - Response times
   - Status codes with descriptions

5. Use the retry button to recheck individual URLs
6. Export results to CSV for further analysis

## API Endpoints

### POST /api/crawl
Crawls an entire sitemap

Request body:
```json
{
  "sitemapUrl": "https://example.com/sitemap.xml",
  "concurrency": 5,
  "timeout": 10000,
  "maxRedirects": 10,
  "retries": 2
}
```

### POST /api/crawl-single
Crawls a single URL

Request body:
```json
{
  "url": "https://example.com/page",
  "timeout": 10000,
  "maxRedirects": 10,
  "retries": 2
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [React](https://reactjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Icons from [Lucide](https://lucide.dev/) 