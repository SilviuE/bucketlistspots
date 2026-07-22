import { useParams, useNavigate } from 'react-router-dom';
import { Container, Typography, Box, Paper, Button, Chip, Divider } from '@mui/material';
import SEO from '../components/SEO';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VisaIcon from '@mui/icons-material/Flight';
import VaccineIcon from '@mui/icons-material/Vaccines';
import SafetyIcon from '@mui/icons-material/Shield';
import WeatherIcon from '@mui/icons-material/WbSunny';
import GearIcon from '@mui/icons-material/Backpack';
import MoneyIcon from '@mui/icons-material/AttachMoney';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import IconButton from '@mui/material/IconButton';
import destinationInfo from '../data/destinationInfo';

const sectionStyle = { p: 2, mb: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 3 };
const headingStyle = { fontSize: 14, fontWeight: 700, color: '#102A43', mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 };
const textStyle = { fontSize: 13, lineHeight: 1.6, color: 'text.secondary' };

export default function DestinationPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const dest = destinationInfo[slug];

  if (!dest) {
    return (
      <Container maxWidth="sm" sx={{ px: 2, pt: 8, textAlign: 'center' }}>
        <Typography variant="h1" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>Destination not found</Typography>
        <Button variant="contained" onClick={() => navigate('/book')} sx={{ mt: 2 }}>Browse Destinations</Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <SEO title={`${dest.name} — Travel Guide`} description={`Everything you need to know about trekking ${dest.name}: visa, vaccines, safety, gear, and local guides.`} path={`/destination/${slug}`} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate(-1)} size="small"><ArrowBackIcon /></IconButton>
        <Typography variant="h1" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>{dest.name}</Typography>
      </Box>

      <Box sx={{ height: 200, borderRadius: 3, overflow: 'hidden', mb: 2, backgroundImage: `url(${dest.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />

      <Typography variant="body2" sx={{ color: '#2A9D8F', fontWeight: 700, mb: 0.5 }}>{dest.tagline}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: 13, lineHeight: 1.6 }}>{dest.overview}</Typography>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        <Chip label={dest.country} size="small" sx={{ bgcolor: '#102A43', color: '#FFF' }} />
        <Chip label={dest.difficulty} size="small" sx={{ bgcolor: '#E05D3A20', color: '#E05D3A' }} />
        <Chip label={dest.duration} size="small" sx={{ bgcolor: '#2A9D8F20', color: '#2A9D8F' }} />
        <Chip label={`Up to ${dest.altitude}`} size="small" sx={{ bgcolor: '#FFB80020', color: '#FFB800' }} />
      </Box>

      {dest.routes.length > 0 && (
        <Paper elevation={0} sx={sectionStyle}>
          <Typography variant="body2" sx={headingStyle}>🗺️ Popular Routes</Typography>
          {dest.routes.map(r => (
            <Typography key={r} variant="caption" display="block" sx={textStyle}>• {r}</Typography>
          ))}
        </Paper>
      )}

      <Paper elevation={0} sx={sectionStyle}>
        <Typography variant="body2" sx={headingStyle}><VisaIcon sx={{ fontSize: 16, color: '#2A9D8F' }} /> Visa Requirements</Typography>
        <Typography variant="caption" sx={textStyle}>
          {dest.visa.required ? `Visa required: ${dest.visa.type}` : 'Visa-free for most nationalities'}
          {dest.visa.cost !== 'Free' && ` — ${dest.visa.cost}`}
        </Typography>
        <Typography variant="caption" display="block" sx={{ ...textStyle, mt: 0.5 }}>Duration: {dest.visa.duration}</Typography>
        <Typography variant="caption" display="block" sx={{ ...textStyle, mt: 0.5 }}>{dest.visa.howToGet}</Typography>
        {dest.visa.notes && <Typography variant="caption" display="block" sx={{ ...textStyle, mt: 0.5, fontStyle: 'italic' }}>{dest.visa.notes}</Typography>}
      </Paper>

      <Paper elevation={0} sx={sectionStyle}>
        <Typography variant="body2" sx={headingStyle}><VaccineIcon sx={{ fontSize: 16, color: '#2A9D8F' }} /> Vaccines & Health</Typography>
        {dest.vaccines.required.length > 0 && (
          <Typography variant="caption" display="block" sx={{ ...textStyle, color: '#E05D3A', fontWeight: 600 }}>
            Required: {dest.vaccines.required.join(', ')}
          </Typography>
        )}
        <Typography variant="caption" display="block" sx={textStyle}>
          Recommended: {dest.vaccines.recommended.join(', ')}
        </Typography>
        {dest.vaccines.notes && <Typography variant="caption" display="block" sx={{ ...textStyle, mt: 0.5, fontStyle: 'italic' }}>{dest.vaccines.notes}</Typography>}
      </Paper>

      <Paper elevation={0} sx={sectionStyle}>
        <Typography variant="body2" sx={headingStyle}><SafetyIcon sx={{ fontSize: 16, color: '#2A9D8F' }} /> Safety</Typography>
        <Chip label={dest.safety.level} size="small" sx={{ mb: 1, bgcolor: '#4CAF5020', color: '#4CAF50', fontWeight: 700 }} />
        {dest.safety.tips.map((tip, i) => (
          <Typography key={i} variant="caption" display="block" sx={textStyle}>• {tip}</Typography>
        ))}
        <Typography variant="caption" display="block" sx={{ ...textStyle, mt: 0.5, fontWeight: 600 }}>Emergency: {dest.safety.emergency}</Typography>
      </Paper>

      <Paper elevation={0} sx={sectionStyle}>
        <Typography variant="body2" sx={headingStyle}><WeatherIcon sx={{ fontSize: 16, color: '#2A9D8F' }} /> Weather & Packing</Typography>
        <Typography variant="caption" display="block" sx={textStyle}>{dest.weather.summary}</Typography>
        <Typography variant="caption" display="block" sx={{ ...textStyle, mt: 0.5 }}>Temperature: {dest.weather.temperature}</Typography>
        <Typography variant="caption" display="block" sx={{ ...textStyle, mt: 0.5 }}>Rainy season: {dest.weather.rainy}</Typography>
        <Typography variant="caption" display="block" sx={{ ...textStyle, mt: 0.5, fontStyle: 'italic' }}>Packing tip: {dest.weather.packing}</Typography>
      </Paper>

      <Paper elevation={0} sx={sectionStyle}>
        <Typography variant="body2" sx={headingStyle}><MoneyIcon sx={{ fontSize: 16, color: '#2A9D8F' }} /> Money & Currency</Typography>
        <Typography variant="caption" display="block" sx={textStyle}>
          Currency: {dest.currency.name} ({dest.currency.code}) — {dest.currency.symbol}
        </Typography>
        <Typography variant="caption" display="block" sx={{ ...textStyle, mt: 0.5 }}>USD accepted: {dest.currency.usdAccepted}</Typography>
        <Typography variant="caption" display="block" sx={{ ...textStyle, mt: 0.5 }}>ATMs: {dest.currency.atmAvailable}</Typography>
        <Typography variant="caption" display="block" sx={{ ...textStyle, mt: 0.5, fontStyle: 'italic' }}>{dest.currency.tip}</Typography>
      </Paper>

      <Paper elevation={0} sx={sectionStyle}>
        <Typography variant="body2" sx={headingStyle}><GearIcon sx={{ fontSize: 16, color: '#2A9D8F' }} /> Gear Checklist</Typography>
        {dest.gearChecklist.map((item, i) => (
          <Typography key={i} variant="caption" display="block" sx={textStyle}>☐ {item}</Typography>
        ))}
      </Paper>

      <Paper elevation={0} sx={{ ...sectionStyle, bgcolor: '#FFF3E0', border: '1px solid #E05D3A30' }}>
        <Typography variant="body2" sx={{ ...headingStyle, color: '#E05D3A' }}><WarningAmberIcon sx={{ fontSize: 16 }} /> Insurance Reminder</Typography>
        <Typography variant="caption" display="block" sx={textStyle}>{dest.insuranceNotes}</Typography>
        <Typography variant="caption" display="block" sx={{ ...textStyle, mt: 1, fontStyle: 'italic' }}>
          BucketListSpots Ltd is not authorized or regulated by the FCA to provide insurance advice. Arranging adequate travel insurance is your sole responsibility.
        </Typography>
      </Paper>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h2" sx={{ fontSize: 16, fontWeight: 700, mb: 1.5 }}>Ready to Book?</Typography>
      <Button variant="contained" color="primary" fullWidth size="large" onClick={() => navigate('/book')}>
        Find Guides in {dest.country}
      </Button>
      <Button variant="outlined" fullWidth size="large" sx={{ mt: 1 }} onClick={() => navigate('/bucketlist')}>
        Add to My Bucket List
      </Button>
    </Container>
  );
}
