import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TextField, MenuItem, Box, Typography, Paper, Chip, Avatar, Button, Checkbox, FormControlLabel,
} from '@mui/material';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import PriceCheckIcon from '@mui/icons-material/PriceCheck';
import GroupsIcon from '@mui/icons-material/Groups';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import SEO from '../components/SEO';
import FAQAccordion from '../components/shared/FAQAccordion';
import {
  LandingHero, ProofStrip, Section, BenefitGrid, Steps, CheckList, LeadForm, FullWidth,
  LegalFooterNote, postJson, NAVY, TEAL,
} from '../components/landing/LandingKit';
import { fetchGuides } from '../lib/api';
import { formatGuidePrice, getStoredCurrency } from '../lib/currency';
import { getAttribution, isTrustVerified, toArray } from '../lib/trust';

// Route facts: KilimanjaroJoy route sheets & _Routes table (typical published success-rate ranges).
const ROUTES = [
  { key: 'Machame', days: '6–7 days', success: '~80–90% (7-day)', level: 'Challenging · scenic, popular', match: /machame/i },
  { key: 'Lemosho', days: '7–8 days', success: '~85–90%+', level: 'Challenging · great acclimatisation', match: /lemosho/i },
  { key: 'Rongai', days: '6–7 days', success: '~75–80%', level: 'Moderate · quieter, drier north side', match: /rongai/i },
  { key: 'Marangu', days: '5–6 days', success: '~60–75%', level: 'Moderate · huts instead of tents', match: /marangu(?!.*waterfall)/i },
  { key: 'Northern Circuit', days: '8–9 days', success: '~90–95%', level: 'Long · best acclimatisation', match: /northern circuit/i },
  { key: 'Umbwe', days: '6 days', success: '~50–70%', level: 'Very steep · experienced trekkers', match: /umbwe/i },
];

const MONTHS = ['January', 'February', 'March', 'June', 'July', 'August', 'September', 'October', 'December', 'Flexible / not sure'];
const BUDGETS = ['Under $2,000 pp', '$2,000–$2,500 pp', '$2,500–$3,500 pp', '$3,500+ pp', 'Not sure yet'];

const benefits = [
  { icon: VerifiedUserIcon, title: 'Verified local operators', desc: 'Before an operator is marked Verified, we check identity, company registration, licences, insurance, safety equipment and crew-pay practices.' },
  { icon: PriceCheckIcon, title: 'Transparent prices', desc: 'Park fees, crew, meals and equipment are spelled out in your quote, and at least 80% of the trip price goes to the local operator.' },
  { icon: GroupsIcon, title: 'Fair to porters', desc: 'We only work with operators who commit to fair pay, proper loads and good equipment for porters and crew (KPAP standards or equivalent).' },
  { icon: HealthAndSafetyIcon, title: 'Safety first', desc: 'Emergency oxygen, first-aid-trained guides and an evacuation plan are part of our Trust Gate requirements.' },
  { icon: SupportAgentIcon, title: 'A real person, in English', desc: 'We help you choose the route, compare quotes and prepare: training plan, kit list, visas and vaccinations.' },
  { icon: VolunteerActivismIcon, title: 'Climb for a cause', desc: 'Turn your climb into a fundraising challenge for a charity of your choice, through your own JustGiving page.' },
];

const steps = [
  { title: 'Tell us your plans', desc: 'Dates, group size, route preference and budget. It takes 2 minutes and costs nothing.' },
  { title: 'Get a written quote within 48h', desc: 'From a named local operator, with exactly what is included and excluded.' },
  { title: 'Ask anything', desc: 'Chat with us and the operator about routes, training, kit and safety. No pressure.' },
  { title: 'Book when you are ready', desc: 'You confirm directly with the operator under their written booking terms.' },
];

const included = ['National park, camping & rescue fees', 'Professional mountain guides, cook and porters', 'All meals and drinking water on the mountain', 'Quality tents, dining tent and emergency oxygen', 'Airport transfers (on request)', 'Summit certificate'];
const excluded = ['International flights', 'Visa and vaccinations', 'Travel insurance (high-altitude cover required)', 'Tips for guides, cooks and porters', 'Personal gear (rental available)'];

