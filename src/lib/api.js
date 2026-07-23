import { supabase } from './supabaseClient';

// SECURITY: All public queries use explicit column lists.
// NEVER use select('*') — it exposes internal fields like user_id,
// referral_code, bls_points_balance, referred_by_ambassador_id.

const PUBLIC_GUIDE_COLUMNS = [
  'id', 'name', 'trading_name', 'status', 'photo', 'hero_image',
  'bio', 'why_independent', 'location', 'languages', 'experience',
  'certifications', 'promise', 'badge', 'tagline', 'routes',
  'price', 'price_currency', 'featured', 'review_count', 'trips_led',
  'video_intro', 'tripadvisor_embed',
  'identity_verified', 'license_verified', 'safety_verified', 'fair_pay_verified',
  'created_at', 'updated_at',
].join(', ');

const PUBLIC_EXPERIENCE_COLUMNS = [
  'id', 'title', 'duration', 'difficulty', 'location', 'image',
  'price', 'currency', 'guide_id', 'badge', 'rating', 'reviews', 'featured',
].join(', ');

const PUBLIC_DESTINATION_COLUMNS = [
  'name', 'country', 'image', 'guide_count',
].join(', ');

function mapGuide(g) {
  if (!g) return null;
  return {
    ...g,
    tradingName: g.trading_name,
    heroImage: g.hero_image,
    reviewCount: g.review_count,
    agencyPrice: g.agency_price,
    priceCurrency: g.price_currency,
    tripsLed: g.trips_led,
    videoIntro: g.video_intro,
    tripAdvisorEmbed: g.tripadvisor_embed,
    identityVerified: g.identity_verified,
    licenseVerified: g.license_verified,
    safetyVerified: g.safety_verified,
    fairPayVerified: g.fair_pay_verified,
    whyIndependent: g.why_independent,
  };
}

function mapExperience(e) {
  if (!e) return null;
  return { ...e, guideId: e.guide_id };
}

function mapDestination(d) {
  if (!d) return null;
  return { ...d, guideCount: d.guide_count };
}

export async function fetchGuides() {
  const { data, error } = await supabase.from('guides')
    .select(PUBLIC_GUIDE_COLUMNS)
    .eq('status', 'published')
    .order('featured', { ascending: false, nullsFirst: false })
    .order('experience', { ascending: false, nullsFirst: false })
    .order('trading_name', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapGuide);
}

export async function fetchGuideById(id) {
  const { data, error } = await supabase.from('guides')
    .select(PUBLIC_GUIDE_COLUMNS)
    .eq('id', id)
    .single();
  if (error) return null;
  return mapGuide(data);
}

export async function fetchExperiences() {
  const { data, error } = await supabase.from('experiences').select(PUBLIC_EXPERIENCE_COLUMNS);
  if (error) throw error;
  return (data || []).map(mapExperience);
}

export async function fetchDestinations() {
  const { data, error } = await supabase.from('destinations').select(PUBLIC_DESTINATION_COLUMNS);
  if (error) throw error;
  return (data || []).map(mapDestination);
}
