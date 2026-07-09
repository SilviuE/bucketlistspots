import { Box } from '@mui/material';

const LOGO_URL = 'https://res.cloudinary.com/mghrwbp3/image/upload/v1783623067/ChatGPT_Image_Jul_9_2026_07_46_24_PM_thlccx.png';

export default function Logo({ size = 'default', onClick, sx }) {
  const isSmall = size === 'small';
  const height = isSmall ? 28 : 40;

  return (
    <Box onClick={onClick} sx={{ display: 'flex', alignItems: 'center', cursor: onClick ? 'pointer' : 'default', ...sx }}>
      <img
        src={LOGO_URL}
        alt="BucketListSpots"
        height={height}
        style={{ display: 'block' }}
      />
    </Box>
  );
}
