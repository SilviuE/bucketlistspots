import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Avatar, Chip, Button, IconButton, Divider, Grid, Paper, Rating, CircularProgress,
} from '@mui/material';
import SEO from '../components/SEO';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VerifiedIcon from '@mui/icons-material/Verified';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import LanguageIcon from '@mui/icons-material/Language';
import { isTrustVerified, toArray, fromPrice } from '../lib/trust';
import TrustBadge from '../components/TrustBadge';
import ImpactCalculator from '../components/ImpactCalculator';
import { fetchGuideById } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatPrice, getStoredCurrency } from '../lib/currency';
import UpdateFeed from '../components/UpdateFeed';

export default function GuideProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isGuideSaved, toggleSavedGuide } = useAuth();
  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGuideById(id).then(g => { setGuide(g); setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ px: 2, pt: 8, textAlign: 'center' }}>
        <CircularProgress sx={{ color: '#2A9D8F' }} />
      </Container>
    );
  }

  if (!guide) {
    return (
      <Container maxWidth="sm" sx={{ px: 2, pt: 4, textAlign: 'center' }}>
        <Typography variant="h2">Guide not found</Typography>
        <Button variant="contained" onClick={() => navigate('/book')} sx={{ mt: 2 }}>
          Browse Guides
        </Button>
      </Container>
    );
  }

  const saved = isGuideSaved(guide.id);
  const currency = getStoredCurrency();
  const verified = isTrustVerified(guide);
  const languages = toArray(guide.languages);
  const promises = toArray(guide.promise);
  const certifications = toArray(guide.certifications);
  const routes = toArray(guide.routes).filter((r, i, all) => all.findIndex(x => x?.name === r?.name && x?.days === r?.days) === i);
  const price = fromPrice(guide);

  return (
    <Box>
      <SEO title={guide.name} description={`Book ${guide.name} — a verified local guide in ${guide.location}. ${guide.tagline || `${guide.name} offers authentic bucket list experiences.`}`} path={`/guide/${guide.id}`} />
      <Box sx={{ position: 'relative', height: 260, overflow: 'hidden' }}>
        <Box
          component="img"
          src={guide.heroImage}
          alt={`${guide.name}'s guide hero image in ${guide.location}`}
          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, p: 2, display: 'flex', justifyContent: 'space-between' }}>
          <IconButton onClick={() => navigate(-1)} sx={{ bgcolor: 'rgba(0,0,0,0.3)', color: '#FFFFFF', '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' } }}>
            <ArrowBackIcon />
          </IconButton>
          <IconButton onClick={() => toggleSavedGuide(guide.id)} sx={{ bgcolor: 'rgba(0,0,0,0.3)', color: saved ? '#ff1744' : '#FFFFFF', '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' } }}>
            {saved ? <FavoriteIcon /> : <FavoriteBorderIcon />}
          </IconButton>
        </Box>
      </Box>

      <Container maxWidth="sm" sx={{ px: 2, mt: -5, position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mb: 1 }}>
          <Avatar src={guide.photo} alt={guide.name} sx={{ width: 80, height: 80, border: '3px solid #FFFFFF', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="h1" noWrap sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{guide.name}</Typography>
              {verified && <VerifiedIcon sx={{ color: 'secondary.main', fontSize: 22 }} />}
            </Box>
            <Typography variant="body2" color="text.secondary">{guide.tradingName}</Typography>
            <Typography variant="caption" color="text.secondary">{guide.location}</Typography>
          </Box>
        </Box>

        <Box sx={{ mb: 1.5 }}>
          {verified ? (
            <TrustBadge guide={guide} size="list" />
          ) : (
            <Chip label="Trust Gate verification in progress — documents under review" size="small" variant="outlined" />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1.5, mb: 2 }}>
          {guide.vibe && <Chip label={guide.vibe} color="secondary" size="small" />}
          {languages.map(lang => (
            <Chip key={lang} icon={<LanguageIcon sx={{ fontSize: 14 }} />} label={lang} variant="outlined" size="small" />
          ))}
          {guide.experience > 0 && <Chip label={`${guide.experience} years experience`} variant="outlined" size="small" />}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            onClick={() => navigate(`/kilimanjaro?guide=${encodeURIComponent(guide.id)}#quote`)}
          >
            Request a free quote{price ? ` · from ${formatPrice(price, currency)}` : ''}
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" display="block" mb={3}>
          No payment now. You receive a written quote from the operator before deciding.
        </Typography>

        <ImpactCalculator guidePrice={price || 0} />

        <Paper elevation={0} sx={{ p: 2, mt: 2, border: '1px solid rgba(16,42,67,0.08)' }}>
          <Typography variant="body2" fontWeight={700} mb={1}>My Story</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7, whiteSpace: 'pre-line' }}>{guide.bio}</Typography>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, mt: 2, border: '1px solid rgba(16,42,67,0.08)' }}>
          <Typography variant="body2" fontWeight={700} mb={1}>Why I Went Independent</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>{guide.whyIndependent}</Typography>
        </Paper>

        <Paper elevation={0} sx={{ p: 2, mt: 2, border: '1px solid rgba(16,42,67,0.08)' }}>
          <Typography variant="body2" fontWeight={700} mb={1.5}>My Promise to You</Typography>
          {promises.map((p, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.5 }}>
              <VerifiedIcon sx={{ color: '#2A9D8F', fontSize: 16, mt: 0.3 }} />
              <Typography variant="body2" color="text.secondary">{p}</Typography>
            </Box>
          ))}
        </Paper>

        <Paper elevation={0} sx={{ p: 2, mt: 2, border: '1px solid rgba(16,42,67,0.08)' }}>
          <Typography variant="body2" fontWeight={700} mb={1.5}>Available Routes</Typography>
          {routes.map((route, i) => (
            <Box
              key={`${route.name}-${i}`}
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: '1px solid rgba(16,42,67,0.06)', '&:last-child': { borderBottom: 0 } }}
            >
              <Box>
                <Typography variant="body2" fontWeight={600}>{route.name}</Typography>
                <Typography variant="caption" color="text.secondary">{route.days} days · {route.difficulty}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="body2" fontWeight={700}>
                  {formatPrice(route.price, currency)}
                </Typography>
                <Typography variant="caption" color="text.secondary">/ person</Typography>
              </Box>
            </Box>
          ))}
        </Paper>

        <Paper elevation={0} sx={{ p: 2, mt: 2, mb: 3, border: '1px solid rgba(16,42,67,0.08)' }}>
          <Typography variant="body2" fontWeight={700} mb={1.5}>Certifications</Typography>
          {certifications.map(cert => (
            <Box key={cert} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <VerifiedIcon sx={{ color: '#102A43', fontSize: 16 }} />
              <Typography variant="body2" color="text.secondary">{cert}</Typography>
            </Box>
          ))}
        </Paper>

        <Paper elevation={0} sx={{ p: 2, mt: 2, mb: 3, border: '1px solid rgba(16,42,67,0.08)' }}>
          <Typography variant="body2" fontWeight={700} mb={1.5}>Updates</Typography>
          <UpdateFeed userId={guide.user_id} />
        </Paper>
      </Container>
    </Box>
  );
}
