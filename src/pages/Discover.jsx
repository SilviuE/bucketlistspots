import { useState, useEffect } from 'react';
import { Box, Container, Typography, Button, CircularProgress } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HeroSection from '../components/HeroSection';
import GuideCard from '../components/GuideCard';
import ExperienceCard from '../components/ExperienceCard';
import { fetchGuides, fetchExperiences, fetchDestinations } from '../lib/api';

export default function Discover() {
  const [guides, setGuides] = useState([]);
  const [experiences, setExperiences] = useState([]);
  const [destinations, setDestinations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchGuides(), fetchExperiences(), fetchDestinations()])
      .then(([g, e, d]) => { setGuides(g); setExperiences(e); setDestinations(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const featuredGuides = guides.filter(g => g.featured);
  const featuredExperiences = experiences.filter(e => e.featured);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
        <CircularProgress sx={{ color: '#2A9D8F' }} />
      </Box>
    );
  }

  return (
    <Box>
      <HeroSection />

      <Container maxWidth="sm" sx={{ px: 2, mt: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h2">Featured Guides</Typography>
          <Button variant="text" size="small" endIcon={<ArrowForwardIcon />} href="/book" sx={{ fontSize: 13 }}>
            View All
          </Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
          {featuredGuides.map(guide => (
            <Box key={guide.id} sx={{ minWidth: 300, maxWidth: 340 }}>
              <GuideCard guide={guide} />
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="h2">Trending Adventures</Typography>
            <Button variant="text" size="small" endIcon={<ArrowForwardIcon />} href="/book" sx={{ fontSize: 13 }}>
              View All
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
            {featuredExperiences.map(exp => (
              <ExperienceCard key={exp.id} experience={exp} />
            ))}
          </Box>
        </Box>

        <Box sx={{ mt: 4 }}>
          <Typography variant="h2" mb={1.5}>Explore Destinations</Typography>
          <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
            {destinations.map(dest => (
              <Box
                key={dest.name}
                sx={{
                  minWidth: 160, height: 180, borderRadius: 3, overflow: 'hidden',
                  position: 'relative', cursor: 'pointer',
                  backgroundImage: `url(${dest.image})`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  '&:hover': { transform: 'scale(1.02)', transition: '0.2s' },
                }}
              >
                <Box sx={{ position: 'absolute', inset: 0, background: 'linear-gradient(transparent 40%, rgba(16,42,67,0.85))' }} />
                <Box sx={{ position: 'absolute', bottom: 0, p: 1.5 }}>
                  <Typography fontWeight={700} sx={{ color: '#FFFFFF', fontSize: 15 }}>{dest.name}</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                    {dest.country} · {dest.guideCount} guides
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ mt: 4, mb: 3, p: 3, bgcolor: '#102A43', borderRadius: 4, textAlign: 'center' }}>
          <Typography variant="h2" sx={{ color: '#FFFFFF', mb: 1 }}>
            Are you a local guide?
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, mb: 2 }}>
            Get a professional website, booking system, and global visibility.
          </Typography>
          <Button variant="contained" color="primary" size="large" href="/guides">
            Join as a Guide
          </Button>
        </Box>

        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
            BucketListSpots Ltd · Company No. 16595661
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            We act solely as a disclosed booking agent. Trip operated by independent local guides.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}
