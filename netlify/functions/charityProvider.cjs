// JustGiving API Mock Provider for BucketListSpots Charity Challenges
// When real API keys are available, replace mock functions with actual JustGiving API calls.
// Reference: https://developer.justgiving.com/

const MOCK_MODE = true; // Set to false when real JustGiving API keys are configured

// ─── Mock Data Store (in-memory for development) ──────────────────────
const mockPages = new Map();
let mockPageCounter = 1000;

// ─── Real JustGiving API Implementation (placeholder) ─────────────────
const JUSTGIVING_API_BASE = 'https://api.justgiving.com/v1';

async function justGivingRequest(path, method = 'GET', body = null) {
  const apiKey = process.env.JUSTGIVING_API_KEY;
  const appId = process.env.JUSTGIVING_APP_ID;
  if (!apiKey || !appId) throw new Error('JustGiving API credentials not configured');

  const res = await fetch(`${JUSTGIVING_API_BASE}${path}`, {
    method,
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`JustGiving API error ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Fetch charity details by JustGiving charity ID.
 * Used when displaying charities to users.
 */
async function getCharity(charityApiId) {
  if (MOCK_MODE) {
    // Return mock charity data
    const charities = {
      'JUSTGIVING_KPAP_ID': {
        id: 'JUSTGIVING_KPAP_ID',
        name: 'Kilimanjaro Porters Assistance Project (KPAP)',
        description: 'KPAP ensures that porters on Mount Kilimanjaro are treated fairly.',
        logoUrl: 'https://images.unsplash.com/photo-1516426122078-c23e76319801?w=100&h=100&fit=crop',
        websiteUrl: 'https://www.kilimanjaroporters.org',
        verified: true,
      },
      'JUSTGIVING_AWF_ID': {
        id: 'JUSTGIVING_AWF_ID',
        name: 'African Wildlife Foundation',
        description: 'AWF works to ensure that wildlife and wild lands thrive in modern Africa.',
        logoUrl: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=100&h=100&fit=crop',
        websiteUrl: 'https://www.africanwildlife.org',
        verified: true,
      },
    };
    return charities[charityApiId] || null;
  }

  // Real API call
  const data = await justGivingRequest(`/charity/${charityApiId}`);
  return {
    id: data.charityId,
    name: data.name,
    description: data.description,
    logoUrl: data.logoUrl,
    websiteUrl: data.websiteUrl,
    verified: data.verified || false,
  };
}

/**
 * Create a fundraising page on JustGiving.
 * Returns the page URL and metadata needed to display progress.
 */
async function createFundraisingPage({ charityApiId, pageTitle, targetAmount, currency, eventDate, userName }) {
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

  // Real API call
  const data = await justGivingRequest('/fundraising/pages', 'POST', {
    charityId: charityApiId,
    pageTitle,
    targetAmount,
    currency: currency || 'GBP',
    eventDate,
  });

  return {
    pageId: data.pageId,
    pageShortName: data.pageShortName,
    pageTitle: data.pageTitle,
    pageUrl: `https://www.justgiving.com/fundraising/${data.pageShortName}`,
    charityId: charityApiId,
    targetAmount,
    currency: currency || 'GBP',
    totalRaised: 0,
    donorCount: 0,
    eventDate,
    status: 'active',
  };
}

/**
 * Fetch fundraising page progress from JustGiving.
 * Called when displaying a user's fundraising dashboard.
 */
async function getFundraisingPage(pageShortName) {
  if (MOCK_MODE) {
    // Find mock page by short name
    for (const [, page] of mockPages) {
      if (page.pageShortName === pageShortName) {
        return page;
      }
    }
    return null;
  }

  // Real API call
  const data = await justGivingRequest(`/fundraising/pages/${pageShortName}`);
  return {
    pageId: data.pageId,
    pageShortName: data.pageShortName,
    pageTitle: data.pageTitle,
    pageUrl: `https://www.justgiving.com/fundraising/${data.pageShortName}`,
    targetAmount: data.targetAmount,
    currency: data.currency,
    totalRaised: data.totalRaised,
    donorCount: data.donorCount,
    eventDate: data.eventDate,
    status: data.status,
  };
}

/**
 * Simulate a donation (mock mode only) for testing.
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
