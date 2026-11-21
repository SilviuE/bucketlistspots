import { useEffect, useState } from 'react';
import { Box, Container, Typography, Paper, Chip } from '@mui/material';
import VerifiedIcon from '@mui/icons-material/Verified';
import GppGoodIcon from '@mui/icons-material/GppGood';
import PaymentIcon from '@mui/icons-material/Payment';
import PeopleIcon from '@mui/icons-material/People';
import SEO from '../components/SEO';
import TrustBadge from '../components/TrustBadge';
import VerificationChecklist from '../components/VerificationChecklist';
import { fetchGuides } from '../lib/api';
import { isTrustVerified } from '../lib/trust';

const values = [
  {
    icon: VerifiedIcon,
    title: 'Verified Local Guides',
    desc: 'A guide is marked Verified only after every Trust Gate check is completed. Until then, the profile clearly says verification is in progress.',
  },
  {
    icon: GppGoodIcon,
    title: 'Secure Payments',
    desc: 'Your deposit is processed securely via Stripe. The balance is paid directly to your guide.',
  },
  {
    icon: PeopleIcon,
    title: 'Direct Booking Model',
    desc: 'We connect you directly with the guide. No hidden layers of middlemen inflating prices.',
  },
  {
    icon: PaymentIcon,
    title: 'Traveler Protection',
    desc: 'BucketListSpots Ltd is a UK-registered company (No. 16595661), registered with the ICO (ZC028025). You always see which local operator runs your trip before you commit.',
  },
];

export default function TrustHub() {
  const [guides, setGuides] = useState([]);
  useEffect(() => { fetchGuides().then(setGuides).catch(() => setGuides([])); }, []);
  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <SEO
        title="Trust Hub"
        description="How we ensure every adventure is safe, fair, and authentic. Learn about our guide verification process and traveler protection."
        path="/trust"
      />
      <Typography variant="h1" mb={0.5}>Trust Hub</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        How we ensure every adventure is safe, fair, and authentic.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
        {values.map(v => (
          <Paper key={v.title} elevation={0} sx={{ display: 'flex', gap: 2, p: 2, border: '1px solid rgba(16,42,67,0.08)' }}>
            <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: '#102A43', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <v.icon sx={{ color: '#FFFFFF', fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={700}>{v.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>{v.desc}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>

      <Typography variant="h2" mb={2}>Our Verification Process</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Verification means we reviewed specific evidence (identity, licences, safety and crew-pay practices). It does not mean we supervise daily operations.
      </Typography>
      <VerificationChecklist />

      <Box sx={{ mt: 4, mb: 3, p: 3, bgcolor: '#102A43', borderRadius: 4, textAlign: 'center' }}>
        <Typography variant="h2" sx={{ color: '#FFFFFF', mb: 1 }}>
          Why Trust Matters
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
          We are a UK registered company (No. 16595661) subject to UK consumer protection law and UK GDPR. We act as a disclosed booking agent: your trip contract is with the named local operator.
        </Typography>
      </Box>

      <Typography variant="h2" mb={2}>Our Local Partners</Typography>
      <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
        {guides.map(guide => (
          <Box key={guide.id} sx={{ minWidth: 200, p: 1.5, bgcolor: '#FFFFFF', borderRadius: 3, border: '1px solid rgba(16,42,67,0.12)' }}>
            {isTrustVerified(guide) ? <TrustBadge guide={guide} /> : <Chip label="Verification in progress" size="small" variant="outlined" />}
            <Typography variant="body2" fontWeight={700} mt={1}>{guide.name}</Typography>
            <Typography variant="caption" color="text.secondary">{guide.location}</Typography>
          </Box>
        ))}
      </Box>
    </Container>
  );
}
