// Shared building blocks for campaign landing pages
// (/kilimanjaro, /join/guides, /join/ambassadors).
import { useState } from 'react';
import {
  Box, Container, Typography, Button, Paper, Alert, CircularProgress, Checkbox, FormControlLabel,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export const NAVY = '#102A43';
export const TEAL = '#2A9D8F';
export const ORANGE = '#E05D3A';
export const SAND = '#E9D8A6';

export function LandingHero({ eyebrow, title, highlight, subtitle, image, ctaLabel, ctaHref = '#apply', secondary, children }) {
  return (
    <Box
      sx={{
        position: 'relative', color: '#fff', overflow: 'hidden',
        backgroundColor: NAVY,
        backgroundImage: image ? `linear-gradient(180deg, rgba(16,42,67,0.55) 0%, rgba(16,42,67,0.92) 100%), url(${image})` : 'none',
        backgroundSize: 'cover', backgroundPosition: 'center',
      }}
    >
      <Container maxWidth="md" sx={{ px: 2, pt: { xs: 6, sm: 9 }, pb: { xs: 5, sm: 8 } }}>
        {eyebrow && (
          <Typography sx={{ color: SAND, fontWeight: 700, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase', mb: 1.5 }}>
            {eyebrow}
          </Typography>
        )}
        <Typography component="h1" sx={{ fontFamily: '"Manrope", sans-serif', fontWeight: 800, color: '#fff', fontSize: { xs: 30, sm: 44 }, lineHeight: 1.12, mb: 2, maxWidth: 720 }}>
          {title}{highlight && <Box component="span" sx={{ color: TEAL }}> {highlight}</Box>}
        </Typography>
        {subtitle && (
          <Typography sx={{ color: 'rgba(255,255,255,0.86)', fontSize: { xs: 16, sm: 18 }, lineHeight: 1.55, maxWidth: 640, mb: 3 }}>
            {subtitle}
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          {ctaLabel && <Button variant="contained" color="primary" size="large" href={ctaHref} sx={{ px: 3, py: 1.3, fontSize: 16 }}>{ctaLabel}</Button>}
          {secondary}
        </Box>
        {children}
      </Container>
    </Box>
  );
}

export function ProofStrip({ items }) {
  return (
    <Box sx={{ bgcolor: '#fff', borderBottom: '1px solid rgba(16,42,67,0.08)' }}>
      <Container maxWidth="md" sx={{ px: 2, py: 2, display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: `repeat(${items.length}, 1fr)` }, gap: 2 }}>
        {items.map(it => (
          <Box key={it.label} sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: 18, fontFamily: '"Manrope", sans-serif' }}>{it.value}</Typography>
            <Typography variant="caption" color="text.secondary">{it.label}</Typography>
          </Box>
        ))}
      </Container>
    </Box>
  );
}

export function Section({ id, title, intro, children, tone = 'default' }) {
  const bg = tone === 'sand' ? '#FBF6E9' : tone === 'navy' ? NAVY : tone === 'white' ? '#fff' : 'transparent';
  const dark = tone === 'navy';
  return (
    <Box id={id} sx={{ bgcolor: bg, py: { xs: 5, sm: 7 }, scrollMarginTop: 72 }}>
      <Container maxWidth="md" sx={{ px: 2 }}>
        {title && <Typography variant="h2" sx={{ fontSize: { xs: 24, sm: 30 }, lineHeight: 1.2, mb: intro ? 1.5 : 3, color: dark ? '#fff' : NAVY }}>{title}</Typography>}
        {intro && <Typography sx={{ color: dark ? 'rgba(255,255,255,0.8)' : 'text.secondary', fontSize: 16, lineHeight: 1.6, mb: 3, maxWidth: 680 }}>{intro}</Typography>}
        {children}
      </Container>
    </Box>
  );
}

export function BenefitGrid({ items, columns = 3 }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${Math.min(columns, 2)}, 1fr)`, md: `repeat(${columns}, 1fr)` }, gap: 2 }}>
      {items.map(b => (
        <Paper key={b.title} elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid rgba(16,42,67,0.08)', bgcolor: '#fff' }}>
          {b.icon && <b.icon sx={{ color: TEAL, fontSize: 30, mb: 1 }} />}
          <Typography sx={{ fontWeight: 700, color: NAVY, fontSize: 16, mb: 0.5 }}>{b.title}</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: 14, lineHeight: 1.55 }}>{b.desc}</Typography>
        </Paper>
      ))}
    </Box>
  );
}

export function Steps({ steps, dark = false }) {
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      {steps.map((s, i) => (
        <Box key={s.title} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: TEAL, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 800 }}>
            {i + 1}
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: dark ? '#fff' : NAVY }}>{s.title}</Typography>
            <Typography sx={{ fontSize: 14, lineHeight: 1.55, color: dark ? 'rgba(255,255,255,0.78)' : 'text.secondary' }}>{s.desc}</Typography>
          </Box>
        </Box>
      ))}
    </Box>
  );
}

export function CheckList({ items, dark = false }) {
  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      {items.map(it => (
        <Box key={it} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <CheckCircleIcon sx={{ color: TEAL, fontSize: 20, mt: '2px' }} />
          <Typography sx={{ fontSize: 15, lineHeight: 1.5, color: dark ? 'rgba(255,255,255,0.9)' : 'text.primary' }}>{it}</Typography>
        </Box>
      ))}
    </Box>
  );
}

// Generic form shell: handles honeypot, consent, submit state and success screen.
export function LeadForm({ id = 'apply', title, subtitle, submitLabel, onSubmit, successTitle, successText, consentLabel, children, canSubmit = true }) {
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    if (!consent) { setError('Please confirm you agree to the privacy notice.'); return; }
    setError('');
    setSubmitting(true);
    try {
      await onSubmit({ faxNumber: honeypot, consentGiven: true });
      setDone(true);
      if (typeof window !== 'undefined' && window.gtag) window.gtag('event', 'generate_lead', { form_id: id });
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again or email hello@bucketlistspots.com.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper id={id} component="form" onSubmit={handle} elevation={0}
      sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 4, bgcolor: '#fff', border: '1px solid rgba(16,42,67,0.1)', boxShadow: '0 12px 40px rgba(16,42,67,0.08)', scrollMarginTop: 72 }}>
      {done ? (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <CheckCircleIcon sx={{ color: '#fff', fontSize: 36 }} />
          </Box>
          <Typography variant="h2" sx={{ color: TEAL, mb: 1 }}>{successTitle}</Typography>
          <Typography color="text.secondary" sx={{ fontSize: 15 }}>{successText}</Typography>
        </Box>
      ) : (
        <>
          <Typography variant="h2" sx={{ mb: 0.5 }}>{title}</Typography>
          {subtitle && <Typography color="text.secondary" sx={{ fontSize: 14, mb: 2.5 }}>{subtitle}</Typography>}
          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
          {/* Honeypot — hidden from humans */}
          <Box component="input" type="text" name="faxNumber" tabIndex={-1} autoComplete="off" value={honeypot}
            onChange={e => setHoneypot(e.target.value)} aria-hidden="true"
            sx={{ position: 'absolute', left: '-10000px', width: 1, height: 1, opacity: 0 }} />
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {children}
          </Box>
          <FormControlLabel
            sx={{ mt: 2, alignItems: 'flex-start' }}
            control={<Checkbox checked={consent} onChange={e => setConsent(e.target.checked)} sx={{ pt: 0.3 }} />}
            label={<Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{consentLabel || <>I agree that BucketListSpots Ltd may use these details to respond to me, as described in the <a href="/privacy" target="_blank" rel="noopener">privacy notice</a>.</>}</Typography>}
          />
          <Button type="submit" variant="contained" color="primary" size="large" fullWidth disabled={submitting || !canSubmit} sx={{ mt: 2, py: 1.4, fontSize: 16 }}>
            {submitting ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : submitLabel}
          </Button>
        </>
      )}
    </Paper>
  );
}

export async function postJson(url, payload) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok || data.error) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function FullWidth({ children }) {
  return <Box sx={{ gridColumn: '1 / -1' }}>{children}</Box>;
}

export function LegalFooterNote() {
  return (
    <Container maxWidth="md" sx={{ px: 2, py: 3 }}>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.6 }}>
        BucketListSpots Ltd · Company No. 16595661 · Registered in England & Wales · ICO registration ZC028025.
        BucketListSpots acts as a disclosed booking agent; each trip is operated by the named independent local operator.
        “Verified” means we reviewed specific evidence (identity, licences, safety and crew-pay practices); we do not supervise daily operations.
      </Typography>
    </Container>
  );
}
