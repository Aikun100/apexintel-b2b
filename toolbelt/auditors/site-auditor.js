import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Conducts a technical & digital audit of a target business site.
 * Identifies quick-win selling opportunities (e.g. missing SEO, slow load, outdated CMS).
 * @param {string} url
 * @returns {Promise<object>}
 */
export async function auditWebsite(url) {
  let targetUrl = url.startsWith('http') ? url : `https://${url}`;
  const startTime = Date.now();

  try {
    const response = await axios.get(targetUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      }
    });

    const responseTimeMs = Date.now() - startTime;
    const html = response.data;
    const $ = cheerio.load(html);

    const title = $('title').text().trim() || null;
    const metaDescription = $('meta[name="description"]').attr('content') || null;
    const viewport = $('meta[name="viewport"]').attr('content') || null;
    const isMobileOptimized = !!viewport;
    const hasHttps = targetUrl.startsWith('https://');

    // Detect CMS / Tech stack cues
    const techStack = [];
    if (html.includes('/wp-content/') || html.includes('wp-includes')) techStack.push('WordPress');
    if (html.includes('cdn.shopify.com')) techStack.push('Shopify');
    if (html.includes('static.wixstatic.com')) techStack.push('Wix');
    if (html.includes('squarespace.com')) techStack.push('Squarespace');
    if (html.includes('webflow.com')) techStack.push('Webflow');
    if (html.includes('gtag(') || html.includes('google-analytics.com')) techStack.push('Google Analytics');
    if (html.includes('fbq(') || html.includes('connect.facebook.net')) techStack.push('Meta Pixel');

    // Audit score calculations
    const issues = [];
    const opportunities = [];

    if (!hasHttps) issues.push('Missing SSL (Not secure)');
    if (!isMobileOptimized) issues.push('Missing mobile viewport meta tag');
    if (!metaDescription) issues.push('Missing SEO meta description');
    if (responseTimeMs > 2500) issues.push(`Slow initial response time (${responseTimeMs}ms)`);
    if (!techStack.includes('Meta Pixel') && !techStack.includes('Google Analytics')) {
      opportunities.push('No advertising tracking pixels detected (not running retargeting campaigns)');
    }
    if (techStack.includes('WordPress') && html.includes('wp-json')) {
      opportunities.push('Standard WordPress setup (candidate for performance caching & modern redesign)');
    }

    return {
      success: true,
      url: targetUrl,
      responseTimeMs,
      hasHttps,
      title,
      metaDescription,
      isMobileOptimized,
      techStack,
      issuesCount: issues.length,
      issues,
      opportunities
    };
  } catch (err) {
    return {
      success: false,
      url: targetUrl,
      error: err.message
    };
  }
}
