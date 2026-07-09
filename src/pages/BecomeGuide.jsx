import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Typography, TextField, Button, Paper, Alert, CircularProgress, MenuItem } from '@mui/material';
import SEO from '../components/SEO';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const countries = [
  'Tanzania', 'Kenya', 'Nepal', 'Peru', 'Romania', 'Norway',
  'Ecuador', 'Bolivia', 'India', 'Morocco', 'Indonesia', 'Other',
];

export default function BecomeGuide() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', country: '',
    experience: '', languages: '', specialties: '', message: '',
    heardFrom: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/apply-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      setDone(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <Container maxWidth="sm" sx={{ px: 2, pt: 8, textAlign: 'center' }}>
        <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: '#2A9D8F', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
          <CheckCircleIcon sx={{ color: '#FFF', fontSize: 36 }} />
        </Box>
        <Typography variant="h2" sx={{ color: '#2A9D8F', mb: 1 }}>Application Submitted!</Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          We'll review your application and get back to you within 48 hours. Check your email for next steps.
        </Typography>
        <Button variant="contained" color="primary" onClick={() => navigate('/')}>
          Back to Home
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <SEO
        title="Become a Guide"
        description="Apply to become a verified local guide on BucketListSpots. Get discovered by travelers worldwide. Free enrollment for the first 3 months."
        path="/become-a-guide"
      />
      <Typography variant="h1" mb={0.5}>Become a Guide</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Join BucketListSpots and get discovered by travelers from around the world.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      <Paper component="form" onSubmit={handleSubmit} elevation={0} sx={{ p: 2, border: '1px solid rgba(16,42,67,0.12)', borderRadius: 3 }}>
        <TextField fullWidth label="Full Name" value={form.fullName} onChange={handleChange('fullName')} required sx={{ mb: 2 }} />
        <TextField fullWidth label="Email Address" type="email" value={form.email} onChange={handleChange('email')} required sx={{ mb: 2 }} />
        <TextField fullWidth label="Phone (WhatsApp)" value={form.phone} onChange={handleChange('phone')} required sx={{ mb: 2 }} placeholder="+255..." />
        <TextField select fullWidth label="Country" value={form.country} onChange={handleChange('country')} required sx={{ mb: 2 }}>
          {countries.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
        <TextField fullWidth label="Years of Experience" type="number" value={form.experience} onChange={handleChange('experience')} required sx={{ mb: 2 }} />
        <TextField fullWidth label="Languages You Speak" value={form.languages} onChange={handleChange('languages')} required sx={{ mb: 2 }} placeholder="e.g. English, Swahili" />
        <TextField fullWidth label="Specialties" value={form.specialties} onChange={handleChange('specialties')} sx={{ mb: 2 }} placeholder="e.g. Kilimanjaro, Safari, Inca Trail" />
        <TextField fullWidth label="Tell Us About Yourself" multiline rows={4} value={form.message} onChange={handleChange('message')} sx={{ mb: 2 }} placeholder="Your experience, certifications, why you want to join..." />
        <TextField fullWidth label="How Did You Hear About Us?" value={form.heardFrom} onChange={handleChange('heardFrom')} sx={{ mb: 3 }} />

        <Button type="submit" variant="contained" color="primary" size="large" fullWidth disabled={submitting}>
          {submitting ? <CircularProgress size={24} sx={{ color: '#FFF' }} /> : 'Submit Application'}
        </Button>
      </Paper>
    </Container>
  );
}
