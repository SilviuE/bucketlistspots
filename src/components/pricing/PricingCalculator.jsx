import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Typography, TextField, MenuItem, CircularProgress, Alert, Paper,
} from '@mui/material';

const currencies = [
  { value: 'usd', label: 'US$' },
  { value: 'gbp', label: '£' },
  { value: 'eur', label: '€' },
];

const symbols = { usd: '$', gbp: '£', eur: '€' };

export default function PricingCalculator({
  initialPrice = 2500,
  initialCurrency = 'gbp',
  travelers: fixedTravelers,
  showBookingLock = true,
  referralCode,
  compact = false,
  onCalculationChange,
}) {
  const [tripPrice, setTripPrice] = useState(initialPrice);
  const [currency, setCurrency] = useState(initialCurrency);
  const [travelers, setTravelers] = useState(fixedTravelers || 1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  const apiBase = window.location.hostname === 'localhost'
    ? 'http://localhost:3002'
    : '';

  const fetchPricing = useCallback(async (price, cur, ppl, refCode) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/api/pricing-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripPrice: parseFloat(price) || 0,
          currency: cur,
          travelers: parseInt(ppl) || 1,
          referralCode: refCode || null,
        }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
        if (onCalculationChange) onCalculationChange(data);
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setError('Unable to calculate pricing. Please try again.');
      }
    }
    setLoading(false);
  }, [apiBase, onCalculationChange]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPricing(tripPrice, currency, travelers, referralCode);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [tripPrice, currency, travelers, referralCode, fetchPricing]);

  const sym = symbols[currency] || '$';
  const format = (v) => `${sym}${(v || 0).toLocaleString()}`;

  if (compact && result) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">BLS Platform Fee ({result.platformFeePercentage}%)</Typography>
          <Typography variant="body2" fontWeight={700} sx={{ color: '#E05D3A' }}>{format(result.totalGrossPlatformFee)}</Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" fontWeight={700}>Local Partner Balance ({result.localPartnerPercentage}%)</Typography>
          <Typography variant="body2" fontWeight={700} sx={{ color: '#2A9D8F' }}>{format(result.totalLocalPartnerBalance)}</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          Illustrative estimate based on current platform configuration.
        </Typography>
      </Box>
    );
  }

  return (
    <Paper elevation={0} sx={{ border: '1px solid rgba(16,42,67,0.12)', borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ bgcolor: '#102A43', px: 2.5, py: 1.5 }}>
        <Typography variant="h3" sx={{ color: '#FFF', fontSize: '16px' }}>Where Your Trip Payment Goes</Typography>
      </Box>

      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
          <TextField
            size="small" label="Trip Price" type="number"
            value={tripPrice}
            onChange={(e) => setTripPrice(e.target.value)}
            InputProps={{ startAdornment: <Typography variant="caption" mr={0.5}>{sym}</Typography> }}
            sx={{ flex: 1 }}
          />
          <TextField
            size="small" label="Currency" select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            sx={{ width: 100 }}
          >
            {currencies.map(c => (
              <MenuItem key={c.value} value={c.value}>{c.label} {c.value.toUpperCase()}</MenuItem>
            ))}
          </TextField>
          {!fixedTravelers && (
            <TextField
              size="small" label="Travelers" type="number"
              value={travelers}
              onChange={(e) => setTravelers(e.target.value)}
              inputProps={{ min: 1, max: 20 }}
              sx={{ width: 90 }}
            />
          )}
        </Box>

        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
            <CircularProgress size={16} sx={{ color: '#2A9D8F' }} />
            <Typography variant="caption" color="text.secondary">Calculating...</Typography>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ borderRadius: 2, mb: 1 }}>{error}</Alert>
        )}

        {result && !loading && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
              <Typography variant="body2" color="text.secondary">Listed Trip Price</Typography>
              <Typography variant="body2" fontWeight={600}>{format(result.listedTripPrice)} × {result.travelers}</Typography>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, bgcolor: '#FFF5F2', px: 1, borderRadius: 1, mb: 0.5 }}>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#E05D3A' }}>BLS Platform Fee ({result.platformFeePercentage}%)</Typography>
              <Typography variant="body2" fontWeight={700} sx={{ color: '#E05D3A' }}>{format(result.totalGrossPlatformFee)}</Typography>
            </Box>

            {showBookingLock && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, pl: 2 }}>
                  <Typography variant="caption" color="text.secondary">Booking Lock Payment (due today)</Typography>
                  <Typography variant="caption" fontWeight={600}>{format(result.totalBookingLock)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, pl: 2, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">Platform Fee Balance (due later)</Typography>
                  <Typography variant="caption" fontWeight={600}>{format(result.totalPlatformFeeBalance)}</Typography>
                </Box>
              </>
            )}

            {result.effectiveReferralDiscount > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, bgcolor: '#F0FAF8', px: 1, borderRadius: 1, mb: 0.5 }}>
                <Typography variant="body2" fontWeight={700} sx={{ color: '#2A9D8F' }}>Referral Discount</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: '#2A9D8F' }}>−{format(result.effectiveReferralDiscount)}</Typography>
              </Box>
            )}

            <Box sx={{ borderTop: '2px solid rgba(16,42,67,0.1)', pt: 1, mt: 0.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
                <Typography variant="body2" fontWeight={700}>Local Partner Balance ({result.localPartnerPercentage}%)</Typography>
                <Typography variant="body2" fontWeight={700} sx={{ color: '#2A9D8F', fontSize: '15px' }}>{format(result.totalLocalPartnerBalance)}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Paid directly to the Local Partner according to the booking terms
              </Typography>
            </Box>

            <Alert severity="info" sx={{ mt: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" sx={{ fontStyle: 'italic' }}>
                Illustrative estimate. The exact payment schedule is displayed before checkout.
              </Typography>
            </Alert>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
