import { useState } from 'react';
import { TextField, MenuItem, Box, Typography, Paper } from '@mui/material';
import PaymentsIcon from '@mui/icons-material/Payments';
import LinkIcon from '@mui/icons-material/Link';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import TerrainIcon from '@mui/icons-material/Terrain';
import SEO from '../components/SEO';
import FAQAccordion from '../components/shared/FAQAccordion';
import {
  LandingHero, ProofStrip, Section, BenefitGrid, Steps, CheckList, LeadForm, FullWidth,
  LegalFooterNote, postJson, TEAL,
} from '../components/landing/LandingKit';
import { getAttribution, attributionLabel } from '../lib/trust';

// ── Commercial terms (single source on this page; change here only) ──
// Founder decision pending: £75–£100 per confirmed booking (Action Plan GOV-013 §5, Faza 3).
const REWARD_PER_BOOKING = '£75';

const WHO = [
  { value: 'Past climber / traveller', label: 'I have climbed Kilimanjaro or done a big trek' },
  { value: 'Content creator', label: 'I create travel / outdoor content' },
  { value: 'Club / charity / university group', label: 'I lead a club, charity or student group' },
  { value: 'Other', label: 'Other' },
];
const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Blog / website', 'Facebook group', 'Strava / club', 'Word of mouth only', 'Other'];

const benefits = [
  { icon: PaymentsIcon, title: `${REWARD_PER_BOOKING} per confirmed booking`, desc: 'Paid for every traveller who books a trip through your personal link or code, once they have paid the operator.' },
  { icon: LinkIcon, title: 'Your own link and code', desc: 'Share it in your bio, stories, blog, club newsletter or WhatsApp groups. Every enquiry is tracked back to you.' },
  { icon: VerifiedUserIcon, title: 'Recommend with confidence', desc: 'You only send people to operators who passed our Trust Gate checks, with transparent prices and fair crew pay.' },
  { icon: VolunteerActivismIcon, title: 'Charity climbs welcome', desc: 'Leading a group climb for a cause? We help organise the trip with a verified local operator, and your group raises funds through JustGiving.' },
  { icon: CameraAltIcon, title: 'Get featured', desc: 'Founding Ambassadors get a profile on BucketListSpots with their story and social links.' },
  { icon: TerrainIcon, title: 'Help local operators', desc: 'Every booking you bring means more of the money stays with local guides, porters and their families.' },
];

const steps = [
  { title: 'Apply (2 minutes)', desc: 'Tell us who you are and where your audience or community is.' },
  { title: 'Get your link and code', desc: 'Once approved, you receive a personal link (bucketlistspots.com/kilimanjaro?ref=YOURCODE) and a short starter pack.' },
  { title: 'Share honestly', desc: 'Talk about your experience in your own words, and always label it as a partnership (#ad / #partner).' },
  { title: 'Get paid', desc: `When a traveller you referred completes their booking and pays the operator, you receive ${REWARD_PER_BOOKING}.` },
];

const faqs = [
  { question: 'When do I get paid?', answer: `You receive ${REWARD_PER_BOOKING} for each confirmed booking made through your link or code, after the traveller has paid the operator. We pay by bank transfer each month. Full terms are in the Ambassador Programme Terms you receive on approval.` },
  { question: 'Do I need a big following?', answer: 'No. Past climbers, club leaders and small, engaged communities often send the best-quality travellers. What matters most is trust, not follower count.' },
  { question: 'Is there a time limit?', answer: 'The commission applies to qualifying bookings while you are an active ambassador, under the programme terms. We do not promise “lifetime” payouts. We keep the terms clear and fair.' },
  { question: 'What do I have to disclose?', answer: 'UK advertising rules (ASA/CMA) require you to label referral content clearly, for example with #ad. We give you simple examples in the starter pack.' },
  { question: 'Can I refer local guides too?', answer: 'Yes. If you know an excellent local operator, send them to bucketlistspots.com/join/guides with your code. We will tell you when they pass the Trust Gate.' },
];

