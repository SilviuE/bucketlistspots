import { useState } from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';

const CHECKLIST_ITEMS = [
  { id: 'email', label: 'Check your email for booking confirmation & receipt', critical: false },
  { id: 'guide_contact', label: 'Your guide will reach out via WhatsApp or email within 24 hours', critical: false },
  { id: 'insurance', label: 'Arrange travel insurance (high-altitude trekking + medical evacuation)', critical: true },
  { id: 'visa', label: 'Check visa requirements for your destination', critical: true },
  { id: 'vaccinations', label: 'Check vaccination requirements (Yellow Fever, Typhoid, etc.)', critical: true },
  { id: 'balance', label: 'Pay remaining balance directly to your guide before the trip', critical: false },
  { id: 'gear', label: 'Review packing list & essential gear', critical: false },
  { id: 'offline_maps', label: 'Download offline maps for your destination', critical: false },
  { id: 'emergency', label: 'Share your itinerary with a friend or family member', critical: false },
];

const STORAGE_KEY = 'bls_checklist_';

export default function PreTripChecklist({ guideName, destination }) {
  const [checked, setChecked] = useState(() => {
    const saved = {};
    CHECKLIST_ITEMS.forEach(item => {
      const key = STORAGE_KEY + item.id;
      saved[item.id] = localStorage.getItem(key) === 'true';
    });
    return saved;
  });

  const toggle = (id) => {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    localStorage.setItem(STORAGE_KEY + id, next[id]);
  };

  const completed = Object.values(checked).filter(Boolean).length;
  const total = CHECKLIST_ITEMS.length;
  const progress = Math.round((completed / total) * 100);

  return (
    <Paper elevation={0} sx={{ p: 2, mb: 2, borderRadius: 2, border: '1px solid rgba(42,157,143,0.15)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <FlightTakeoffIcon sx={{ color: '#2A9D8F', fontSize: 20 }} />
        <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>What's Next</Typography>
        <Chip label={`${completed}/${total}`} size="small" sx={{ fontSize: 10, bgcolor: completed === total ? '#4CAF5020' : '#2A9D8F15', color: completed === total ? '#4CAF50' : '#2A9D8F', fontWeight: 700 }} />
      </Box>

      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(16,42,67,0.06)', overflow: 'hidden' }}>
          <Box sx={{ height: '100%', width: `${progress}%`, bgcolor: completed === total ? '#4CAF50' : '#2A9D8F', borderRadius: 2, transition: 'width 0.3s' }} />
        </Box>
      </Box>

      {CHECKLIST_ITEMS.map(item => (
        <Box
          key={item.id}
          onClick={() => toggle(item.id)}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.6, cursor: 'pointer', borderRadius: 1, px: 0.5, '&:hover': { bgcolor: 'rgba(42,157,143,0.04)' } }}
        >
          {checked[item.id]
            ? <CheckCircleOutlineIcon sx={{ fontSize: 18, color: '#4CAF50' }} />
            : <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: item.critical ? '#E05D3A' : 'rgba(16,42,67,0.3)' }} />
          }
          <Typography
            variant="caption"
            sx={{
              flex: 1,
              textDecoration: checked[item.id] ? 'line-through' : 'none',
              color: checked[item.id] ? 'text.secondary' : item.critical ? '#E05D3A' : 'text.primary',
              fontWeight: item.critical && !checked[item.id] ? 600 : 400,
            }}
          >
            {item.label}
          </Typography>
        </Box>
      ))}

      {destination && (
        <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary', fontSize: 11 }}>
          Destination: {destination} · Guide: {guideName}
        </Typography>
      )}
    </Paper>
  );
}
