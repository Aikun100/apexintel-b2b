import axios from 'axios';
import * as cheerio from 'cheerio';
import { validateEmail, validatePhone } from '../validators/contact-validator.js';

const COMMON_CONTACT_PATHS = [
  '/',
  '/contact',
  '/contact-us',
  '/about',
  '/about-us',
  '/team'
];

/**
 * Scrapes emails, phone numbers, and social links from a company website.
 * @param {string} baseUrl
 * @returns {Promise<object>}
 */
export async function crawlWebsiteContacts(baseUrl) {
  let targetUrl = baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`;
  try {
    const parsedUrl = new URL(targetUrl);
    targetUrl = parsedUrl.origin;
  } catch {
    return { success: false, error: 'Invalid URL' };
  }

  const foundEmails = new Set();
  const foundPhones = new Set();
  const socialLinks = {
    linkedin: null,
    facebook: null,
    instagram: null,
    twitter: null,
    youtube: null
  };

  const client = axios.create({
    timeout: 8000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?/g;

  // Visit key pages
  for (const subPath of COMMON_CONTACT_PATHS) {
    const pageUrl = `${targetUrl}${subPath === '/' ? '' : subPath}`;
    try {
      const response = await client.get(pageUrl);
      if (typeof response.data !== 'string') continue;

      const html = response.data;
      const $ = cheerio.load(html);

      // 1. Mailto links
      $('a[href^="mailto:"]').each((_, el) => {
        const mailto = $(el).attr('href').replace(/^mailto:/i, '').split('?')[0].trim();
        if (mailto) foundEmails.add(mailto.toLowerCase());
      });

      // 2. Tel links
      $('a[href^="tel:"]').each((_, el) => {
        const tel = $(el).attr('href').replace(/^tel:/i, '').trim();
        if (tel) foundPhones.add(tel);
      });

      // 3. Regex matches in page text
      const bodyText = $('body').text();
      const rawEmails = bodyText.match(emailRegex) || [];
      for (const em of rawEmails) {
        if (!em.endsWith('.png') && !em.endsWith('.jpg') && !em.endsWith('.jpeg') && !em.endsWith('.webp')) {
          foundEmails.add(em.toLowerCase());
        }
      }

      const rawPhones = bodyText.match(phoneRegex) || [];
      for (const ph of rawPhones) {
        if (ph.trim().length >= 10) foundPhones.add(ph.trim());
      }

      // 4. Social links
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        if (!socialLinks.linkedin && href.includes('linkedin.com/company/')) socialLinks.linkedin = href;
        if (!socialLinks.facebook && href.includes('facebook.com/')) socialLinks.facebook = href;
        if (!socialLinks.instagram && href.includes('instagram.com/')) socialLinks.instagram = href;
        if (!socialLinks.twitter && (href.includes('twitter.com/') || href.includes('x.com/'))) socialLinks.twitter = href;
        if (!socialLinks.youtube && href.includes('youtube.com/')) socialLinks.youtube = href;
      });

      // If we found both email and phone, no need to crawl all subpages
      if (foundEmails.size > 0 && foundPhones.size > 0 && subPath !== '/') {
        break;
      }
    } catch {
      // Ignore individual 404s/timeouts on subpaths
    }
  }

  // Validate extracted emails
  const verifiedEmails = [];
  for (const email of Array.from(foundEmails).slice(0, 5)) {
    const val = await validateEmail(email);
    if (val.valid) {
      verifiedEmails.push(val.cleanEmail);
    }
  }

  // Format phones
  const formattedPhones = [];
  for (const phone of Array.from(foundPhones).slice(0, 5)) {
    const val = validatePhone(phone);
    if (val.valid) {
      formattedPhones.push(val.formatted);
    }
  }

  return {
    success: true,
    website: targetUrl,
    primaryEmail: verifiedEmails[0] || Array.from(foundEmails)[0] || null,
    allEmails: verifiedEmails.length > 0 ? verifiedEmails : Array.from(foundEmails),
    primaryPhone: formattedPhones[0] || Array.from(foundPhones)[0] || null,
    allPhones: formattedPhones.length > 0 ? formattedPhones : Array.from(foundPhones),
    socials: socialLinks
  };
}