export default function LandingAmbassadors() {
  const attribution = getAttribution();
  const [f, setF] = useState({ fullName: '', email: '', phone: '', country: '', who: '', platform: '', handle: '', followers: '', whyYou: '' });
  const up = k => e => setF(prev => ({ ...prev, [k]: e.target.value }));

  const submit = ({ faxNumber }) => postJson('/api/apply-ambassador', {
    faxNumber,
    fullName: f.fullName,
    email: f.email,
    phone: f.phone,
    country: f.country,
    platform: f.platform,
    handle: f.handle || 'n/a',
    followers: f.followers,
    niche: f.who,
    whyYou: f.whyYou,
    heardFrom: ['Landing /join/ambassadors', attributionLabel(attribution)].filter(Boolean).join(' · '),
  });

  return (
    <Box>
      <SEO
        title="Become a Founding Ambassador"
        description={`Climbed Kilimanjaro, create travel content or lead a club? Recommend verified local operators and earn ${REWARD_PER_BOOKING} per confirmed booking. Apply in 2 minutes.`}
        path="/join/ambassadors"
        ogImage="https://bucketlistspots.com/images/summit-celebration.jpg"
      />

      <LandingHero
        eyebrow="Founding Ambassadors · limited first cohort"
        title="Your story got you to the top."
        highlight="Now it can help others get there."
        subtitle={`Recommend trusted local Kilimanjaro operators to your friends, followers or club. You earn ${REWARD_PER_BOOKING} for every confirmed booking, and more of their money stays with local guides and porters.`}
        image="/images/summit-celebration.jpg"
        ctaLabel="Become a Founding Ambassador"
        secondary={<Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>Free · 2 minutes · No minimum audience</Typography>}
      />

      <ProofStrip items={[
        { value: REWARD_PER_BOOKING, label: 'per confirmed booking' },
        { value: '£0', label: 'to join' },
        { value: 'Verified', label: 'local operators only' },
        { value: '≥ 80%', label: 'of trip price stays local' },
      ]} />

      <Section title="Why become an ambassador">
        <BenefitGrid items={benefits} />
      </Section>

      <Section tone="sand" title="Who it is for">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
          {[
            { t: 'Past climbers', d: 'Friends and colleagues already ask you how you did it. Now you can point them to a trusted local operator.' },
            { t: 'Travel & outdoor creators', d: 'Your audience asks “who was your guide?”. Give them a verified answer and earn from your recommendations.' },
            { t: 'Clubs, charities & student groups', d: 'Organise a Kilimanjaro challenge for your group or cause, with a verified local operator and transparent pricing.' },
          ].map(x => (
            <Paper key={x.t} elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid rgba(16,42,67,0.1)' }}>
              <Typography sx={{ fontWeight: 800, color: TEAL, mb: 0.5 }}>{x.t}</Typography>
              <Typography sx={{ fontSize: 14, color: 'text.secondary', lineHeight: 1.55 }}>{x.d}</Typography>
            </Paper>
          ))}
        </Box>
      </Section>

      <Section title="How it works">
        <Steps steps={steps} />
      </Section>

      <Section tone="navy" title="Our promise to ambassadors">
        <CheckList dark items={[
          'We only list operators who passed our Trust Gate checks',
          'Clear, written programme terms: no vague “lifetime” promises',
          'Transparent tracking: we tell you about every enquiry linked to your code',
          'You are never asked to post anything you don’t believe in',
        ]} />
      </Section>

      <Section title="Apply as a Founding Ambassador" intro="We review applications personally and reply within 3 working days.">
        <LeadForm
          title="Ambassador application"
          subtitle="Fields marked * are required."
          submitLabel="Send my application"
          successTitle="Thank you, application received!"
          successText="We will email you within 3 working days with your next steps and personal referral code."
          onSubmit={submit}
          canSubmit={!!(f.fullName && f.email && f.platform)}
        >
          <TextField label="Full name" value={f.fullName} onChange={up('fullName')} required fullWidth />
          <TextField label="Email" type="email" value={f.email} onChange={up('email')} required fullWidth />
          <TextField label="Phone / WhatsApp" value={f.phone} onChange={up('phone')} fullWidth placeholder="+44…" />
          <TextField label="Country" value={f.country} onChange={up('country')} fullWidth />
          <FullWidth>
            <TextField select label="Which describes you best?" value={f.who} onChange={up('who')} fullWidth>
              {WHO.map(w => <MenuItem key={w.value} value={w.value}>{w.label}</MenuItem>)}
            </TextField>
          </FullWidth>
          <TextField select label="Where do you share?" value={f.platform} onChange={up('platform')} required fullWidth>
            {PLATFORMS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </TextField>
          <TextField label="Handle / link (if any)" value={f.handle} onChange={up('handle')} fullWidth placeholder="@yourhandle or URL" />
          <TextField label="Approx. audience / group size" type="number" value={f.followers} onChange={up('followers')} fullWidth inputProps={{ min: 0 }} />
          <FullWidth><TextField label="Your adventure story, or why you want to join" value={f.whyYou} onChange={up('whyYou')} fullWidth multiline rows={3} /></FullWidth>
        </LeadForm>
      </Section>

      <Section tone="white">
        <FAQAccordion title="Ambassador FAQ" faqs={faqs} />
      </Section>

      <LegalFooterNote />
    </Box>
  );
}
