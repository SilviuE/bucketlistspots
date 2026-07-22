import { Box, Typography, Paper } from '@mui/material';
import BadgeIcon from '@mui/icons-material/Badge';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SchoolIcon from '@mui/icons-material/School';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import BuildIcon from '@mui/icons-material/Build';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import HandshakeIcon from '@mui/icons-material/Handshake';
import RuleIcon from '@mui/icons-material/Rule';

const indicators = [
  { icon: <BadgeIcon />, label: 'Identity and contact details' },
  { icon: <AccountBalanceIcon />, label: 'Appropriate local licence or operating authority' },
  { icon: <SchoolIcon />, label: 'Relevant experience' },
  { icon: <PeopleIcon />, label: 'References' },
  { icon: <RuleIcon />, label: 'Route and pricing information' },
  { icon: <SecurityIcon />, label: 'Safety and emergency procedures' },
  { icon: <HealthAndSafetyIcon />, label: 'Insurance evidence where applicable' },
  { icon: <HandshakeIcon />, label: 'Willingness to communicate directly with travellers' },
  { icon: <BuildIcon />, label: 'Compliance with the Local Partner Agreement' },
];

export default function GuideQualification() {
  return (
    <Box sx={{ px: { xs: 2.5, md: 6 }, py: { xs: 4, md: 6 } }}>
      <Typography variant="h2" sx={{ mb: 1 }}>Built for serious independent Local Partners</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 640, lineHeight: 1.7 }}>
        BucketListSpots is designed for legally authorised guides and local operators with proven destination experience, responsible working practices and a commitment to traveller safety, crew dignity and transparent service delivery.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 1.5 }}>
        {indicators.map((item, i) => (
          <Paper key={i} elevation={0} sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.5, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
            <Box sx={{ color: '#2A9D8F', fontSize: 20, flexShrink: 0 }}>{item.icon}</Box>
            <Typography variant="caption" fontWeight={600}>{item.label}</Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  );
}
