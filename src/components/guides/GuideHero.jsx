import { Box, Typography, Button, Chip, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import VerifiedIcon from '@mui/icons-material/Verified';

export default function GuideHero() {
  const navigate = useNavigate();

  return (
    <Box sx={{
      background: 'linear-gradient(135deg, #102A43 0%, #1F7A6F 100%)',
      px: { xs: 2.5, md: 6 }, py: { xs: 5, md: 8 },
      textAlign: 'center', color: '#FFF',
    }}>
      <Chip
        icon={<VerifiedIcon sx={{ fontSize: 14, color: '#FFF !important' }} />}
        label="Founding Guide Period — Open Now"
        sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#FFF', fontWeight: 600, fontSize: '11px', mb: 2, height: 28 }}
      />

      <Typography variant="h1" sx={{ color: '#FFF', fontSize: { xs: '26px', md: '36px' }, lineHeight: 1.2, mb: 2 }}>
        Build your adventure business. Reach the world directly.
      </Typography>

      <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.85)', maxWidth: 640, mx: 'auto', mb: 3, lineHeight: 1.7 }}>
        Create a professional verified profile, reach international travellers and manage bookings through BucketListSpots. You operate the trip and receive 80% of every Listed Trip Price directly.
      </Typography>

      <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap', mb: 2 }}>
        <Button
          variant="contained" color="primary" size="large"
          endIcon={<ArrowForwardIcon />}
          onClick={() => navigate('/become-a-guide')}
          sx={{ minWidth: 200 }}
        >
          Apply for Trust Gate Verification
        </Button>
        <Button
          variant="outlined" size="large"
          onClick={() => {
            const el = document.getElementById('financial-model');
            if (el) el.scrollIntoView({ behavior: 'smooth' });
          }}
          sx={{ borderColor: 'rgba(255,255,255,0.4)', color: '#FFF', '&:hover': { borderColor: '#FFF' } }}
        >
          See How the 80/20 Model Works
        </Button>
      </Box>

      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', display: 'block' }}>
        No membership or verification charge during the six-month Founding Guide promotional period. Applications are subject to verification and approval.
      </Typography>
    </Box>
  );
}
