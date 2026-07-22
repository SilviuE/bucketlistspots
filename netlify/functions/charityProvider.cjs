// JustGiving API Provider for BucketListSpots Charity Challenges
// Reference: https://developer.justgiving.com/
//
// MOCK_MODE is controlled by env var JUSTGIVING_MOCK_MODE=true (default in dev)
// or when JUSTGIVING_APP_ID is not set.

const MOCK_MODE = !process.env.JUSTGIVING_APP_ID || process.env.JUSTGIVING_MOCK_MODE === 'true';

// ─── Mock Data Store (in-memory for development) ──────────────────────
const mockPages = new Map();
let mockPageCounter = 1000;

// Mock charity data (used when MOCK_MODE is true, or when charity has no JustGiving page)
const MOCK_CHARITIES = {
  '2574196': {
    id: '2574196',
    name: 'African Wildlife Foundation UK',
    description: 'AWF works to ensure that wildlife and wild lands thrive in modern Africa.',
    logoUrl: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=100&h=100&fit=crop',
    websiteUrl: 'https://www.awf.org',
    verified: true,
  },
  'KPAP_DIRECT': {
    id: 'KPAP_DIRECT',
    name: 'Kilimanjaro Porters Assistance Project (KPAP)',
    description: 'KPAP ensures that porters on Mount Kilimanjaro are treated fairly. Donations via PayPal.',
    logoUrl: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=100&h=100&fit=crop',
    websiteUrl: 'https://kiliporters.org/support-our-work-donate/',
    donationUrl: 'https://kiliporters.org/support-our-work-donate/',
    verified: true,
    hasJustGivingPage: false,
  },
};

// ─── Real JustGiving API Implementation ───────────────────────────────
// JustGiving API: https://api.justgiving.com/{appId}/v1/...
function justGivingBaseUrl() {
  const appId = process.env.JUSTGIVING_APP_ID;
  if (!appId) throw new Error('JUSTGIVING_APP_ID not configured');
  return `https://api.justgiving.com/${appId}/v1`;
}

async function justGivingRequest(path, method = 'GET', body = null) {
  const apiKey = process.env.JUSTGIVING_API_KEY;
  if (!apiKey) throw new Error('JUSTGIVING_API_KEY not configured');

  const url = `${justGivingBaseUrl()}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'No response body');
    throw new Error(`JustGiving API ${res.status}: ${errText}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Fetch charity details by JustGiving charity ID.
 * Falls back to mock data for charities without JustGiving pages.
 */
async function getCharity(charityApiId) {
  // If this is a direct-donation charity (no JustGiving page), return mock data
  if (charityApiId === 'KPAP_DIRECT') {
    return MOCK_CHARITIES['KPAP_DIRECT'] || null;
  }

  if (MOCK_MODE) {
    return MOCK_CHARITIES[charityApiId] || null;
  }

  // Real API call
  try {
    const data = await justGivingRequest(`/charity/${charityApiId}`);
    return {
      id: String(data.charityId),
      name: data.name,
      description: data.description || data.shortDescription || '',
      logoUrl: data.logoImageUrl || data.imageUrl || null,
      websiteUrl: data.websiteUrl || null,
      verified: true,
      hasJustGivingPage: true,
    };
  } catch (err) {
    console.error(`[JustGiving] getCharity(${charityApiId}) failed:`, err.message);
    // Fall back to mock if available
    return MOCK_CHARITIES[charityApiId] || null;
  }
}

/**
 * Create a fundraising page on JustGiving.
 * Returns the page URL and metadata needed to display progress.
 */
async function createFundraisingPage({ charityApiId, pageTitle, targetAmount, currency, eventDate, userName }) {
  if (charityApiId === 'KPAP_DIRECT') {
    throw new Error('KPAP does not have JustGiving fundraising pages. Please donate directly at https://kiliporters.org/support-our-work-donate/');
  }

  if (MOCK_MODE) {
    const pageId = `mock_page_${++mockPageCounter}`;
    const shortName = pageTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40);

    const mockPage = {
      pageId,
      pageShortName: shortName,
      pageTitle,
      pageUrl: `https://www.justgiving.com/fundraising/${shortName}`,
      charityId: charityApiId,
      targetAmount,
      currency: currency || 'GBP',
      totalRaised: 0,
      donorCount: 0,
      eventDate,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    mockPages.set(pageId, mockPage);
    console.log('[Mock JustGiving] Created fundraising page:', mockPage.pageUrl);
    return mockPage;
  }

  // Real API: PUT /{appId}/v1/fundraising/pages
  const data = await justGivingRequest('/fundraising/pages', 'PUT', {
    charityId: parseInt(charityApiId, 10),
    pageTitle,
    pageShortName: pageTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) + '-' + Date.now(),
    charityOptIn: true,
    charityFunded: false,
    activityType: 'Trekking',
    eventDate: eventDate || null,
  });

  return {
    pageId: data.pageId,
    pageShortName: data.pageShortName,
    pageTitle: data.pageTitle || pageTitle,
    pageUrl: `https://www.justgiving.com/fundraising/${data.pageShortName}`,
    charityId: charityApiId,
    targetAmount,
    currency: currency || 'GBP',
    totalRaised: 0,
    donorCount: 0,
    eventDate,
    status: 'active',
    signOnUrl: data.signOnUrl || null,
  };
}

/**
 * Fetch fundraising page progress from JustGiving.
 */
async function getFundraisingPage(pageShortName) {
  if (MOCK_MODE) {
    for (const [, page] of mockPages) {
      if (page.pageShortName === pageShortName) return { ...page };
    }
    return null;
  }

  try {
    const data = await justGivingRequest(`/fundraising/pages/${pageShortName}`);
    return {
      pageId: data.pageId,
      pageShortName: data.pageShortName,
      pageTitle: data.pageTitle,
      pageUrl: `https://www.justgiving.com/fundraising/${data.pageShortName}`,
      targetAmount: data.target || data.targetAmount || 0,
      currency: data.currency || 'GBP',
      totalRaised: data.totalRaised || data.raisedAmount || 0,
      donorCount: data.donorCount || data.numberOfDonations || 0,
      eventDate: data.eventDate || null,
      status: data.status || 'active',
    };
  } catch (err) {
    console.error(`[JustGiving] getFundraisingPage(${pageShortName}) failed:`, err.message);
    return null;
  }
}

/**
 * Simulate a donation (mock mode only).
 * In production, JustGiving webhooks handle this.
 */
function simulateDonation(pageShortName, amount, donorName) {
  if (!MOCK_MODE) return null;
  for (const [, page] of mockPages) {
    if (page.pageShortName === pageShortName) {
      page.totalRaised += amount;
      page.donorCount += 1;
      console.log(`[Mock JustGiving] Donation: £${amount} from ${donorName} to "${page.pageTitle}"`);
      return { ...page };
    }
  }
  return null;
}

module.exports = {
  getCharity,
  createFundraisingPage,
  getFundraisingPage,
  simulateDonation,
  MOCK_MODE,
};
