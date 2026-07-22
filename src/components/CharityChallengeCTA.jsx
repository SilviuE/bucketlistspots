import { useState } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import CharitySelector from './CharitySelector';

export default function CharityChallengeCTA({ destination, guideName, onCreated }) {
  const [open, setOpen] = useState(false);

  // Normalize destination for charity lookup (e.g. "Kilimanjaro, Tanzania" → "kilimanjaro")
  const normalizedDestination = (() => {
    if (!destination) return '';
    const lower = destination.toLowerCase();
    if (lower.includes('kilimanjaro')) return 'kilimanjaro';
    if (lower.includes('patagonia')) return 'patagonia';
    if (lower.includes('everest')) return 'everest';
    if (lower.includes('machu') || lower.includes('inca')) return 'machu-picchu';
    // Return first word as fallback
    return lower.split(',')[0].trim();
  })();

  if (!normalizedDestination) return null;

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          p: 2.5, mb: 2, borderRadius: 3,
          border: '1px solid rgba(42,157,143,0.3)',
          background: 'linear-gradient(135deg, #f0faf8 0%, #FFFFFF 100%)',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: '50%',
            bgcolor: '#2A9D8F15', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <VolunteerActivismIcon sx={{ color: '#2A9D8F', fontSize: 22 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
              Turn your climb into a Charity Challenge
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
              Support a local cause linked to {destination || 'your destination'}. Your friends and family can donate to your chosen charity — making your adventure meaningful beyond the summit.
            </Typography>
            <Button
              variant="contained" color="secondary" size="small"
              onClick={() => setOpen(true)}
              startIcon={<VolunteerActivismIcon sx={{ fontSize: 16 }} />}
            >
              Pick a Charity
            </Button>
          </Box>
        </Box>
      </Paper>

      <CharitySelector
        open={open}
        onClose={() => setOpen(false)}
        destination={normalizedDestination}
        guideName={guideName}
        onCreated={(page) => {
          if (onCreated) onCreated(page);
          setOpen(false);
        }}
      />
    </>
  );
}
