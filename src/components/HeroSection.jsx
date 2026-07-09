import { Box, Typography, Container, Button } from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import SearchBar from './SearchBar';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function HeroSection() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();
  return (
    <Box
      sx={{
        position: 'relative',
        height: 420,
        display: 'flex', alignItems: 'flex-end',
        background: 'linear-gradient(135deg, #102A43 0%, #1a3a5c 50%, #1F7A6F 100%)',
        borderRadius: '0 0 24px 24px',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ position: 'absolute', inset: 0, opacity: 0.2 }}>
        <Box
          component="img"
          src="/images/hero-clouds.jpg"
          alt="Mount Kilimanjaro landscape with clouds"
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </Box>
      {!isLoggedIn && (
        <Button
          onClick={() => navigate('/auth')}
          variant="text"
          startIcon={<PersonIcon />}
          sx={{ position: 'absolute', top: 16, right: 16, zIndex: 2, color: 'rgba(255,255,255,0.8)', fontSize: 13 }}
        >
          Sign In
        </Button>
      )}
      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1, pb: 4, px: 2 }}>
        <Typography
          variant="h1"
          sx={{ color: '#FFFFFF', mb: 1, fontSize: { xs: '26px', sm: '32px' } }}
        >
          Climb Kilimanjaro.
          <Box component="span" sx={{ color: '#2A9D8F' }}> With Local Legends.</Box>
        </Typography>
        <Typography
          sx={{ color: 'rgba(255,255,255,0.8)', mb: 3, fontSize: '15px', lineHeight: '22px' }}
        >
          Guided expeditions from Moshi, Tanzania. Local experts, fair wages, world-class safety.
        </Typography>
        <SearchBar variant="hero" />
      </Container>
    </Box>
  );
}
