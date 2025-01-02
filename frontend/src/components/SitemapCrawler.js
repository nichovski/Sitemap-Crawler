import React, { useState, useMemo } from 'react';
import { Download, Loader2, ArrowRight, Settings, RefreshCw, ChevronDown, ChevronUp, ArrowUpDown, AlertCircle } from 'lucide-react';

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
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);
  const [showSeoIssuesOnly, setShowSeoIssuesOnly] = useState(false);

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

  const hasSeoIssues = (result) => {
    const { title, description } = getFinalPageData(result.chain);
    return (title && title.length > 70) || (description && description.length > 160);
  };

  const sortResults = (results, config) => {
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
  };

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
    
    if (showErrorsOnly) {
      filtered = filtered.filter(hasRedirectOrError);
    }
    if (showSeoIssuesOnly) {
      filtered = filtered.filter(hasSeoIssues);
    }
    
    return sortResults(filtered, sortConfig);
  }, [results, sortConfig, showErrorsOnly, showSeoIssuesOnly]);

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
                <div className="flex items-center gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Results</h2>
                    <p className="text-sm text-gray-600">
                      Processed {results.processed} of {results.total} URLs
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 border-l pl-4">
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
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      setShowErrorsOnly(!showErrorsOnly);
                      setShowSeoIssuesOnly(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      showErrorsOnly 
                        ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' 
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <AlertCircle size={16} />
                    {showErrorsOnly ? 'Show All' : 'Show Redirects & Errors'}
                  </button>
                  <button
                    onClick={() => {
                      setShowSeoIssuesOnly(!showSeoIssuesOnly);
                      setShowErrorsOnly(false);
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      showSeoIssuesOnly 
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' 
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <AlertCircle size={16} />
                    {showSeoIssuesOnly ? 'Show All' : 'Show SEO Issues'}
                  </button>
                  <button
                    onClick={downloadCSV}
                    className="flex items-center gap-2 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                  >
                    <Download size={18} />
                    Download CSV
                  </button>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
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