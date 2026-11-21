import { useState } from 'react';
import { TextField, MenuItem, Box, Typography, Paper } from '@mui/material';
import PublicIcon from '@mui/icons-material/Public';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import PaymentsIcon from '@mui/icons-material/Payments';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import HandshakeIcon from '@mui/icons-material/Handshake';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SEO from '../components/SEO';
import FAQAccordion from '../components/shared/FAQAccordion';
import {
  LandingHero, ProofStrip, Section, BenefitGrid, Steps, CheckList, LeadForm, FullWidth,
  LegalFooterNote, postJson, NAVY, TEAL,
} from '../components/landing/LandingKit';
import { getAttribution, attributionLabel } from '../lib/trust';

const COUNTRIES = ['Tanzania', 'Kenya', 'Uganda', 'Rwanda', 'Nepal', 'Peru', 'Romania', 'Morocco', 'Other'];
const YEARS = [['1', '1–2 years'], ['3', '3–5 years'], ['5', '5–10 years'], ['10', '10–15 years'], ['15', '15+ years']];
const ROLES = ['Licensed tour operator (company)', 'Independent mountain / trekking guide', 'Safari guide', 'Other'];

const benefits = [
  { icon: PublicIcon, title: 'International travellers', desc: 'We market Kilimanjaro and Tanzania to UK and European travellers who want to book directly with a local operator.' },
  { icon: PaymentsIcon, title: 'You keep at least 80%', desc: 'Our fee is capped at 20% of the trip price, and only on bookings we bring you. No hidden mark-ups on your prices.' },
  { icon: VerifiedUserIcon, title: 'A badge that means something', desc: 'Our Trust Gate checks your documents properly. Travellers see exactly what was verified, which helps you win their trust.' },
  { icon: PhotoCameraIcon, title: 'A professional profile, done for you', desc: 'Send us your photos, routes and prices on WhatsApp. We write and publish your profile in English.' },
  { icon: HandshakeIcon, title: 'Your brand, your clients', desc: 'Your company name is shown on every trip. Travellers know who operates their climb, and you build your own reputation.' },
  { icon: TrendingUpIcon, title: 'Grow your business', desc: 'Founding partners get practical support with pricing, quotes, customer communication and online reviews.' },
];

const steps = [
  { title: 'Apply in 3 minutes', desc: 'Fill in the short form below. No fee, no obligation.' },
  { title: 'WhatsApp call (15 min)', desc: 'We get to know you, your routes and how you work.' },
  { title: 'Trust Gate document check', desc: 'Company registration, licences (e.g. TALA / KINAPA), insurance, safety equipment and crew-pay practices.' },
  { title: 'Profile goes live', desc: 'We publish your profile, routes and prices, and send you travellers who want a quote.' },
];

const faqs = [
  { question: 'How much does it cost to join?', answer: 'Nothing. There is no listing or membership fee for Founding Partners. You only pay a commission (capped at 20% of the trip price) on confirmed bookings that come through BucketListSpots. The exact terms are agreed in a written partner agreement before your profile goes live.' },
  { question: 'Who operates the trip and receives the payment?', answer: 'You do. Your company is the operator of the trip and holds the contract with the traveller. BucketListSpots acts as a disclosed booking agent and never resells your trips under its own brand.' },
  { question: 'Which documents do you check?', answer: 'Identity, company registration, the licences required for your activity (for Kilimanjaro, e.g. TALA and KINAPA), insurance, safety and emergency procedures (oxygen, first aid, evacuation), and how you pay porters and crew. If something is missing, we tell you exactly what and help you plan the next steps.' },
  { question: 'I am an independent guide without an operator licence. Can I apply?', answer: 'Yes. We can include you in our guide development programme and, where appropriate, connect you with a verified licensed operator. A verified guide profile alone does not allow you to sell expeditions independently.' },
  { question: 'Which destinations are you accepting now?', answer: 'Kilimanjaro, Tanzanian safaris and Zanzibar first. We are also building a waiting list for Kenya, Uganda, Nepal, Peru, Romania and Morocco.' },
];

