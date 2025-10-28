import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import SitemapCrawler from './components/SitemapCrawler';
import SEOBattle from './components/SEOBattle';
import './App.css';

function Navigation() {
  const location = useLocation();

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="flex space-x-1">
          <Link
            to="/"
            className={`relative py-4 px-6 font-medium text-sm transition-all duration-200 ${
              location.pathname === '/'
                ? 'text-gray-900 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sitemap Crawler
          </Link>
          <Link
            to="/battle"
            className={`relative py-4 px-6 font-medium text-sm transition-all duration-200 ${
              location.pathname === '/battle'
                ? 'text-gray-900 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            SEO Comparison
          </Link>
        </div>
      </div>
    </div>
  );
}

function App() {
  const location = useLocation();
  const isBattlePage = location.pathname === '/battle';

  return (
    <div className="App min-h-screen bg-gray-50">
      <Routes>
        <Route path="/" element={<SitemapCrawler />} />
        <Route path="/battle" element={<SEOBattle />} />
      </Routes>
    </div>
  );
}

function AppWrapper() {
  return (
    <Router>
      <Navigation />
      <App />
    </Router>
  );
}

export default AppWrapper;
