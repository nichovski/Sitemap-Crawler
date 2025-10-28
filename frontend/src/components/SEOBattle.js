import React, { useState } from 'react';
import { Loader2, Share2, Zap, Shield, Clock, Link2, FileText, Image, AlertCircle, CheckCircle, XCircle, BarChart3 } from 'lucide-react';

function SEOBattle() {
  const [siteA, setSiteA] = useState('');
  const [siteB, setSiteB] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);

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
      ogTags: Image
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
      `Site A: ${results.siteA.score.total}/70 points\n` +
      `Site B: ${results.siteB.score.total}/70 points\n\n` +
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

    return issues;
  };

  const MetricBadge = ({ label, points, maxPoints, metric }) => {
    const IconComponent = getMetricIcon(metric);
    const percentage = (points / maxPoints) * 100;
    const colors = getMetricColor(points, maxPoints);

    return (
      <div className={`${colors.bg} ${colors.border} border rounded-lg p-4`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <IconComponent className={`w-4 h-4 ${colors.text}`} />
            <span className="text-sm font-medium text-gray-900">{label}</span>
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
      </div>
    );
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-gray-900">
            SEO Comparison Tool
          </h1>
          <p className="text-gray-600 text-lg max-w-2xl mx-auto">
            Compare two websites side-by-side across key SEO metrics
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
          <div className="space-y-6">
            {/* Winner Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {getWinnerMessage(results.winner)}
              </h2>
              <p className="text-gray-600 mt-1">
                Site A: {results.siteA.score.total}/70 • Site B: {results.siteB.score.total}/70
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
                      <span className="text-lg text-gray-500">/70</span>
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
                  />
                  <MetricBadge
                    label="Meta Description"
                    points={results.siteA.score.breakdown.metaDescription}
                    maxPoints={10}
                    metric="metaDescription"
                  />
                  <MetricBadge
                    label="Redirect Chain"
                    points={results.siteA.score.breakdown.redirects}
                    maxPoints={15}
                    metric="redirects"
                  />
                  <MetricBadge
                    label="Response Time"
                    points={results.siteA.score.breakdown.speed}
                    maxPoints={15}
                    metric="speed"
                  />
                  <MetricBadge
                    label="HTTPS"
                    points={results.siteA.score.breakdown.https}
                    maxPoints={10}
                    metric="https"
                  />
                  <MetricBadge
                    label="Open Graph Tags"
                    points={results.siteA.score.breakdown.ogTags}
                    maxPoints={10}
                    metric="ogTags"
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
                      <span className="text-lg text-gray-500">/70</span>
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
                  />
                  <MetricBadge
                    label="Meta Description"
                    points={results.siteB.score.breakdown.metaDescription}
                    maxPoints={10}
                    metric="metaDescription"
                  />
                  <MetricBadge
                    label="Redirect Chain"
                    points={results.siteB.score.breakdown.redirects}
                    maxPoints={15}
                    metric="redirects"
                  />
                  <MetricBadge
                    label="Response Time"
                    points={results.siteB.score.breakdown.speed}
                    maxPoints={15}
                    metric="speed"
                  />
                  <MetricBadge
                    label="HTTPS"
                    points={results.siteB.score.breakdown.https}
                    maxPoints={10}
                    metric="https"
                  />
                  <MetricBadge
                    label="Open Graph Tags"
                    points={results.siteB.score.breakdown.ogTags}
                    maxPoints={10}
                    metric="ogTags"
                  />
                </div>
              </div>
            </div>

            {/* Share Button */}
            <div className="text-center">
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-md transition-colors font-medium"
              >
                <Share2 size={18} />
                Share Results on X
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
  );
}

export default SEOBattle;
