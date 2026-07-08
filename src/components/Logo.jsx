import { Box, Typography } from '@mui/material';

export default function Logo({ size = 'default', onClick, sx }) {
  const isSmall = size === 'small';
  const iconSize = isSmall ? 22 : 32;
  const fontSize = isSmall ? 16 : 20;
  const gap = isSmall ? 0.8 : 1.2;

  return (
    <Box onClick={onClick} sx={{ display: 'flex', alignItems: 'center', gap, cursor: onClick ? 'pointer' : 'default', ...sx }}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 32 32" fill="none">
        <path d="M2 28L12 8L18 18L22 12L30 28H2Z" fill="#2A9D8F" />
        <circle cx="22" cy="8" r="4" fill="#E9C46A" />
        <path d="M16 30L18 26L20 30H16Z" fill="#102A43" />
      </svg>
      <Typography sx={{ fontSize, fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1, color: '#102A43' }}>
        BucketList<span style={{ color: '#2A9D8F' }}>Spots</span>
      </Typography>
    </Box>
  );
}
