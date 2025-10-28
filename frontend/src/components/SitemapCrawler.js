import React, { useState, useMemo, useCallback } from 'react';
import { Download, Loader2, ArrowRight, Settings, RefreshCw, ChevronDown, ChevronUp, ArrowUpDown, AlertCircle, Search, X, Filter } from 'lucide-react';

function SitemapCrawler() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [retryingUrls, setRetryingUrls] = useState(new Set());
  const [options, setOptions] = useState({
    concurrency: 5,
    timeout: 10000,
    maxRedirects: 10,
    retries: 2
  });
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [showSeoIssuesOnly, setShowSeoIssuesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilters, setStatusFilters] = useState({
    '2xx': false,
    '3xx': false,
    '4xx': false,
    '5xx': false
  });
  const [showFilters, setShowFilters] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setResults(null);
    setExpandedRows(new Set());

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
      setExpandedRows(new Set(data.results.map((_, index) => index)));
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
      201: 'Created',
      204: 'No Content',
      301: 'Moved Permanently',
      302: 'Found (Temporary)',
      303: 'See Other',
      304: 'Not Modified',
      307: 'Temporary Redirect',
      308: 'Permanent Redirect',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      408: 'Request Timeout',
      410: 'Gone',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    };
    return statusMap[statusCode] || `Status ${statusCode}`;
  };

  const getIssueCategory = (result) => {
    const finalStep = result.chain[result.chain.length - 1];
    const statusCode = finalStep.statusCode;
    
    // Check for errors in the error field
    if (finalStep.error) {
      if (finalStep.error.toLowerCase().includes('timeout')) {
        return { type: 'timeout', severity: 'high', message: 'Request Timeout' };
      }
      if (finalStep.error.toLowerCase().includes('enotfound') || finalStep.error.toLowerCase().includes('dns')) {
        return { type: 'dns', severity: 'high', message: 'DNS Resolution Failed' };
      }
      if (finalStep.error.toLowerCase().includes('econnrefused')) {
        return { type: 'connection', severity: 'high', message: 'Connection Refused' };
      }
      return { type: 'network', severity: 'high', message: 'Network Error' };
    }
    
    // Check for redirect loops
    const urls = result.chain.map(step => step.url);
    const uniqueUrls = new Set(urls);
    if (urls.length > uniqueUrls.size) {
      return { type: 'redirect-loop', severity: 'critical', message: 'Redirect Loop Detected' };
    }
    
    // Check for long redirect chains
    if (result.chain.length > 3 && statusCode < 400) {
      return { type: 'long-redirect', severity: 'medium', message: `Long Redirect Chain (${result.chain.length} hops)` };
    }
    
    // Check for specific status codes
    if (statusCode === 404) {
      return { type: '404', severity: 'high', message: 'Page Not Found' };
    }
    if (statusCode === 410) {
      return { type: '410', severity: 'high', message: 'Page Gone' };
    }
    if (statusCode === 403) {
      return { type: '403', severity: 'medium', message: 'Access Forbidden' };
    }
    if (statusCode === 401) {
      return { type: '401', severity: 'medium', message: 'Authentication Required' };
    }
    if (statusCode === 500) {
      return { type: '500', severity: 'high', message: 'Internal Server Error' };
    }
    if (statusCode === 502 || statusCode === 503 || statusCode === 504) {
      return { type: 'server-down', severity: 'high', message: 'Server Unavailable' };
    }
    if (statusCode >= 400 && statusCode < 500) {
      return { type: 'client-error', severity: 'medium', message: 'Client Error' };
    }
    if (statusCode >= 500) {
      return { type: 'server-error', severity: 'high', message: 'Server Error' };
    }
    
    // Check for redirects
    if (result.chain.length > 1 && statusCode < 400) {
      const isHttps = result.originalUrl.startsWith('https://');
      const finalUrl = finalStep.url;
      const finalIsHttps = finalUrl.startsWith('https://');
      
      if (!isHttps && finalIsHttps) {
        return { type: 'http-to-https', severity: 'low', message: 'HTTP to HTTPS Redirect' };
      }
      
      return { type: 'redirect', severity: 'low', message: 'Redirect Chain' };
    }
    
    return null;
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return '🔴';
      case 'medium':
        return '🟡';
      case 'low':
        return '🔵';
      default:
        return '⚪';
    }
  };

  const getFinalPageData = (chain) => {
    // Get the data from the last successful response in the chain
    for (let i = chain.length - 1; i >= 0; i--) {
      if (chain[i].pageTitle || chain[i].metaDescription) {
        const textarea = document.createElement('textarea');
        
        // Decode title
        let title = null;
        if (chain[i].pageTitle) {
          textarea.innerHTML = chain[i].pageTitle;
          title = textarea.value;
        }

        // Decode meta description
        let description = null;
        if (chain[i].metaDescription) {
          textarea.innerHTML = chain[i].metaDescription;
          description = textarea.value;
        }

        return { title, description };
      }
    }
    return { title: null, description: null };
  };

  const getTitleColor = (title) => {
    if (!title) return 'text-gray-400';
    return title.length > 70 ? 'text-red-600' : 'text-gray-700';
  };

  const getDescriptionColor = (description) => {
    if (!description) return 'text-gray-400';
    return description.length > 160 ? 'text-red-600' : 'text-gray-700';
  };

  const getTitleTooltip = (title) => {
    if (!title || title.length <= 70) return '';
    return `Exceeding character limit: should be 50-70, current length is ${title.length} characters`;
  };

  const getDescriptionTooltip = (description) => {
    if (!description || description.length <= 160) return '';
    return `Exceeding character limit: should be 150-160, current length is ${description.length} characters`;
  };

  const toggleRow = (index) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const hasError = (result) => {
    return result.chain.some(step => step.statusCode >= 400);
  };

  const hasRedirectOrError = (result) => {
    return result.chain.length > 1 || result.chain[0].statusCode !== 200;
  };

  const hasSeoIssues = useCallback((result) => {
    const { title, description } = getFinalPageData(result.chain);
    return (title && title.length > 70) || (description && description.length > 160);
  }, []);

  const getStatusCategory = (statusCode) => {
    if (statusCode >= 200 && statusCode < 300) return '2xx';
    if (statusCode >= 300 && statusCode < 400) return '3xx';
    if (statusCode >= 400 && statusCode < 500) return '4xx';
    if (statusCode >= 500) return '5xx';
    return 'other';
  };

  const sortResults = useCallback((results, config) => {
    if (!config.key) return results;

    return [...results].sort((a, b) => {
      let aValue, bValue;

      switch (config.key) {
        case 'title':
          aValue = getFinalPageData(a.chain).title || '';
          bValue = getFinalPageData(b.chain).title || '';
          break;
        case 'url':
          aValue = a.originalUrl;
          bValue = b.originalUrl;
          break;
        case 'lastModified':
          aValue = a.lastModified || '';
          bValue = b.lastModified || '';
          break;
        case 'priority':
          aValue = a.priority || 0;
          bValue = b.priority || 0;
          break;
        case 'status':
          aValue = a.chain[a.chain.length - 1].statusCode;
          bValue = b.chain[b.chain.length - 1].statusCode;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return config.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return config.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, []);

  const handleSort = (key) => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown size={14} className="opacity-50" />;
    }
    return sortConfig.direction === 'asc' ? 
      <ChevronUp size={14} className="text-blue-600" /> : 
      <ChevronDown size={14} className="text-blue-600" />;
  };

  const filteredAndSortedResults = useMemo(() => {
    if (!results) return [];
    let filtered = results.results;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(result => {
        const { title } = getFinalPageData(result.chain);
        return (
          result.originalUrl.toLowerCase().includes(query) ||
          (title && title.toLowerCase().includes(query))
        );
      });
    }
    
    // Status category filters
    const activeStatusFilters = Object.keys(statusFilters).filter(key => statusFilters[key]);
    if (activeStatusFilters.length > 0) {
      filtered = filtered.filter(result => {
        const finalStatus = result.chain[result.chain.length - 1].statusCode;
        const category = getStatusCategory(finalStatus);
        return activeStatusFilters.includes(category);
      });
    }
    
    if (showErrorsOnly) {
      filtered = filtered.filter(hasRedirectOrError);
    }
    if (showSeoIssuesOnly) {
      filtered = filtered.filter(hasSeoIssues);
    }
    
    return sortResults(filtered, sortConfig);
  }, [results, sortConfig, showErrorsOnly, showSeoIssuesOnly, searchQuery, statusFilters, hasSeoIssues, sortResults]);

  const resultStats = useMemo(() => {
    if (!results) return null;
    
    const stats = {
      total: results.results.length,
      success: 0,
      redirects: 0,
      clientErrors: 0,
      serverErrors: 0,
      seoIssues: 0,
      issueBreakdown: {
        '404': 0,
        '410': 0,
        '500': 0,
        'timeout': 0,
        'dns': 0,
        'redirect-loop': 0,
        'long-redirect': 0,
        'other': 0
      }
    };
    
    results.results.forEach(result => {
      const finalStatus = result.chain[result.chain.length - 1].statusCode;
      const category = getStatusCategory(finalStatus);
      const issue = getIssueCategory(result);
      
      if (category === '2xx') stats.success++;
      else if (category === '3xx') stats.redirects++;
      else if (category === '4xx') stats.clientErrors++;
      else if (category === '5xx') stats.serverErrors++;
      
      if (hasSeoIssues(result)) stats.seoIssues++;
      
      // Track issue breakdown
      if (issue) {
        if (issue.type in stats.issueBreakdown) {
          stats.issueBreakdown[issue.type]++;
        } else {
          stats.issueBreakdown.other++;
        }
      }
    });
    
    return stats;
  }, [results, hasSeoIssues]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilters({
      '2xx': false,
      '3xx': false,
      '4xx': false,
      '5xx': false
    });
    setShowErrorsOnly(false);
    setShowSeoIssuesOnly(false);
  };

  const hasActiveFilters = () => {
    return searchQuery.trim() !== '' || 
           Object.values(statusFilters).some(v => v) || 
           showErrorsOnly || 
           showSeoIssuesOnly;
  };

  const toggleAllRows = (expand = true) => {
    if (expand) {
      setExpandedRows(new Set(filteredAndSortedResults.map((_, index) => index)));
    } else {
      setExpandedRows(new Set());
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto p-4 sm:p-6 lg:p-8">
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
                  Crawling...
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
            <div className="space-y-4">
              {/* Statistics Panel */}
              {resultStats && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="text-2xl font-bold text-gray-900">{resultStats.total}</div>
                    <div className="text-sm text-gray-600">Total URLs</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg shadow-sm border border-green-200">
                    <div className="text-2xl font-bold text-green-700">{resultStats.success}</div>
                    <div className="text-sm text-green-600">Success (2xx)</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg shadow-sm border border-blue-200">
                    <div className="text-2xl font-bold text-blue-700">{resultStats.redirects}</div>
                    <div className="text-sm text-blue-600">Redirects (3xx)</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg shadow-sm border border-orange-200">
                    <div className="text-2xl font-bold text-orange-700">{resultStats.clientErrors}</div>
                    <div className="text-sm text-orange-600">Client Errors (4xx)</div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-200">
                    <div className="text-2xl font-bold text-red-700">{resultStats.serverErrors}</div>
                    <div className="text-sm text-red-600">Server Errors (5xx)</div>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg shadow-sm border border-yellow-200">
                    <div className="text-2xl font-bold text-yellow-700">{resultStats.seoIssues}</div>
                    <div className="text-sm text-yellow-600">SEO Issues</div>
                  </div>
                </div>
              )}

              {/* Issue Breakdown */}
              {resultStats && (resultStats.clientErrors > 0 || resultStats.serverErrors > 0 || resultStats.issueBreakdown['redirect-loop'] > 0 || resultStats.issueBreakdown['long-redirect'] > 0) && (
                <div className="bg-white p-4 rounded-lg shadow-sm border border-red-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <AlertCircle size={20} className="text-red-600" />
                    Issues Breakdown
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {resultStats.issueBreakdown['404'] > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-200">
                        <span className="text-xl">🔴</span>
                        <div>
                          <div className="font-bold text-red-800">{resultStats.issueBreakdown['404']}</div>
                          <div className="text-xs text-red-600">404 Not Found</div>
                        </div>
                      </div>
                    )}
                    {resultStats.issueBreakdown['410'] > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-200">
                        <span className="text-xl">🔴</span>
                        <div>
                          <div className="font-bold text-red-800">{resultStats.issueBreakdown['410']}</div>
                          <div className="text-xs text-red-600">410 Gone</div>
                        </div>
                      </div>
                    )}
                    {resultStats.issueBreakdown['500'] > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-orange-50 rounded border border-orange-200">
                        <span className="text-xl">🔴</span>
                        <div>
                          <div className="font-bold text-orange-800">{resultStats.issueBreakdown['500']}</div>
                          <div className="text-xs text-orange-600">Server Error</div>
                        </div>
                      </div>
                    )}
                    {resultStats.issueBreakdown['timeout'] > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-orange-50 rounded border border-orange-200">
                        <span className="text-xl">🔴</span>
                        <div>
                          <div className="font-bold text-orange-800">{resultStats.issueBreakdown['timeout']}</div>
                          <div className="text-xs text-orange-600">Timeouts</div>
                        </div>
                      </div>
                    )}
                    {resultStats.issueBreakdown['dns'] > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-orange-50 rounded border border-orange-200">
                        <span className="text-xl">🔴</span>
                        <div>
                          <div className="font-bold text-orange-800">{resultStats.issueBreakdown['dns']}</div>
                          <div className="text-xs text-orange-600">DNS Errors</div>
                        </div>
                      </div>
                    )}
                    {resultStats.issueBreakdown['redirect-loop'] > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-red-50 rounded border border-red-200">
                        <span className="text-xl">🔴</span>
                        <div>
                          <div className="font-bold text-red-800">{resultStats.issueBreakdown['redirect-loop']}</div>
                          <div className="text-xs text-red-600">Redirect Loops</div>
                        </div>
                      </div>
                    )}
                    {resultStats.issueBreakdown['long-redirect'] > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded border border-yellow-200">
                        <span className="text-xl">🟡</span>
                        <div>
                          <div className="font-bold text-yellow-800">{resultStats.issueBreakdown['long-redirect']}</div>
                          <div className="text-xs text-yellow-600">Long Redirects</div>
                        </div>
                      </div>
                    )}
                    {resultStats.issueBreakdown.other > 0 && (
                      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                        <span className="text-xl">⚪</span>
                        <div>
                          <div className="font-bold text-gray-800">{resultStats.issueBreakdown.other}</div>
                          <div className="text-xs text-gray-600">Other Issues</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Search and Filters */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search Bar */}
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Search by URL or page title..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>

                  {/* Filter Toggle Button */}
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                      showFilters || hasActiveFilters()
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Filter size={18} />
                    Filters
                    {hasActiveFilters() && (
                      <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {Object.values(statusFilters).filter(v => v).length + (showErrorsOnly ? 1 : 0) + (showSeoIssuesOnly ? 1 : 0)}
                      </span>
                    )}
                  </button>

                  {/* Export Button */}
                  <button
                    onClick={downloadCSV}
                    className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                  >
                    <Download size={18} />
                    Export CSV
                  </button>
                </div>

                {/* Filter Options */}
                {showFilters && (
                  <div className="pt-4 border-t space-y-4">
                    {/* Status Code Filters */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Filter by Status Code
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setStatusFilters(prev => ({ ...prev, '2xx': !prev['2xx'] }))}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                            statusFilters['2xx']
                              ? 'bg-green-100 text-green-800 border-green-300'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          2xx Success
                        </button>
                        <button
                          onClick={() => setStatusFilters(prev => ({ ...prev, '3xx': !prev['3xx'] }))}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                            statusFilters['3xx']
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          3xx Redirects
                        </button>
                        <button
                          onClick={() => setStatusFilters(prev => ({ ...prev, '4xx': !prev['4xx'] }))}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                            statusFilters['4xx']
                              ? 'bg-orange-100 text-orange-800 border-orange-300'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          4xx Client Errors
                        </button>
                        <button
                          onClick={() => setStatusFilters(prev => ({ ...prev, '5xx': !prev['5xx'] }))}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                            statusFilters['5xx']
                              ? 'bg-red-100 text-red-800 border-red-300'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          5xx Server Errors
                        </button>
                      </div>
                    </div>

                    {/* Quick Filters */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Quick Filters
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            setShowErrorsOnly(!showErrorsOnly);
                            setShowSeoIssuesOnly(false);
                          }}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                            showErrorsOnly
                              ? 'bg-red-100 text-red-800 border-red-300'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <AlertCircle size={14} className="inline mr-1" />
                          Redirects & Errors Only
                        </button>
                        <button
                          onClick={() => {
                            setShowSeoIssuesOnly(!showSeoIssuesOnly);
                            setShowErrorsOnly(false);
                          }}
                          className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                            showSeoIssuesOnly
                              ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <AlertCircle size={14} className="inline mr-1" />
                          SEO Issues Only
                        </button>
                      </div>
                    </div>

                    {/* Clear Filters */}
                    {hasActiveFilters() && (
                      <div>
                        <button
                          onClick={clearAllFilters}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Clear all filters
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Results Count */}
                <div className="text-sm text-gray-600">
                  Showing {filteredAndSortedResults.length} of {results.total} URLs
                  {hasActiveFilters() && ' (filtered)'}
                </div>
              </div>

              {/* Results Table */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="p-4 border-b flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Results</h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAllRows(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <ChevronDown size={16} />
                      Expand All
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => toggleAllRows(false)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <ChevronUp size={16} />
                      Collapse All
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="w-10 px-6 py-3"></th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <button
                            onClick={() => handleSort('title')}
                            className="flex items-center gap-1 hover:text-gray-700"
                          >
                            Page Info {getSortIcon('title')}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <button
                            onClick={() => handleSort('lastModified')}
                            className="flex items-center gap-1 hover:text-gray-700"
                          >
                            Last Modified {getSortIcon('lastModified')}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <button
                            onClick={() => handleSort('priority')}
                            className="flex items-center gap-1 hover:text-gray-700"
                          >
                            Priority {getSortIcon('priority')}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          <button
                            onClick={() => handleSort('status')}
                            className="flex items-center gap-1 hover:text-gray-700"
                          >
                            Status Chain {getSortIcon('status')}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredAndSortedResults.map((result, index) => {
                        const { title: pageTitle, description: metaDescription } = getFinalPageData(result.chain);
                        const isExpanded = expandedRows.has(index);
                        const hasErrorStatus = hasError(result);
                        const issue = getIssueCategory(result);

                        return (
                          <React.Fragment key={index}>
                            <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-gray-50' : ''} ${hasErrorStatus ? 'bg-red-50' : ''}`}>
                              <td className="px-6 py-4">
                                <button
                                  onClick={() => toggleRow(index)}
                                  className="text-gray-500 hover:text-gray-700"
                                >
                                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </button>
                              </td>
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
                              <td className="px-6 py-4 text-sm">
                                <div className="space-y-1">
                                  {issue && (
                                    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border mb-1 ${getSeverityColor(issue.severity)}`}>
                                      <span>{getSeverityIcon(issue.severity)}</span>
                                      {issue.message}
                                    </div>
                                  )}
                                  {pageTitle && (
                                    <div 
                                      className={`font-medium ${getTitleColor(pageTitle)} relative group`}
                                      title={getTitleTooltip(pageTitle)}
                                    >
                                      <span>{pageTitle}</span>
                                      {pageTitle.length > 70 && (
                                        <div className="absolute hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 left-0 -bottom-8 whitespace-nowrap z-10">
                                          Exceeding character limit: should be 50-70, current length is {pageTitle.length} characters
                                        </div>
                                      )}
                                    </div>
                                  )}
                                  <div className="truncate max-w-md hover:text-blue-600">
                                    <a href={result.originalUrl} target="_blank" rel="noopener noreferrer">
                                      {result.originalUrl}
                                    </a>
                                  </div>
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
                            {isExpanded && (
                              <tr className={hasErrorStatus ? 'bg-red-50' : 'bg-white'}>
                                <td colSpan="6" className="px-6 py-4">
                                  <div className="space-y-4">
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-700 mb-2">Meta Description</h4>
                                      {metaDescription ? (
                                        <div 
                                          className={`text-sm relative group ${getDescriptionColor(metaDescription)}`}
                                          title={getDescriptionTooltip(metaDescription)}
                                        >
                                          <p className="whitespace-pre-wrap">{metaDescription}</p>
                                          {metaDescription.length > 160 && (
                                            <div className="absolute hidden group-hover:block bg-gray-900 text-white text-xs rounded py-1 px-2 left-0 bottom-full mb-1 whitespace-nowrap z-10">
                                              Exceeding character limit: should be 150-160, current length is {metaDescription.length} characters
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-gray-500 italic">No meta description found</p>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
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