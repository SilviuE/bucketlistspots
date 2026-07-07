import { Box, Typography } from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import GppGoodIcon from '@mui/icons-material/GppGood';
import LocalPoliceIcon from '@mui/icons-material/LocalPolice';
import NatureIcon from '@mui/icons-material/Nature';
import HandshakeIcon from '@mui/icons-material/Handshake';
import SecurityIcon from '@mui/icons-material/Security';

const badgeDefs = [
  { key: 'identityVerified', label: 'Identity Verified', icon: VerifiedIcon, color: '#2A9D8F' },
  { key: 'licenseVerified', label: 'Gov Licensed', icon: GppGoodIcon, color: '#102A43' },
  { key: 'safetyVerified', label: 'Safety Certified', icon: LocalPoliceIcon, color: '#2A9D8F' },
  { key: 'fairPayVerified', label: 'Fair Porter Pay', icon: HandshakeIcon, color: '#2A9D8F' },
];

export default function TrustBadge({ guide, size = 'small' }) {
  const activeBadges = badgeDefs.filter(b => guide[b.key]);

  if (size === 'list') {
    return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {activeBadges.map(b => (
          <Box key={b.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <b.icon sx={{ color: b.color, fontSize: 16 }} />
            <Typography variant="caption" fontWeight={600} color="text.secondary">{b.label}</Typography>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
      {activeBadges.map(b => (
        <Box
          key={b.key}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.3,
            bgcolor: b.color === '#102A43' ? '#102A43' : '#2A9D8F',
            color: '#fff', borderRadius: '999px', px: 0.8, py: 0.2,
          }}
        >
          <b.icon sx={{ fontSize: 11 }} />
          <Typography sx={{ fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{b.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}
