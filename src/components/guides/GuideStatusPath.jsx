import { Box, Typography, Paper, Chip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import MilitaryTechIcon from '@mui/icons-material/MilitaryTech';

const statuses = [
  { icon: <StarIcon />, name: 'Standard Guide', color: '#243B53', desc: 'All approved guides begin here. Access the full toolkit and start receiving bookings.' },
  { icon: <WorkspacePremiumIcon />, name: 'Professional Guide', color: '#1F7A6F', desc: 'For guides with demonstrated experience, strong traveller feedback and consistent platform engagement.' },
  { icon: <EmojiEventsIcon />, name: 'Expert Guide', color: '#E05D3A', desc: 'Recognised specialists with extensive route knowledge, high ratings and a proven track record.' },
  { icon: <MilitaryTechIcon />, name: 'Elite Guide', color: '#E9D886', desc: 'The highest tier. Exceptional operational standards, extensive qualifications and outstanding traveller relationships.' },
];

export default function GuideStatusPath() {
  return (
    <Box sx={{ px: { xs: 2.5, md: 6 }, py: { xs: 4, md: 6 } }}>
      <Typography variant="h2" sx={{ mb: 1 }}>Grow your status as your record develops</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 640 }}>
        Approved Local Partners begin as Standard Guides. Eligible guides may later apply for an upgraded status based on documented experience, qualifications, traveller feedback, operational standards and platform performance.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
        {statuses.map((s, i) => (
          <Paper key={i} elevation={0} sx={{ p: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, display: 'flex', gap: 1.5 }}>
            <Box sx={{ color: s.color, mt: 0.25 }}>{s.icon}</Box>
            <Box>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 0.25 }}>{s.name}</Typography>
              <Typography variant="caption" color="text.secondary">{s.desc}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      <Chip
        label="Status upgrades are not automatic and do not guarantee search position or booking volume."
        sx={{ bgcolor: '#F4F5F7', fontWeight: 600, height: 'auto', py: 0.5, fontSize: '11px' }}
      />
    </Box>
  );
}
