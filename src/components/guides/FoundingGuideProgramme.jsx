import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Chip, Alert } from '@mui/material';
import EventIcon from '@mui/icons-material/Event';

export default function FoundingGuideProgramme() {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const apiBase = window.location.hostname === 'localhost'
      ? 'http://localhost:3002'
      : '';
    fetch(`${apiBase}/api/public-platform-settings`)
      .then(r => r.json())
      .then(data => setSettings(data))
      .catch(() => {});
  }, []);

  const zoneNames = settings?.globalPricingZoneNames || ['Global Zone A', 'Global Zone B', 'Global Zone C'];
  const fgCopy = settings?.foundingGuideCopy || 'During the first six months of the BucketListSpots platform promotional period, approved guides pay no membership or verification charge. Guides join with Standard status and may apply for an upgrade when eligible.';
  const zonesCopy = settings?.globalPricingZonesCopy || 'After the promotional period, guide participation will follow the BucketListSpots Fair Access Programme, using Global Pricing Zones based on local economic conditions.';

  const formatDate = (d) => {
    if (!d) return null;
    try { return new Date(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }); }
    catch { return null; }
  };

  return (
    <Box sx={{ px: { xs: 2.5, md: 6 }, py: { xs: 4, md: 6 }, bgcolor: '#102A43', color: '#FFF' }}>
      <Typography variant="h2" sx={{ color: '#FFF', mb: 2 }}>Join during the Founding Guide period</Typography>

      <Paper elevation={0} sx={{ p: 2.5, bgcolor: 'rgba(255,255,255,0.08)', borderRadius: 2, mb: 2, border: '1px solid rgba(255,255,255,0.12)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <EventIcon sx={{ color: '#E9D886', fontSize: 20 }} />
          <Typography variant="body2" fontWeight={700} sx={{ color: '#E9D886' }}>
            {settings?.foundingGuideActive ? 'Currently Active' : 'Check dates below'}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, mb: 1 }}>
          {fgCopy}
        </Typography>
        {settings?.foundingGuideStartAt && settings?.foundingGuideEndAt && (
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            {formatDate(settings.foundingGuideStartAt)} — {formatDate(settings.foundingGuideEndAt)}
          </Typography>
        )}
      </Paper>

      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', mb: 1.5 }}>{zonesCopy}</Typography>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        {zoneNames.map((zone, i) => (
          <Chip key={i} label={zone} sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#FFF', fontWeight: 600 }} />
        ))}
      </Box>

      <Alert severity="info" sx={{ bgcolor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', '& .MuiAlert-message': { color: '#FFF' } }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          Guides will receive advance notice of any future membership charge. No payment will be collected automatically without the guide's agreement to the applicable terms.
        </Typography>
      </Alert>
    </Box>
  );
}
