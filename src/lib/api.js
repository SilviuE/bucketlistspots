import { supabase } from './supabaseClient';

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
  const { data, error } = await supabase.from('guides').select('*').order('featured', { ascending: false, nullsFirst: false }).order('experience', { ascending: false, nullsFirst: false }).order('trading_name', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapGuide);
}

export async function fetchGuideById(id) {
  const { data, error } = await supabase.from('guides').select('*').eq('id', id).single();
  if (error) return null;
  return mapGuide(data);
}

export async function fetchExperiences() {
  const { data, error } = await supabase.from('experiences').select('*');
  if (error) throw error;
  return (data || []).map(mapExperience);
}

export async function fetchDestinations() {
  const { data, error } = await supabase.from('destinations').select('*');
  if (error) throw error;
  return (data || []).map(mapDestination);
}
