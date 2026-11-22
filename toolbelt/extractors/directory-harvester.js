import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Harvests real business listings (name, website, phone, location) from public business directories.
 * @param {string} query e.g. "roofing contractors"
 * @param {string} location e.g. "Austin, TX"
 * @param {number} [maxResults=25]
 * @returns {Promise<Array<{ name: string, website: string, phone: string, city: string, state: string, category: string }>>}
 */
export async function harvestYellowPages(query, location, maxResults = 25) {
  const formattedQuery = encodeURIComponent(query);
  const formattedLocation = encodeURIComponent(location);
  const url = `https://www.yellowpages.com/search?search_terms=${formattedQuery}&geo_location_terms=${formattedLocation}`;

  const results = [];
  const client = axios.create({
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  try {
    const response = await client.get(url);
    const $ = cheerio.load(response.data);

    $('.result').each((_, el) => {
      if (results.length >= maxResults) return false;

      const name = $(el).find('.business-name span').text().trim();
      const rawWebsite = $(el).find('a.track-visit-website').attr('href');
      const phone = $(el).find('.phone').text().trim();
      const locality = $(el).find('.locality').text().trim();

      // Clean up website url if redirected
      let website = null;
      if (rawWebsite) {
        try {
          const u = new URL(rawWebsite, 'https://www.yellowpages.com');
          // If YellowPages wraps in a redirect, take direct if available
          website = u.searchParams.get('url') || rawWebsite;
        } catch {
          website = rawWebsite;
        }
      }

      const [city, stateZip] = locality.split(',').map(s => s.trim());
      const state = stateZip ? stateZip.split(' ')[0] : 'TX';

      if (name && (website || phone)) {
        results.push({
          name,
          website: website || '',
          phone: phone || '',
          city: city || location.split(',')[0].trim(),
          state: state || 'TX',
          category: query
        });
      }
    });
  } catch (err) {
    console.warn(`[DirectoryHarvester] YellowPages fetch error: ${err.message}`);
  }

  return results;
}
