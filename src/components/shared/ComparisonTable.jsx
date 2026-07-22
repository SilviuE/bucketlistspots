import { Box, Typography, Paper } from '@mui/material';

export default function ComparisonTable({
  rows = [],
  beforeLabel = 'Indirect booking structure',
  afterLabel = 'BucketListSpots structure',
}) {
  if (!rows.length) return null;

  return (
    <Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
        <Typography variant="h3" sx={{ fontWeight: 700, color: '#243B53', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {beforeLabel}
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 700, color: '#2A9D8F', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px', display: { xs: 'none', md: 'block' } }}>
          {afterLabel}
        </Typography>
      </Box>

      {rows.map((row, i) => (
        <Paper
          key={i}
          elevation={0}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 0,
            mb: 1,
            border: '1px solid rgba(16,42,67,0.08)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ px: 2, py: 1.5, bgcolor: '#F8F9FA', borderRight: { md: '1px solid rgba(16,42,67,0.08)' } }}>
            <Typography variant="caption" sx={{ textDecoration: 'line-through', color: '#9E9E9E' }}>
              {row.before}
            </Typography>
          </Box>
          <Box sx={{ px: 2, py: 1.5, bgcolor: '#F0FAF8' }}>
            <Typography variant="caption" fontWeight={600} sx={{ color: '#102A43' }}>
              {row.after}
            </Typography>
          </Box>
        </Paper>
      ))}

      <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 0.5, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: '#2A9D8F', fontWeight: 700, fontSize: '11px' }}>
          ↑ {afterLabel}
        </Typography>
      </Box>
    </Box>
  );
}
