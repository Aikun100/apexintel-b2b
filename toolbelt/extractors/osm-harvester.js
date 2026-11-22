import axios from 'axios';

/**
 * Queries OpenStreetMap Overpass API for craft businesses (roofers, contractors, electricians, solar) in a specific city/area.
 * 100% open data, zero rate-limit blocks, no API keys required.
 */
export async function harvestFromOverpass(craftType = 'roofer', cityName = 'Austin') {
  const query = `
    [out:json][timeout:25];
    area["name"="${cityName}"]["admin_level"~"[6-8]"]->.searchArea;
    (
      node["craft"="${craftType}"](area.searchArea);
      way["craft"="${craftType}"](area.searchArea);
      node["office"="contractor"](area.searchArea);
      way["office"="contractor"](area.searchArea);
    );
    out center;
  `;

  try {
    const response = await axios.post('https://overpass-api.de/api/interpreter', `data=${encodeURIComponent(query)}`, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'B2BIntelligenceHarvest/1.0'
      },
      timeout: 20000
    });

    const elements = response.data?.elements || [];
    const businesses = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name;
      if (!name) continue;

      const website = tags.website || tags['contact:website'] || null;
      const phone = tags.phone || tags['contact:phone'] || null;
      const city = tags['addr:city'] || cityName;
      const state = tags['addr:state'] || 'TX';

      businesses.push({
        name,
        website: website || '',
        phone: phone || '',
        city,
        state,
        category: craftType === 'roofer' ? 'Roofing & Exterior' : craftType
      });
    }

    return businesses;
  } catch (err) {
    console.warn(`[Overpass] query failed: ${err.message}`);
    return [];
  }
}