export default function LandingGuides() {
  const attribution = getAttribution();
  const [f, setF] = useState({ fullName: '', businessName: '', email: '', phone: '', country: 'Tanzania', role: '', experience: '', languages: '', specialties: '', licences: '', website: '' });
  const up = k => e => setF(prev => ({ ...prev, [k]: e.target.value }));

  const submit = ({ faxNumber }) => postJson('/api/apply-guide', {
    faxNumber,
    fullName: f.fullName,
    email: f.email,
    phone: f.phone,
    country: f.country,
    experience: f.experience,
    languages: f.languages,
    specialties: f.specialties,
    message: [
      f.businessName && `Business: ${f.businessName}`,
      f.role && `Role: ${f.role}`,
      f.licences && `Licences: ${f.licences}`,
      f.website && `Web/social: ${f.website}`,
    ].filter(Boolean).join('\n'),
    heardFrom: ['Landing /join/guides', attributionLabel(attribution)].filter(Boolean).join(' · '),
    referredByAmbassadorCode: attribution.ref || undefined,
  });

  return (
    <Box>
      <SEO
        title="Become a Founding Local Partner"
        description="Local Kilimanjaro and Tanzania operators: get international travellers, keep at least 80% of the trip price and get a free professional profile. Apply in 3 minutes."
        path="/join/guides"
        ogImage="https://bucketlistspots.com/images/team-group.jpg"
      />

      <LandingHero
        eyebrow="Founding Local Partners · Kilimanjaro & Tanzania"
        title="Your mountain. Your business."
        highlight="Our travellers."
        subtitle="BucketListSpots connects local adventure operators directly with international travellers. Joining is free, we build your profile for you, and you keep at least 80% of every trip we bring you."
        image="/images/team-group.jpg"
        ctaLabel="Apply as a Founding Partner"
        secondary={<Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>Free · 3 minutes · No obligation</Typography>}
      />

      <ProofStrip items={[
        { value: '£0', label: 'to join' },
        { value: '≥ 80%', label: 'of the trip price to you' },
        { value: '≤ 20%', label: 'fee, only on bookings we bring' },
        { value: 'UK Ltd', label: 'Company No. 16595661' },
      ]} />

      <Section title="Why local operators join BucketListSpots" intro="Many international agencies keep a large share of what the traveller pays. We do the opposite: you set your price, your name is on the trip, and our fee is capped and disclosed.">
        <BenefitGrid items={benefits} />
      </Section>

      <Section tone="sand" title="The old way vs. the BucketListSpots way">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid rgba(16,42,67,0.1)' }}>
            <Typography sx={{ fontWeight: 800, color: 'text.secondary', mb: 1.5 }}>Typical agency model</Typography>
            <CheckList items={[
              'Your trip is resold under someone else’s brand',
              'The traveller never learns who really runs the climb',
              'Your reviews build the agency’s reputation, not yours',
              'Prices and margins are hidden',
            ]} />
          </Paper>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: `2px solid ${TEAL}` }}>
            <Typography sx={{ fontWeight: 800, color: TEAL, mb: 1.5 }}>BucketListSpots</Typography>
            <CheckList items={[
              'Your company is named as the operator on every trip',
              'You receive at least 80% of the trip price',
              'Reviews and reputation belong to you',
              'Our fee is capped, disclosed and only charged on bookings we bring you',
            ]} />
          </Paper>
        </Box>
      </Section>

      <Section title="How it works">
        <Steps steps={steps} />
      </Section>

      <Section tone="navy" title="Who we are looking for" intro="We are selecting a small group of Founding Partners. We prefer a few excellent operators to hundreds of profiles.">
        <CheckList dark items={[
          'Licensed operators (or experienced guides working with a licensed operator)',
          'Kilimanjaro, Tanzanian safari or Zanzibar experience',
          'Good English, or a team member who handles communication',
          'Fair pay and decent equipment for porters and crew (KPAP standards or equivalent)',
          'Proper safety: oxygen, first aid, evacuation plan',
          'Willing to answer traveller enquiries within 24 hours',
        ]} />
      </Section>

      <Section id="apply-section" title="Apply as a Founding Partner" intro="We reply on WhatsApp or email within 3 working days.">
        <LeadForm
          title="Founding Partner application"
          subtitle="Takes about 3 minutes. Fields marked * are required."
          submitLabel="Send my application"
          successTitle="Asante! Application received."
          successText="We will contact you on WhatsApp or email within 3 working days to arrange a short call."
          onSubmit={submit}
          canSubmit={!!(f.fullName && f.email && f.phone && f.country)}
        >
          <TextField label="Your full name" value={f.fullName} onChange={up('fullName')} required fullWidth />
          <TextField label="Company / trading name" value={f.businessName} onChange={up('businessName')} fullWidth />
          <TextField label="Email" type="email" value={f.email} onChange={up('email')} required fullWidth />
          <TextField label="WhatsApp number" value={f.phone} onChange={up('phone')} required fullWidth placeholder="+255…" />
          <TextField select label="Country" value={f.country} onChange={up('country')} required fullWidth>
            {COUNTRIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </TextField>
          <TextField select label="You are…" value={f.role} onChange={up('role')} fullWidth>
            {ROLES.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </TextField>
          <TextField select label="Guiding experience" value={f.experience} onChange={up('experience')} fullWidth>
            {YEARS.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
          </TextField>
          <TextField label="Languages" value={f.languages} onChange={up('languages')} fullWidth placeholder="English, Swahili…" />
          <FullWidth><TextField label="Routes / experiences you offer" value={f.specialties} onChange={up('specialties')} fullWidth placeholder="Machame 7d, Lemosho 8d, Serengeti safari…" /></FullWidth>
          <FullWidth><TextField label="Licences you hold" value={f.licences} onChange={up('licences')} fullWidth placeholder="TALA, KINAPA guide licence, Wilderness First Responder…" /></FullWidth>
          <FullWidth><TextField label="Website or social media" value={f.website} onChange={up('website')} fullWidth placeholder="https://… or @instagram" /></FullWidth>
        </LeadForm>
      </Section>

      <Section tone="white">
        <FAQAccordion title="Questions from operators" faqs={faqs} />
        <Typography sx={{ mt: 3, fontSize: 14, color: NAVY }}>
          Prefer to talk first? Email <a href="mailto:hello@bucketlistspots.com">hello@bucketlistspots.com</a>.
        </Typography>
      </Section>

      <LegalFooterNote />
    </Box>
  );
}
