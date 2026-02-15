import express from 'express';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';
import cors from 'cors';
import pLimit from 'p-limit';

const app = express();
app.use(cors());
app.use(express.json());

async function followRedirects(url, options = {}) {
    const {
        maxRedirects = 10,
        timeout = 10000,
        retries = 2
    } = options;

    let redirectChain = [];
    let currentUrl = url;
    let redirectCount = 0;
    let attempt = 0;
    const startTime = Date.now();

    while (redirectCount < maxRedirects && attempt <= retries) {
        try {
            const response = await axios.get(currentUrl, {
                maxRedirects: 0,
                timeout,
                validateStatus: function (status) {
                    return status >= 200 && status < 600;
                },
                headers: {
                    'User-Agent': 'SitemapCrawler/1.0'
                }
            });

            let pageTitle = null;
            let metaDescription = null;
            let ogTags = {
                hasOGImage: false,
                hasOGTitle: false,
                hasOGDescription: false
            };

            if (response.headers['content-type']?.includes('text/html')) {
                // Extract title from HTML content
                const titleMatch = response.data.match(/<title[^>]*>([^<]+)<\/title>/i);
                pageTitle = titleMatch ? titleMatch[1].trim() : null;

                // Extract meta description (handle apostrophes in content)
                const metaMatch = response.data.match(/<meta[^>]*name=["']description["'][^>]*content="([^"]*)"[^>]*>/i)
                    || response.data.match(/<meta[^>]*name=["']description["'][^>]*content='([^']*)'[^>]*>/i)
                    || response.data.match(/<meta[^>]*content="([^"]*)"[^>]*name=["']description["'][^>]*>/i)
                    || response.data.match(/<meta[^>]*content='([^']*)'[^>]*name=["']description["'][^>]*>/i);
                metaDescription = metaMatch ? metaMatch[1].trim() : null;

                // Extract OG tags
                ogTags.hasOGImage = /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i.test(response.data);
                ogTags.hasOGTitle = /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i.test(response.data);
                ogTags.hasOGDescription = /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i.test(response.data);

                // Extract H1 tag
                var h1Match = response.data.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
                var h1Tag = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : null;

                // Extract canonical URL (handle both attribute orders)
                var canonicalMatch = response.data.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)
                    || response.data.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
                var canonicalUrl = canonicalMatch ? canonicalMatch[1].trim() : null;

                // Count hreflang annotations
                var hreflangMatches = response.data.match(/<link[^>]*rel=["']alternate["'][^>]*hreflang/gi);
                var hreflangCount = hreflangMatches ? hreflangMatches.length : 0;
            }

            redirectChain.push({
                url: currentUrl,
                statusCode: response.status,
                responseTime: Date.now() - startTime,
                contentType: response.headers['content-type'],
                contentLength: response.headers['content-length'],
                pageTitle: pageTitle,
                metaDescription: metaDescription,
                ogTags: ogTags,
                isHttps: currentUrl.startsWith('https://'),
                h1Tag: h1Tag || null,
                canonicalUrl: canonicalUrl || null,
                hreflangCount: hreflangCount || 0
            });

            if (response.status < 300 || response.status >= 400) {
                break;
            }

            const nextUrl = response.headers.location;
            if (!nextUrl) break;

            currentUrl = new URL(nextUrl, currentUrl).href;
            redirectCount++;
            attempt = 0; // Reset attempt counter on successful redirect
        } catch (error) {
            attempt++;
            if (attempt > retries) {
                redirectChain.push({
                    url: currentUrl,
                    statusCode: error.response ? error.response.status : 500,
                    responseTime: Date.now() - startTime,
                    error: error.message
                });
                break;
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }

    return redirectChain;
}

function calculateScore(chain) {
    let score = 0;
    const breakdown = {};

    if (chain.length === 0) return { total: 0, breakdown };

    const finalStep = chain[chain.length - 1];

    // Title optimization (10 points)
    if (finalStep.pageTitle) {
        const titleLength = finalStep.pageTitle.length;
        if (titleLength >= 50 && titleLength <= 70) {
            breakdown.title = 10;
            score += 10;
        } else {
            breakdown.title = 5;
            score += 5;
        }
    } else {
        breakdown.title = 0;
    }

    // Meta description (10 points)
    if (finalStep.metaDescription) {
        const descLength = finalStep.metaDescription.length;
        if (descLength >= 150 && descLength <= 160) {
            breakdown.metaDescription = 10;
            score += 10;
        } else {
            breakdown.metaDescription = 5;
            score += 5;
        }
    } else {
        breakdown.metaDescription = 0;
    }

    // Redirect chain (15 points)
    const statusCode = finalStep.statusCode;
    if (statusCode >= 400) {
        breakdown.redirects = 0;
    } else if (chain.length === 1) {
        breakdown.redirects = 15;
        score += 15;
    } else if (chain.length === 2) {
        breakdown.redirects = 10;
        score += 10;
    } else {
        breakdown.redirects = 5;
        score += 5;
    }

    // Response speed (15 points)
    const responseTime = finalStep.responseTime;
    if (responseTime < 500) {
        breakdown.speed = 15;
        score += 15;
    } else if (responseTime < 1000) {
        breakdown.speed = 10;
        score += 10;
    } else if (responseTime < 2000) {
        breakdown.speed = 5;
        score += 5;
    } else {
        breakdown.speed = 0;
    }

    // HTTPS (10 points)
    if (finalStep.isHttps) {
        breakdown.https = 10;
        score += 10;
    } else {
        breakdown.https = 0;
    }

    // OG Tags (10 points)
    const ogTags = finalStep.ogTags;
    if (ogTags && ogTags.hasOGImage && ogTags.hasOGTitle && ogTags.hasOGDescription) {
        breakdown.ogTags = 10;
        score += 10;
    } else if (ogTags && (ogTags.hasOGImage || ogTags.hasOGTitle || ogTags.hasOGDescription)) {
        breakdown.ogTags = 5;
        score += 5;
    } else {
        breakdown.ogTags = 0;
    }

    // H1 Tag (5 points)
    if (finalStep.h1Tag && finalStep.h1Tag.length > 0) {
        breakdown.h1 = 5;
        score += 5;
    } else {
        breakdown.h1 = 0;
    }

    // Canonical URL (5 points)
    if (finalStep.canonicalUrl) {
        breakdown.canonical = 5;
        score += 5;
    } else {
        breakdown.canonical = 0;
    }

    return { total: score, breakdown };
}

async function fetchSitemapResponse(url) {
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'SitemapCrawler/1.0'
        },
        timeout: 15000,
        validateStatus: (status) => status < 400
    });
    return response;
}

async function parseSitemapResponse(response) {
    const contentType = response.headers['content-type'] || '';
    let urls = [];

    // Try XML parsing if content looks like XML (by content-type or content)
    const dataStr = typeof response.data === 'string' ? response.data : '';
    const looksLikeXml = contentType.includes('xml') || dataStr.trimStart().startsWith('<?xml') || dataStr.trimStart().startsWith('<urlset') || dataStr.trimStart().startsWith('<sitemapindex');

    if (looksLikeXml) {
        const result = await parseStringPromise(dataStr);

        // Handle sitemap index files
        if (result.sitemapindex) {
            const sitemapUrls = result.sitemapindex.sitemap.map(entry => entry.loc[0]);
            for (const sitemapUrl of sitemapUrls) {
                const subResponse = await fetchSitemapResponse(sitemapUrl);
                const subUrls = await parseSitemapResponse(subResponse);
                urls.push(...subUrls);
            }
        } 
        // Handle regular sitemaps
        else if (result.urlset) {
            urls = result.urlset.url.map(entry => ({
                loc: entry.loc[0],
                lastmod: entry.lastmod ? entry.lastmod[0] : null,
                priority: entry.priority ? parseFloat(entry.priority[0]) : null
            }));
        }
    } else if (contentType.includes('text/plain')) {
        // Handle text-based sitemaps
        urls = dataStr
            .split('\n')
            .filter(line => line.trim())
            .map(url => ({ loc: url.trim() }));
    }

    return urls;
}

async function parseSitemap(url) {
    // Extract base URL for trying alternative paths
    let baseUrl;
    try {
        const parsed = new URL(url);
        baseUrl = `${parsed.protocol}//${parsed.host}`;
    } catch {
        throw new Error(`Invalid URL: ${url}`);
    }

    // Try the given URL first, then common alternatives
    const urlsToTry = [url];
    
    // If the URL ends with /sitemap.xml, also try common alternatives
    if (url.endsWith('/sitemap.xml')) {
        urlsToTry.push(
            `${baseUrl}/sitemap_index.xml`,
            `${baseUrl}/wp-sitemap.xml`,
            `${baseUrl}/sitemap.xml.gz`
        );
    }

    let lastError = null;
    for (const tryUrl of urlsToTry) {
        try {
            const response = await fetchSitemapResponse(tryUrl);
            const urls = await parseSitemapResponse(response);
            if (urls.length > 0) {
                return urls;
            }
        } catch (err) {
            lastError = err;
        }
    }

    throw lastError || new Error(`No sitemap found. Tried: ${urlsToTry.join(', ')}`);
}

function normalizeSitemapUrl(input) {
    let url = input.trim();
    // Add https:// if no protocol
    if (!/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }
    // If it doesn't end with .xml, assume it's a domain and append /sitemap.xml
    if (!/\.xml(\?.*)?$/i.test(url)) {
        // Remove trailing slash if present
        url = url.replace(/\/+$/, '');
        url += '/sitemap.xml';
    }
    return url;
}

app.post('/api/crawl', async (req, res) => {
    const { 
        sitemapUrl,
        concurrency = 5,
        timeout = 10000,
        maxRedirects = 10,
        retries = 2
    } = req.body;

    try {
        // Normalize the URL (add protocol, append /sitemap.xml if needed)
        const normalizedUrl = normalizeSitemapUrl(sitemapUrl);

        // Extract URLs from sitemap
        const urls = await parseSitemap(normalizedUrl);
        
        // Set up concurrency limit
        const limit = pLimit(concurrency);
        let processed = 0;
        const total = urls.length;

        // Crawl URLs
        const crawlResults = await Promise.all(
            urls.map(url => limit(async () => {
                try {
                    const redirectChain = await followRedirects(url.loc, {
                        maxRedirects,
                        timeout,
                        retries
                    });

                    processed++;
                    return {
                        originalUrl: url.loc,
                        lastModified: url.lastmod,
                        priority: url.priority,
                        chain: redirectChain
                    };
                } catch (error) {
                    return {
                        originalUrl: url.loc,
                        lastModified: url.lastmod,
                        priority: url.priority,
                        chain: [{
                            url: url.loc,
                            statusCode: error.response ? error.response.status : 500,
                            error: error.message
                        }]
                    };
                }
            }))
        );

        res.json({
            total,
            processed,
            results: crawlResults
        });
    } catch (error) {
        const statusCode = error.response?.status;
        let userMessage = error.message;
        const triedUrl = normalizeSitemapUrl(sitemapUrl);
        
        if (statusCode === 404) {
            userMessage = `Sitemap not found at ${triedUrl}. Make sure the site has a sitemap.xml file.`;
        } else if (statusCode === 403 || statusCode === 401) {
            userMessage = `Access denied when fetching sitemap. The site may be blocking automated requests.`;
        } else if (statusCode === 429) {
            userMessage = `Rate limited by the server. Please wait a moment and try again.`;
        } else if (error.code === 'ENOTFOUND') {
            userMessage = `Domain not found. Please check the URL and try again.`;
        } else if (error.code === 'ECONNREFUSED') {
            userMessage = `Could not connect to the server. The site may be down.`;
        }
        
        res.status(500).json({ 
            error: userMessage,
            details: error.response ? error.response.data : null
        });
    }
});

app.post('/api/crawl-single', async (req, res) => {
    const { 
        url,
        timeout = 10000,
        maxRedirects = 10,
        retries = 2
    } = req.body;

    try {
        const redirectChain = await followRedirects(url, {
            maxRedirects,
            timeout,
            retries
        });

        res.json({
            originalUrl: url,
            lastModified: null, // Single URL crawl won't have sitemap metadata
            priority: null,
            chain: redirectChain
        });
    } catch (error) {
        res.status(500).json({ 
            error: error.message,
            details: error.response ? error.response.data : null
        });
    }
});

app.post('/api/battle', async (req, res) => {
    const {
        siteA,
        siteB,
        timeout = 10000,
        maxRedirects = 10,
        retries = 2
    } = req.body;

    if (!siteA || !siteB) {
        return res.status(400).json({
            error: 'Both siteA and siteB URLs are required'
        });
    }

    try {
        // Crawl both sites in parallel
        const [chainA, chainB] = await Promise.all([
            followRedirects(siteA, { maxRedirects, timeout, retries }),
            followRedirects(siteB, { maxRedirects, timeout, retries })
        ]);

        // Calculate scores
        const scoreA = calculateScore(chainA);
        const scoreB = calculateScore(chainB);

        // Determine winner
        let winner = 'tie';
        if (Math.abs(scoreA.total - scoreB.total) <= 10) {
            winner = 'close';
        } else if (scoreA.total > scoreB.total) {
            winner = 'siteA';
        } else {
            winner = 'siteB';
        }

        res.json({
            siteA: {
                url: siteA,
                chain: chainA,
                score: scoreA
            },
            siteB: {
                url: siteB,
                chain: chainB,
                score: scoreB
            },
            winner
        });
    } catch (error) {
        res.status(500).json({
            error: error.message,
            details: error.response ? error.response.data : null
        });
    }
});

const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});