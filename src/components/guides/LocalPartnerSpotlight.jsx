import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Avatar } from '@mui/material';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import PersonIcon from '@mui/icons-material/Person';

export default function LocalPartnerSpotlight({ page = '/for-guides' }) {
  const [testimonial, setTestimonial] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiBase = window.location.hostname === 'localhost'
      ? 'http://localhost:3002'
      : '';
    fetch(`${apiBase}/api/public-testimonials?page=${encodeURIComponent(page)}`)
      .then(r => r.json())
      .then(data => {
        setTestimonial(data.testimonials?.[0] || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page]);

  if (loading) return null;

  // Safe fallback: no fabricated quotes
  if (!testimonial) {
    return (
      <Paper elevation={0} sx={{ p: 3, textAlign: 'center', border: '1px solid rgba(16,42,67,0.08)', borderRadius: 3, bgcolor: '#F4F5F7' }}>
        <PersonIcon sx={{ fontSize: 40, color: 'rgba(16,42,67,0.2)', mb: 1 }} />
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
          Why local operators are joining BucketListSpots
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Independent guides choose BucketListSpots for direct international visibility, transparent payment allocation and documented verification — without intermediaries controlling the relationship.
        </Typography>
      </Paper>
    );
  }

  const initials = testimonial.person_name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Paper elevation={0} sx={{ p: 3, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 3, position: 'relative' }}>
      <FormatQuoteIcon sx={{ position: 'absolute', top: 12, right: 16, fontSize: 32, color: 'rgba(42,157,143,0.15)' }} />

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        {testimonial.photo_url ? (
          <Avatar src={testimonial.photo_url} sx={{ width: 48, height: 48, flexShrink: 0 }} />
        ) : (
          <Avatar sx={{ width: 48, height: 48, flexShrink: 0, bgcolor: '#2A9D8F', fontSize: '16px' }}>
            {initials}
          </Avatar>
        )}

        <Box>
          <Typography variant="body2" sx={{ fontStyle: 'italic', mb: 1.5, lineHeight: 1.7, color: '#243B53' }}>
            "{testimonial.testimonial_text}"
          </Typography>
          <Box>
            <Typography variant="caption" fontWeight={700}>
              {testimonial.display_name || testimonial.person_name}
            </Typography>
            {testimonial.role && (
              <Typography variant="caption" color="text.secondary">
                {' '}{testimonial.role}
              </Typography>
            )}
            {testimonial.destination && (
              <Typography variant="caption" color="text.secondary">
                {' '}{testimonial.destination}
              </Typography>
            )}
          </Box>
          {testimonial.relationship_to_bls && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
              {testimonial.relationship_to_bls}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}
