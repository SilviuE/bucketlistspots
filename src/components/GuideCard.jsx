import { useNavigate } from 'react-router-dom';
import {
  Card, CardMedia, CardContent, CardActions, Box, Typography, Chip, IconButton, Avatar,
} from '@mui/material';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import VerifiedIcon from '@mui/icons-material/Verified';
import { useAuth } from '../context/AuthContext';
import { formatGuidePrice, getStoredCurrency } from '../lib/currency';
import { isTrustVerified, toArray, fromPrice } from '../lib/trust';

export default function GuideCard({ guide, variant = 'default' }) {
  const navigate = useNavigate();
  const { isGuideSaved, toggleSavedGuide } = useAuth();
  const saved = isGuideSaved(guide.id);
  const currency = getStoredCurrency();
  const verified = isTrustVerified(guide);
  const languages = toArray(guide.languages);
  const routes = toArray(guide.routes);
  const price = fromPrice(guide);

  if (variant === 'compact') {
    return (
      <Card
        sx={{ minWidth: 260, maxWidth: 300, cursor: 'pointer', '&:hover': { boxShadow: '0 8px 24px rgba(16,42,67,0.15)' } }}
        onClick={() => navigate(`/guide/${guide.id}`)}
      >
        <Box sx={{ display: 'flex', p: 2, gap: 1.5, alignItems: 'center' }}>
          <Avatar src={guide.photo} alt={guide.name} sx={{ width: 48, height: 48 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>{guide.name}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{guide.location}</Typography>
          </Box>
          {verified && (
            <VerifiedIcon sx={{ color: 'secondary.main', fontSize: 20 }} />
          )}
        </Box>
        <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {routes.slice(0, 2).map(r => (
            <Chip key={r.name} label={r.name} size="small" variant="outlined" sx={{ height: 24, fontSize: 11 }} />
          ))}
        </Box>
      </Card>
    );
  }

  return (
    <Card
      sx={{ cursor: 'pointer', '&:hover': { boxShadow: '0 8px 24px rgba(16,42,67,0.15)' } }}
      onClick={() => navigate(`/guide/${guide.id}`)}
    >
      <CardMedia
        component="img"
        height="160"
        image={guide.heroImage}
        alt={guide.name}
        sx={{ objectFit: 'cover' }}
      />
      <CardContent sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Avatar src={guide.photo} alt={guide.name} sx={{ width: 48, height: 48, border: '2px solid white', mt: -4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="body1" fontWeight={700} noWrap>{guide.name}</Typography>
              {verified && (
                <VerifiedIcon sx={{ color: 'secondary.main', fontSize: 18 }} />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary" noWrap>{guide.location}</Typography>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); toggleSavedGuide(guide.id); }}
            sx={{ color: saved ? 'error.main' : 'text.secondary' }}
          >
            {saved ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
          </IconButton>
        </Box>

        <Box sx={{ mt: 1 }}>
          {verified ? (
            <Chip icon={<VerifiedIcon sx={{ fontSize: 14 }} />} label="Trust Gate verified" size="small" color="secondary" sx={{ height: 24, fontSize: 11 }} />
          ) : (
            <Chip label="Verification in progress" size="small" variant="outlined" sx={{ height: 24, fontSize: 11 }} />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          {guide.vibe && <Chip label={guide.vibe} size="small" color="secondary" variant="outlined" sx={{ borderColor: 'secondary.main', color: 'secondary.main', height: 24, fontSize: 11 }} />}
          {guide.experience > 0 && <Chip label={`${guide.experience} yrs`} size="small" variant="outlined" sx={{ height: 24, fontSize: 11 }} />}
          {languages[0] && <Chip label={languages[0]} size="small" variant="outlined" sx={{ height: 24, fontSize: 11 }} />}
        </Box>
      </CardContent>
      <CardActions sx={{ px: 2, pb: 2, justifyContent: 'space-between' }}>
        <Box>
          {price ? (
            <>
              <Typography variant="caption" color="text.secondary">from</Typography>
              <Typography variant="body1" fontWeight={800} color="text.primary">
                {formatGuidePrice(price, currency)}
              </Typography>
              <Typography variant="caption" color="text.secondary">per person</Typography>
            </>
          ) : (
            <Typography variant="body2" fontWeight={700}>Price on request</Typography>
          )}
        </Box>
        <Chip
          label="Request a quote"
          color="primary"
          onClick={(e) => { e.stopPropagation(); navigate(`/kilimanjaro?guide=${encodeURIComponent(guide.id)}#quote`); }}
          sx={{ fontWeight: 700, height: 36, '& .MuiChip-label': { px: 2 } }}
        />
      </CardActions>
    </Card>
  );
}
