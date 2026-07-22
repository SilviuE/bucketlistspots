import { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Alert, CircularProgress, Paper, Checkbox, FormControlLabel, Link,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const countries = [
  'Tanzania', 'Kenya', 'Nepal', 'Peru', 'Romania', 'Norway', 'Ecuador', 'Bolivia',
  'India', 'Morocco', 'Indonesia', 'South Africa', 'Colombia', 'Argentina', 'Chile',
  'Spain', 'Mexico', 'New Zealand', 'Iceland', 'Other',
];

const experienceYears = ['1-2 years', '3-5 years', '5-10 years', '10-15 years', '15+ years'];

const DRAFT_KEY = 'bls_guide_application_draft';

export default function GuideApplicationForm({ embedded = false, onSuccess }) {
  const [form, setForm] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? JSON.parse(saved) : {
        fullName: '', businessName: '', country: '', mainDestination: '',
        licenceType: '', yearsOfExperience: '', email: '', whatsapp: '',
        websiteOrSocial: '', referralCode: '', consentGiven: false,
      };
    } catch { return {
      fullName: '', businessName: '', country: '', mainDestination: '',
      licenceType: '', yearsOfExperience: '', email: '', whatsapp: '',
      websiteOrSocial: '', referralCode: '', consentGiven: false,
    }; }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!success) localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  }, [form, success]);

  const update = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [field]: val }));
  };

  const required = ['fullName', 'country', 'email'];
  const isValid = required.every(f => form[f]?.trim()) && form.consentGiven;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    setError('');
    try {
      const apiBase = window.location.hostname === 'localhost'
        ? 'http://localhost:3002'
        : '';
      const res = await fetch(`${apiBase}/api/apply-guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.fullName,
          trading_name: form.businessName,
          country: form.country,
          destination: form.mainDestination,
          licence_type: form.licenceType,
          experience_years: form.yearsOfExperience,
          email: form.email,
          whatsapp: form.whatsapp,
          website: form.websiteOrSocial,
          referral_code: form.referralCode,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess(true);
        localStorage.removeItem(DRAFT_KEY);
        if (onSuccess) onSuccess(data);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: '#2A9D8F15', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
          <CheckCircleIcon sx={{ color: '#2A9D8F', fontSize: 32 }} />
        </Box>
        <Typography variant="h2" sx={{ mb: 1 }}>Application Received</Typography>
        <Typography variant="body2" color="text.secondary">
          We'll review your application and get back to you within 5 business days.
        </Typography>
      </Box>
    );
  }

  const sx = { mb: 1.5 };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, ...sx }}>
        <TextField fullWidth size="small" label="Full Name" required value={form.fullName} onChange={update('fullName')} />
        <TextField fullWidth size="small" label="Business / Trading Name" value={form.businessName} onChange={update('businessName')} />
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, ...sx }}>
        <TextField size="small" label="Country" select SelectProps={{ native: true }} value={form.country} onChange={update('country')} sx={{ flex: 1 }}>
          <option value="">Select country</option>
          {countries.map(c => <option key={c} value={c}>{c}</option>)}
        </TextField>
        <TextField fullWidth size="small" label="Main Destination" value={form.mainDestination} onChange={update('mainDestination')} placeholder="e.g. Mount Kilimanjaro" />
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, ...sx }}>
        <TextField size="small" label="Type of Licence" value={form.licenceType} onChange={update('licenceType')} placeholder="e.g. Tour Operator Licence" sx={{ flex: 1 }} />
        <TextField size="small" label="Years of Experience" select SelectProps={{ native: true }} value={form.yearsOfExperience} onChange={update('yearsOfExperience')} sx={{ flex: 1 }}>
          <option value="">Select</option>
          {experienceYears.map(y => <option key={y} value={y}>{y}</option>)}
        </TextField>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, ...sx }}>
        <TextField fullWidth size="small" label="Email" required type="email" value={form.email} onChange={update('email')} />
        <TextField fullWidth size="small" label="WhatsApp Number" value={form.whatsapp} onChange={update('whatsapp')} placeholder="+1 234 567 890" />
      </Box>

      <TextField fullWidth size="small" label="Website or Social Profile" value={form.websiteOrSocial} onChange={update('websiteOrSocial')} sx={sx} />

      <TextField fullWidth size="small" label="Referral or Scout Code (optional)" value={form.referralCode} onChange={update('referralCode')} sx={sx} />

      {/* Honeypot — hidden from humans, bots will fill it */}
      <Box sx={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
        <TextField tabIndex={-1} autoComplete="off" label="Fax Number" value={form.faxNumber || ''} onChange={update('faxNumber')} />
      </Box>

      <FormControlLabel
        control={<Checkbox checked={form.consentGiven} onChange={update('consentGiven')} size="small" />}
        sx={{ mb: 1.5 }}
        label={
          <Typography variant="caption" color="text.secondary">
            I consent to the processing of my application in accordance with the{' '}
            <Link href="/privacy" target="_blank" sx={{ color: '#2A9D8F' }}>Privacy Policy</Link>{' '}
            and agree to the{' '}
            <Link href="/terms" target="_blank" sx={{ color: '#2A9D8F' }}>Terms of Service</Link>.
          </Typography>
        }
      />

      {error && <Alert severity="error" sx={{ borderRadius: 2, mb: 1 }}>{error}</Alert>}

      <Button
        variant="contained" color="primary" fullWidth
        onClick={handleSubmit}
        disabled={!isValid || loading}
      >
        {loading ? <CircularProgress size={20} color="inherit" /> : 'Start My Application'}
      </Button>
    </Box>
  );
}