const faqs = [
  { question: 'Do I pay anything when I request a quote?', answer: 'No. A quote is free and without obligation. You only pay when you decide to book, under the operator’s written booking and cancellation terms, which you see before paying.' },
  { question: 'Who will I travel with?', answer: 'With the local operator named on your quote. BucketListSpots Ltd is a UK company acting as a disclosed booking agent. We help you find and compare trusted local operators, and the operator runs your climb.' },
  { question: 'How fit do I need to be?', answer: 'Kilimanjaro is a non-technical trek, but it is long and at high altitude. Most healthy people can prepare in 8–12 weeks. After your enquiry we send you our free training plan.' },
  { question: 'Which route should I choose?', answer: 'For first-timers we usually suggest a 7-day or longer route (Machame 7d, Lemosho 8d or Rongai 7d): more days mean better acclimatisation and a higher summit chance. Tell us your preferences and we will recommend one.' },
  { question: 'When is the best time to climb?', answer: 'The main dry seasons are January–early March and June–October. December is also popular. April–May is the long rainy season.' },
  { question: 'Can we climb as a group or for charity?', answer: 'Yes. Private and group climbs (friends, colleagues, clubs, students, charity challenges) are welcome. Tick “charity climb” on the form and we will help with the details.' },
];

export default function LandingTravellers() {
  const navigate = useNavigate();
  const currency = getStoredCurrency();
  const attribution = getAttribution();
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const [operators, setOperators] = useState([]);
  const [f, setF] = useState({
    fullName: '', email: '', whatsapp: '', country: '', route: params.get('route') || '', guideId: params.get('guide') || '',
    travelMonth: '', groupSize: '2', budget: '', charityClimb: false, message: '',
  });
  const up = k => e => setF(prev => ({ ...prev, [k]: e.target.value }));

  useEffect(() => {
    fetchGuides()
      .then(gs => setOperators(gs.filter(g => /tanzania|moshi|arusha/i.test(g.location || ''))))
      .catch(() => setOperators([]));
  }, []);

  useEffect(() => {
    if (window.location.hash === '#quote') {
      setTimeout(() => document.getElementById('quote')?.scrollIntoView({ behavior: 'smooth' }), 300);
    }
  }, []);

  // Lowest published price per route across real, published operators.
  const routePrices = useMemo(() => {
    const out = {};
    for (const r of ROUTES) {
      const prices = operators.flatMap(g => toArray(g.routes))
        .filter(x => r.match.test(x?.name || '') && Number(x?.price) >= 500)
        .map(x => Number(x.price));
      out[r.key] = prices.length ? Math.min(...prices) : null;
    }
    return out;
  }, [operators]);

  const submit = ({ faxNumber, consentGiven }) => postJson('/api/enquiry', {
    ...f, faxNumber, consentGiven, ...attribution,
  });

  const pickRoute = (key) => {
    setF(prev => ({ ...prev, route: key }));
    document.getElementById('quote')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Box>
      <SEO
        title="Climb Kilimanjaro with a verified local operator"
        description="Climb Kilimanjaro with a verified local operator from Moshi. Transparent prices, fair porter pay and real safety standards. Free written quote within 48 hours."
        path="/kilimanjaro"
        ogImage="https://bucketlistspots.com/images/uhuru-peak.jpg"
      />

      <LandingHero
        eyebrow="Kilimanjaro · 5,895 m · Tanzania"
        title="Climb Kilimanjaro with the people"
        highlight="who live beneath it."
        subtitle="Book directly with verified local operators from Moshi. Transparent prices, fair pay for porters, safety you can check. Get a free written quote within 48 hours."
        image="/images/uhuru-peak.jpg"
        ctaLabel="Get my free quote"
        ctaHref="#quote"
        secondary={<Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>No payment · No obligation · Reply within 48h</Typography>}
      />

      <ProofStrip items={[
        { value: '≥ 80%', label: 'of your trip price stays local' },
        { value: '48h', label: 'written quote' },
        { value: '£0', label: 'to ask for a quote' },
        { value: 'UK Ltd', label: 'Company No. 16595661' },
      ]} />

      <Section title="Why climb with BucketListSpots" intro="Many international agencies subcontract your climb to a local crew you never meet. We put you in direct contact with the local operator, and show you exactly who they are and what we checked.">
        <BenefitGrid items={benefits} />
      </Section>

      <Section tone="sand" title="Choose your route" intro="Prices are “from” prices per person published by our local partners, including park fees. Your final price depends on dates, group size and options.">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
          {ROUTES.map(r => (
            <Paper key={r.key} elevation={0} sx={{ p: 2.5, borderRadius: 3, border: f.route === r.key ? `2px solid ${TEAL}` : '1px solid rgba(16,42,67,0.1)', display: 'flex', flexDirection: 'column' }}>
              <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: 18 }}>{r.key}</Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 1 }}>{r.days} · {r.level}</Typography>
              <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Typical summit success: {r.success}</Typography>
              <Box sx={{ flex: 1 }} />
              <Typography sx={{ mt: 1.5, fontWeight: 800, color: NAVY }}>
                {routePrices[r.key] ? <>from {formatGuidePrice(routePrices[r.key], currency)} <Typography component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>/ person</Typography></> : 'Price on request'}
              </Typography>
              <Button variant="outlined" size="small" sx={{ mt: 1.5 }} onClick={() => pickRoute(r.key)}>Quote for {r.key}</Button>
            </Paper>
          ))}
        </Box>
        <Typography sx={{ mt: 2, fontSize: 12, color: 'text.secondary' }}>Success rates are typical published industry ranges, not guarantees. Altitude affects everyone differently.</Typography>
      </Section>

      {operators.length > 0 && (
        <Section title="Meet our local partners">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {operators.map(g => (
              <Paper key={g.id} elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid rgba(16,42,67,0.1)', display: 'flex', gap: 2, alignItems: 'center' }}>
                <Avatar src={g.photo} alt={g.name} sx={{ width: 64, height: 64 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, color: NAVY }}>{g.name}</Typography>
                  <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{g.tradingName} · {g.location}</Typography>
                  <Chip size="small" sx={{ mt: 0.8 }} {...(isTrustVerified(g)
                    ? { label: 'Trust Gate verified', color: 'secondary' }
                    : { label: 'Verification in progress', variant: 'outlined' })} />
                </Box>
                <Button size="small" onClick={() => navigate(`/guide/${g.id}`)}>Profile</Button>
              </Paper>
            ))}
          </Box>
        </Section>
      )}

      <Section tone="white" title="What a typical quote includes">
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
          <Box><Typography sx={{ fontWeight: 800, color: TEAL, mb: 1 }}>Usually included</Typography><CheckList items={included} /></Box>
          <Box><Typography sx={{ fontWeight: 800, color: 'text.secondary', mb: 1 }}>Usually not included</Typography><CheckList items={excluded} /></Box>
        </Box>
      </Section>

      <Section title="How it works">
        <Steps steps={steps} />
      </Section>

      <Section tone="sand" title="Get your free Kilimanjaro quote" intro="Tell us a little about your plans. A real person replies within 48 hours.">
        <LeadForm
          id="quote"
          title="Request a free quote"
          subtitle="Fields marked * are required. No payment is taken."
          submitLabel="Send my quote request"
          successTitle="Thank you! We’ve got your request."
          successText="We will email you within 48 hours with a written quote from a local operator, plus our free Kilimanjaro training plan."
          onSubmit={submit}
          canSubmit={!!(f.fullName && f.email)}
        >
          <TextField label="Full name" value={f.fullName} onChange={up('fullName')} required fullWidth />
          <TextField label="Email" type="email" value={f.email} onChange={up('email')} required fullWidth />
          <TextField label="WhatsApp (optional)" value={f.whatsapp} onChange={up('whatsapp')} fullWidth placeholder="+44…" />
          <TextField label="Country you live in" value={f.country} onChange={up('country')} fullWidth />
          <TextField select label="Preferred route" value={f.route} onChange={up('route')} fullWidth>
            <MenuItem value="">Not sure, recommend one</MenuItem>
            {ROUTES.map(r => <MenuItem key={r.key} value={r.key}>{r.key} ({r.days})</MenuItem>)}
          </TextField>
          <TextField select label="When would you like to climb?" value={f.travelMonth} onChange={up('travelMonth')} fullWidth>
            {MONTHS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
          <TextField label="Number of climbers" type="number" value={f.groupSize} onChange={up('groupSize')} fullWidth inputProps={{ min: 1, max: 50 }} />
          <TextField select label="Budget per person" value={f.budget} onChange={up('budget')} fullWidth>
            {BUDGETS.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
          </TextField>
          {operators.length > 0 && (
            <FullWidth>
              <TextField select label="Preferred operator (optional)" value={f.guideId} onChange={up('guideId')} fullWidth>
                <MenuItem value="">No preference</MenuItem>
                {operators.map(g => <MenuItem key={g.id} value={g.id}>{g.name} · {g.tradingName}</MenuItem>)}
              </TextField>
            </FullWidth>
          )}
          <FullWidth>
            <FormControlLabel
              control={<Checkbox checked={f.charityClimb} onChange={e => setF(prev => ({ ...prev, charityClimb: e.target.checked }))} />}
              label={<Typography sx={{ fontSize: 14 }}>This is a charity / fundraising climb</Typography>}
            />
          </FullWidth>
          <FullWidth><TextField label="Anything else? (experience, questions, special requests)" value={f.message} onChange={up('message')} fullWidth multiline rows={3} /></FullWidth>
        </LeadForm>
      </Section>

      <Section tone="white">
        <FAQAccordion title="Kilimanjaro FAQ" faqs={faqs} />
      </Section>

      <LegalFooterNote />
    </Box>
  );
}
