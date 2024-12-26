import React, { useState } from 'react';
import { Download, Loader2, ArrowRight, Settings, RefreshCw } from 'lucide-react';

function SitemapCrawler() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [progress, setProgress] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [retryingUrls, setRetryingUrls] = useState(new Set());
  const [options, setOptions] = useState({
    concurrency: 5,
    timeout: 10000,
    maxRedirects: 10,
    retries: 2
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setResults(null);

    try {
      const response = await fetch('http://localhost:3001/api/crawl', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          sitemapUrl: url,
          ...options
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to crawl sitemap');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async (urlToRetry) => {
    setRetryingUrls(prev => new Set([...prev, urlToRetry]));
    
    try {
      const response = await fetch('http://localhost:3001/api/crawl-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          url: urlToRetry,
          ...options
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to crawl URL');
      }

      const data = await response.json();
      
      // Update the results by replacing the old entry with the new one
      setResults(prevResults => ({
        ...prevResults,
        results: prevResults.results.map(result => 
          result.originalUrl === urlToRetry ? data : result
        )
      }));
    } catch (err) {
      setError(`Failed to retry ${urlToRetry}: ${err.message}`);
    } finally {
      setRetryingUrls(prev => {
        const next = new Set(prev);
        next.delete(urlToRetry);
        return next;
      });
    }
  };

  const downloadCSV = () => {
    if (!results) return;

    const csvRows = [['Original URL', 'Last Modified', 'Priority', 'Redirect Chain (URL -> Status -> Response Time)']];
    
    results.results.forEach(result => {
      const chainDescription = result.chain
        .map(step => `${step.url} (${step.statusCode}, ${step.responseTime}ms)`)
        .join(' → ');
      csvRows.push([
        result.originalUrl,
        result.lastModified || '',
        result.priority || '',
        chainDescription
      ]);
    });

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', 'crawl-results.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (statusCode) => {
    if (statusCode >= 200 && statusCode < 300) return 'bg-green-100 text-green-800 border border-green-200';
    if (statusCode >= 300 && statusCode < 400) return 'bg-blue-100 text-blue-800 border border-blue-200';
    return 'bg-red-100 text-red-800 border border-red-200';
  };

  const getStatusDescription = (statusCode) => {
    const statusMap = {
      200: 'OK',
      301: 'Moved Permanently',
      302: 'Found',
      303: 'See Other',
      307: 'Temporary Redirect',
      308: 'Permanent Redirect',
      404: 'Not Found',
      500: 'Server Error'
    };
    return statusMap[statusCode] || `Status ${statusCode}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Sitemap Crawler</h1>
            <p className="text-gray-600 text-lg">
              Enter a sitemap URL to crawl all pages and generate a CSV report with status codes, including redirect chains.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="space-y-2">
              <label htmlFor="sitemap-url" className="block text-sm font-medium text-gray-700">
                Sitemap URL
              </label>
              <input
                id="sitemap-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/sitemap.xml"
                className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                required
              />
            </div>

            <div className="border-t pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                <Settings size={16} />
                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
              </button>

              {showAdvanced && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Concurrent Requests
                    </label>
                    <input
                      type="number"
                      value={options.concurrency}
                      onChange={(e) => setOptions({ ...options, concurrency: parseInt(e.target.value) })}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                      min="1"
                      max="10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Timeout (ms)
                    </label>
                    <input
                      type="number"
                      value={options.timeout}
                      onChange={(e) => setOptions({ ...options, timeout: parseInt(e.target.value) })}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                      min="1000"
                      step="1000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Max Redirects
                    </label>
                    <input
                      type="number"
                      value={options.maxRedirects}
                      onChange={(e) => setOptions({ ...options, maxRedirects: parseInt(e.target.value) })}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Retries
                    </label>
                    <input
                      type="number"
                      value={options.retries}
                      onChange={(e) => setOptions({ ...options, retries: parseInt(e.target.value) })}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                      min="0"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors shadow-sm"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={18} />
                  {progress ? `Crawling (${progress.processed}/${progress.total})...` : 'Crawling...'}
                </>
              ) : (
                'Start Crawling'
              )}
            </button>
          </form>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {results && (
            <div className="space-y-4 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Results</h2>
                  <p className="text-sm text-gray-600">
                    Processed {results.processed} of {results.total} URLs
                  </p>
                </div>
                <button
                  onClick={downloadCSV}
                  className="flex items-center gap-2 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                >
                  <Download size={18} />
                  Download CSV
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Modified</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Chain</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {results.results.map((result, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button
                              onClick={() => handleRetry(result.originalUrl)}
                              disabled={retryingUrls.has(result.originalUrl)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <RefreshCw size={14} className={`${retryingUrls.has(result.originalUrl) ? 'animate-spin' : ''}`} />
                              {retryingUrls.has(result.originalUrl) ? 'Retrying...' : 'Retry'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div className="truncate max-w-md hover:text-blue-600">
                              <a href={result.originalUrl} target="_blank" rel="noopener noreferrer">
                                {result.originalUrl}
                              </a>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(result.lastModified)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {result.priority || '-'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              {result.chain.map((step, stepIndex) => (
                                <React.Fragment key={stepIndex}>
                                  <div className="flex flex-col items-start gap-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(step.statusCode)}`}>
                                        {step.statusCode}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        {getStatusDescription(step.statusCode)}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      <span>{step.responseTime}ms</span>
                                      {step.url !== result.originalUrl && (
                                        <span className="truncate max-w-[200px]">{step.url}</span>
                                      )}
                                    </div>
                                  </div>
                                  {stepIndex < result.chain.length - 1 && (
                                    <ArrowRight size={16} className="text-gray-400 mt-2" />
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SitemapCrawler;