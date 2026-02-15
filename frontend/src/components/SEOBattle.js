import React, { useState, useRef } from 'react';
import { Loader2, Share2, Zap, Shield, Clock, Link2, FileText, Image, AlertCircle, CheckCircle, XCircle, BarChart3, Download } from 'lucide-react';
import html2canvas from 'html2canvas';

function SEOBattle() {
  const [siteA, setSiteA] = useState('https://');
  const [siteB, setSiteB] = useState('https://');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);
  const resultsRef = useRef(null);

  // Decode HTML entities
  const decodeHTML = (html) => {
    if (!html) return html;
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  };

  // Generate and share beautiful comparison card
  const handleShareImage = async () => {
    if (!results) return;

    // Extract domain names from URLs
    const getDomainName = (url) => {
      try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '');
      } catch {
        return url;
      }
    };

    const siteAName = getDomainName(results.siteA.url);
    const siteBName = getDomainName(results.siteB.url);

    // Create a canvas for the share card
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630; // Twitter/OG image standard size
    const ctx = canvas.getContext('2d');

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#1e3a8a'); // blue-900
    gradient.addColorStop(0.5, '#7c3aed'); // purple-600
    gradient.addColorStop(1, '#db2777'); // pink-600
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add pattern overlay
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Winner message
    const winnerSite = results.winner === 'siteA' ? siteAName : results.winner === 'siteB' ? siteBName : 'Both sites';
    const loserSite = results.winner === 'siteA' ? siteBName : results.winner === 'siteB' ? siteAName : 'tied';
    const scoreDiff = Math.abs(results.siteA.score.total - results.siteB.score.total);

    // Main headline
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';

    if (results.winner === 'close' || results.winner === 'tie') {
      ctx.fillText('Epic SEO Battle!', canvas.width / 2, 150);
      ctx.font = '36px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      ctx.fillText('Both sites are neck-and-neck', canvas.width / 2, 220);
    } else {
      ctx.fillText(`${winnerSite} has better SEO`, canvas.width / 2, 150);
      ctx.font = '36px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
      ctx.fillText(`than ${loserSite}`, canvas.width / 2, 220);
    }

    // Score comparison
    ctx.font = 'bold 96px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';

    // Site A score
    ctx.fillStyle = results.winner === 'siteA' ? '#34d399' : '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(results.siteA.score.total, canvas.width / 2 - 80, 380);

    // VS
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'bold 48px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', canvas.width / 2, 370);

    // Site B score
    ctx.fillStyle = results.winner === 'siteB' ? '#34d399' : '#ffffff';
    ctx.textAlign = 'left';
    ctx.font = 'bold 96px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillText(results.siteB.score.total, canvas.width / 2 + 80, 380);

    // Score labels
    ctx.font = '20px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'right';
    ctx.fillText(siteAName, canvas.width / 2 - 80, 420);
    ctx.textAlign = 'left';
    ctx.fillText(siteBName, canvas.width / 2 + 80, 420);

    // Bottom text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Compare your website at:', canvas.width / 2, 520);
    ctx.font = '24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(window.location.origin, canvas.width / 2, 570);

    // Convert to blob and download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `seo-comparison-${Date.now()}.png`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    setResults(null);

    try {
      const response = await fetch('http://localhost:3001/api/battle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteA,
          siteB
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to run comparison');
      }

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getMetricIcon = (metric) => {
    const icons = {
      title: FileText,
      metaDescription: FileText,
      redirects: Link2,
      speed: Zap,
      https: Shield,
      ogTags: Image,
      h1: FileText,
      canonical: Link2
    };
    return icons[metric] || FileText;
  };

  const getMetricColor = (points, maxPoints) => {
    const percentage = (points / maxPoints) * 100;
    if (percentage >= 80) return { bg: 'bg-green-50', bar: 'bg-green-600', text: 'text-green-700', border: 'border-green-200' };
    if (percentage >= 50) return { bg: 'bg-yellow-50', bar: 'bg-yellow-600', text: 'text-yellow-700', border: 'border-yellow-200' };
    return { bg: 'bg-red-50', bar: 'bg-red-600', text: 'text-red-700', border: 'border-red-200' };
  };

  const getWinnerMessage = (winner) => {
    if (winner === 'close') return 'Close Match';
    if (winner === 'siteA') return 'Site A Wins';
    if (winner === 'siteB') return 'Site B Wins';
    return 'Tie';
  };

  const handleShare = () => {
    if (!results) return;

    const winnerName = results.winner === 'siteA' ? 'Site A' :
                       results.winner === 'siteB' ? 'Site B' :
                       'Tie';

    const tweetText = `SEO Comparison Results\n\n` +
      `Site A: ${results.siteA.score.total}/80 points\n` +
      `Site B: ${results.siteB.score.total}/80 points\n\n` +
      `Winner: ${winnerName}\n\n` +
      `Compare your site at ${window.location.origin}\n\n` +
      `#SEO #WebPerformance`;

    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  const getIssues = (siteData) => {
    const issues = [];
    const finalStep = siteData.chain[siteData.chain.length - 1];

    // Title issues
    if (!finalStep.pageTitle) {
      issues.push({ type: 'error', metric: 'Title', message: 'No title tag found' });
    } else if (finalStep.pageTitle.length > 70) {
      issues.push({ type: 'warning', metric: 'Title', message: `Title too long (${finalStep.pageTitle.length} chars). Optimal: 50-70` });
    } else if (finalStep.pageTitle.length < 50) {
      issues.push({ type: 'warning', metric: 'Title', message: `Title too short (${finalStep.pageTitle.length} chars). Optimal: 50-70` });
    }

    // Meta description issues
    if (!finalStep.metaDescription) {
      issues.push({ type: 'error', metric: 'Meta Description', message: 'No meta description found' });
    } else if (finalStep.metaDescription.length > 160) {
      issues.push({ type: 'warning', metric: 'Meta Description', message: `Description too long (${finalStep.metaDescription.length} chars). Optimal: 150-160` });
    } else if (finalStep.metaDescription.length < 150) {
      issues.push({ type: 'warning', metric: 'Meta Description', message: `Description too short (${finalStep.metaDescription.length} chars). Optimal: 150-160` });
    }

    // Redirect issues
    if (siteData.chain.length > 3) {
      issues.push({ type: 'warning', metric: 'Redirects', message: `Too many redirects (${siteData.chain.length} hops). Bad for SEO and UX` });
    } else if (siteData.chain.length > 1) {
      issues.push({ type: 'info', metric: 'Redirects', message: `${siteData.chain.length} redirect(s). Consider direct linking` });
    }

    // Speed issues
    if (finalStep.responseTime > 2000) {
      issues.push({ type: 'error', metric: 'Response Time', message: `Very slow (${finalStep.responseTime}ms). Should be under 1s` });
    } else if (finalStep.responseTime > 1000) {
      issues.push({ type: 'warning', metric: 'Response Time', message: `Slow response (${finalStep.responseTime}ms). Aim for under 500ms` });
    }

    // HTTPS issues
    if (!finalStep.isHttps) {
      issues.push({ type: 'error', metric: 'HTTPS', message: 'Not using HTTPS. Major security and SEO issue' });
    }

    // OG Tags issues
    const missing = [];
    if (!finalStep.ogTags?.hasOGImage) missing.push('og:image');
    if (!finalStep.ogTags?.hasOGTitle) missing.push('og:title');
    if (!finalStep.ogTags?.hasOGDescription) missing.push('og:description');

    if (missing.length > 0) {
      issues.push({ type: 'warning', metric: 'Open Graph Tags', message: `Missing: ${missing.join(', ')}. Poor social sharing optimization` });
    }

    // H1 tag issues
    if (!finalStep.h1Tag || finalStep.h1Tag.trim().length === 0) {
      issues.push({ type: 'error', metric: 'H1 Tag', message: 'No H1 tag found. Important for page structure and SEO' });
    }

    // Canonical tag issues
    if (!finalStep.canonicalUrl) {
      issues.push({ type: 'warning', metric: 'Canonical URL', message: 'No canonical tag found. Risk of duplicate content issues' });
    }

    // Hreflang issues
    if (!finalStep.hreflangCount || finalStep.hreflangCount === 0) {
      issues.push({ type: 'info', metric: 'Hreflang', message: 'No hreflang annotations. Consider adding for international SEO' });
    }

    return issues;
  };

  const MetricBadge = ({ label, points, maxPoints, metric, tooltipContent }) => {
    const IconComponent = getMetricIcon(metric);
    const percentage = (points / maxPoints) * 100;
    const colors = getMetricColor(points, maxPoints);

    // Determine status icon
    const getStatusIcon = () => {
      if (percentage >= 80) return <CheckCircle className="w-4 h-4 text-green-600" />;
      if (percentage >= 50) return <AlertCircle className="w-4 h-4 text-yellow-600" />;
      return <XCircle className="w-4 h-4 text-red-600" />;
    };

    return (
      <div className={`${colors.bg} ${colors.border} border rounded-lg p-4 relative group`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <IconComponent className={`w-4 h-4 ${colors.text}`} />
            <span className="text-sm font-medium text-gray-900">{label}</span>
            {getStatusIcon()}
          </div>
          <div className="text-right">
            <span className={`text-lg font-semibold ${colors.text}`}>{points}</span>
            <span className="text-sm text-gray-500">/{maxPoints}</span>
          </div>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${colors.bar} transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Tooltip */}
        {tooltipContent && (
          <div className="absolute left-0 right-0 top-full mt-2 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10 max-w-md">
            <div className="font-semibold mb-1">{label}:</div>
            <div className="break-words">{tooltipContent}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto p-4 sm:p-6 lg:p-8">
        <div className="space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">SEO Comparison Tool</h1>
          <p className="text-gray-600 text-lg">
            Compare two websites side-by-side across key SEO metrics and get detailed performance insights.
          </p>
        </div>

        {/* Comparison Form */}
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Site A */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Site A
              </label>
              <input
                type="url"
                value={siteA}
                onChange={(e) => setSiteA(e.target.value)}
                placeholder="https://example.com"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900"
                required
              />
            </div>

            {/* Site B */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Site B
              </label>
              <input
                type="url"
                value={siteB}
                onChange={(e) => setSiteB(e.target.value)}
                placeholder="https://competitor.com"
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-gray-900"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={20} />
                Analyzing...
              </>
            ) : (
              <>
                <BarChart3 className="mr-2" size={20} />
                Compare Sites
              </>
            )}
          </button>
        </form>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Results */}
        {results && (
          <div ref={resultsRef} className="space-y-6">
            {/* Winner Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {getWinnerMessage(results.winner)}
              </h2>
              <p className="text-gray-600 mt-1">
                Site A: {results.siteA.score.total}/80 • Site B: {results.siteB.score.total}/80
              </p>
            </div>

            {/* Comparison Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Site A Card */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-6">
                <div className="pb-4 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Site A</h3>
                    <div className="text-4xl font-bold text-gray-900">
                      {results.siteA.score.total}
                      <span className="text-lg text-gray-500">/80</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 truncate">{results.siteA.url}</p>
                </div>

                {/* Metrics */}
                <div className="space-y-3">
                  <MetricBadge
                    label="Title Tag"
                    points={results.siteA.score.breakdown.title}
                    maxPoints={10}
                    metric="title"
                    tooltipContent={decodeHTML(results.siteA.chain[results.siteA.chain.length - 1].pageTitle) || 'No title tag found'}
                  />
                  <MetricBadge
                    label="Meta Description"
                    points={results.siteA.score.breakdown.metaDescription}
                    maxPoints={10}
                    metric="metaDescription"
                    tooltipContent={decodeHTML(results.siteA.chain[results.siteA.chain.length - 1].metaDescription) || 'No meta description found'}
                  />
                  <MetricBadge
                    label="Redirect Chain"
                    points={results.siteA.score.breakdown.redirects}
                    maxPoints={15}
                    metric="redirects"
                    tooltipContent={`${results.siteA.chain.length} redirect(s): ${results.siteA.chain.map(step => step.url).join(' → ')}`}
                  />
                  <MetricBadge
                    label="Response Time"
                    points={results.siteA.score.breakdown.speed}
                    maxPoints={15}
                    metric="speed"
                    tooltipContent={`${results.siteA.chain[results.siteA.chain.length - 1].responseTime}ms`}
                  />
                  <MetricBadge
                    label="HTTPS"
                    points={results.siteA.score.breakdown.https}
                    maxPoints={10}
                    metric="https"
                    tooltipContent={results.siteA.chain[results.siteA.chain.length - 1].isHttps ? 'Secure HTTPS connection' : 'Insecure HTTP connection'}
                  />
                  <MetricBadge
                    label="Open Graph Tags"
                    points={results.siteA.score.breakdown.ogTags}
                    maxPoints={10}
                    metric="ogTags"
                    tooltipContent={`og:title: ${results.siteA.chain[results.siteA.chain.length - 1].ogTags?.hasOGTitle ? '✓' : '✗'}, og:description: ${results.siteA.chain[results.siteA.chain.length - 1].ogTags?.hasOGDescription ? '✓' : '✗'}, og:image: ${results.siteA.chain[results.siteA.chain.length - 1].ogTags?.hasOGImage ? '✓' : '✗'}`}
                  />
                  <MetricBadge
                    label="H1 Tag"
                    points={results.siteA.score.breakdown.h1}
                    maxPoints={5}
                    metric="h1"
                    tooltipContent={decodeHTML(results.siteA.chain[results.siteA.chain.length - 1].h1Tag) || 'No H1 tag found'}
                  />
                  <MetricBadge
                    label="Canonical URL"
                    points={results.siteA.score.breakdown.canonical}
                    maxPoints={5}
                    metric="canonical"
                    tooltipContent={results.siteA.chain[results.siteA.chain.length - 1].canonicalUrl || 'No canonical tag found'}
                  />
                </div>
              </div>

              {/* Site B Card */}
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-6">
                <div className="pb-4 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Site B</h3>
                    <div className="text-4xl font-bold text-gray-900">
                      {results.siteB.score.total}
                      <span className="text-lg text-gray-500">/80</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 truncate">{results.siteB.url}</p>
                </div>

                {/* Metrics */}
                <div className="space-y-3">
                  <MetricBadge
                    label="Title Tag"
                    points={results.siteB.score.breakdown.title}
                    maxPoints={10}
                    metric="title"
                    tooltipContent={decodeHTML(results.siteB.chain[results.siteB.chain.length - 1].pageTitle) || 'No title tag found'}
                  />
                  <MetricBadge
                    label="Meta Description"
                    points={results.siteB.score.breakdown.metaDescription}
                    maxPoints={10}
                    metric="metaDescription"
                    tooltipContent={decodeHTML(results.siteB.chain[results.siteB.chain.length - 1].metaDescription) || 'No meta description found'}
                  />
                  <MetricBadge
                    label="Redirect Chain"
                    points={results.siteB.score.breakdown.redirects}
                    maxPoints={15}
                    metric="redirects"
                    tooltipContent={`${results.siteB.chain.length} redirect(s): ${results.siteB.chain.map(step => step.url).join(' → ')}`}
                  />
                  <MetricBadge
                    label="Response Time"
                    points={results.siteB.score.breakdown.speed}
                    maxPoints={15}
                    metric="speed"
                    tooltipContent={`${results.siteB.chain[results.siteB.chain.length - 1].responseTime}ms`}
                  />
                  <MetricBadge
                    label="HTTPS"
                    points={results.siteB.score.breakdown.https}
                    maxPoints={10}
                    metric="https"
                    tooltipContent={results.siteB.chain[results.siteB.chain.length - 1].isHttps ? 'Secure HTTPS connection' : 'Insecure HTTP connection'}
                  />
                  <MetricBadge
                    label="Open Graph Tags"
                    points={results.siteB.score.breakdown.ogTags}
                    maxPoints={10}
                    metric="ogTags"
                    tooltipContent={`og:title: ${results.siteB.chain[results.siteB.chain.length - 1].ogTags?.hasOGTitle ? '✓' : '✗'}, og:description: ${results.siteB.chain[results.siteB.chain.length - 1].ogTags?.hasOGDescription ? '✓' : '✗'}, og:image: ${results.siteB.chain[results.siteB.chain.length - 1].ogTags?.hasOGImage ? '✓' : '✗'}`}
                  />
                  <MetricBadge
                    label="H1 Tag"
                    points={results.siteB.score.breakdown.h1}
                    maxPoints={5}
                    metric="h1"
                    tooltipContent={decodeHTML(results.siteB.chain[results.siteB.chain.length - 1].h1Tag) || 'No H1 tag found'}
                  />
                  <MetricBadge
                    label="Canonical URL"
                    points={results.siteB.score.breakdown.canonical}
                    maxPoints={5}
                    metric="canonical"
                    tooltipContent={results.siteB.chain[results.siteB.chain.length - 1].canonicalUrl || 'No canonical tag found'}
                  />
                </div>
              </div>
            </div>

            {/* Share Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={handleShareImage}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-lg transition-all font-bold shadow-lg hover:shadow-xl"
              >
                <Download size={20} />
                Download Comparison Card
              </button>
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-md transition-colors font-medium"
              >
                <Share2 size={18} />
                Share on X
              </button>
            </div>

            {/* Issues Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Site A Issues */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <AlertCircle size={20} />
                  Site A Issues
                </h3>
                {getIssues(results.siteA).length > 0 ? (
                  <div className="space-y-2">
                    {getIssues(results.siteA).map((issue, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-md border ${
                          issue.type === 'error'
                            ? 'bg-red-50 border-red-200'
                            : issue.type === 'warning'
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        {issue.type === 'error' ? (
                          <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        ) : issue.type === 'warning' ? (
                          <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm">{issue.metric}</div>
                          <div className="text-gray-600 text-sm mt-0.5">{issue.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
                    <p className="text-green-600 font-medium">No issues found</p>
                  </div>
                )}
              </div>

              {/* Site B Issues */}
              <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <AlertCircle size={20} />
                  Site B Issues
                </h3>
                {getIssues(results.siteB).length > 0 ? (
                  <div className="space-y-2">
                    {getIssues(results.siteB).map((issue, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-md border ${
                          issue.type === 'error'
                            ? 'bg-red-50 border-red-200'
                            : issue.type === 'warning'
                            ? 'bg-yellow-50 border-yellow-200'
                            : 'bg-blue-50 border-blue-200'
                        }`}
                      >
                        {issue.type === 'error' ? (
                          <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                        ) : issue.type === 'warning' ? (
                          <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm">{issue.metric}</div>
                          <div className="text-gray-600 text-sm mt-0.5">{issue.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="w-10 h-10 text-green-600 mx-auto mb-2" />
                    <p className="text-green-600 font-medium">No issues found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default SEOBattle;
