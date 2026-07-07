import { useNavigate } from 'react-router-dom';
import { Card, CardMedia, CardContent, Box, Typography, Chip, IconButton } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { useAuth } from '../context/AuthContext';

export default function ExperienceCard({ experience }) {
  const navigate = useNavigate();
  const { isExperienceSaved, toggleSavedExperience } = useAuth();
  const saved = isExperienceSaved(experience.id);

  return (
    <Card
      sx={{ minWidth: 260, maxWidth: 320, cursor: 'pointer', '&:hover': { boxShadow: '0 8px 24px rgba(16,42,67,0.15)' } }}
      onClick={() => navigate(`/book?exp=${experience.id}`)}
    >
      <CardMedia
        component="img"
        height="160"
        image={experience.image}
        alt={experience.title}
        sx={{ objectFit: 'cover' }}
      />
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={700} noWrap>{experience.title}</Typography>
            <Typography variant="caption" color="text.secondary">{experience.location}</Typography>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); toggleSavedExperience(experience.id); }}
            sx={{ color: saved ? 'error.main' : 'text.secondary', ml: 1 }}
          >
            {saved ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
          <StarIcon sx={{ color: '#FFB800', fontSize: 16 }} />
          <Typography variant="caption" fontWeight={700}>{experience.rating}</Typography>
          <Typography variant="caption" color="text.secondary">({experience.reviews})</Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          <Chip icon={<AccessTimeIcon sx={{ fontSize: 14 }} />} label={experience.duration} size="small" variant="outlined" sx={{ height: 24, fontSize: 11 }} />
          <Chip label={experience.difficulty} size="small" variant="outlined" sx={{ height: 24, fontSize: 11 }} />
          <Chip label={experience.badge} size="small" color="secondary" sx={{ height: 24, fontSize: 11 }} />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mt: 1.5 }}>
          <Typography variant="body1" fontWeight={800}>
            {experience.currency}{experience.price.toLocaleString()}
          </Typography>
          <Typography variant="caption" color="text.secondary">/ person</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
