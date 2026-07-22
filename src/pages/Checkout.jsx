import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Container, Typography, Button, Paper, Avatar, Divider, TextField, MenuItem, Stepper, Step, StepLabel, Alert, Chip, CircularProgress, Collapse,
} from '@mui/material';
import SEO from '../components/SEO';
import CharityChallengeCTA from '../components/CharityChallengeCTA';
import PreTripChecklist from '../components/PreTripChecklist';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LockIcon from '@mui/icons-material/Lock';
import PaymentIcon from '@mui/icons-material/Payment';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import DiscountIcon from '@mui/icons-material/Discount';
import IconButton from '@mui/material/IconButton';
import { fetchGuideById } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatPrice, getStoredCurrency, setStoredCurrency, stripeCurrency } from '../lib/currency';

const paymentMethods = [
  { id: 'stripe', label: 'Credit/Debit Card (Stripe)', icon: PaymentIcon, desc: 'Secure 3D Secure checkout' },
  { id: 'wise', label: 'Direct Bank Transfer (Wise)', icon: AccountBalanceIcon, desc: 'Pay deposit via bank transfer' },
  { id: 'stripe_link', label: 'Stripe Link', icon: LockIcon, desc: 'Fast checkout with saved card' },
];

export default function Checkout() {
  const apiBase = window.location.hostname === 'localhost' ? 'http://localhost:3002' : '';
  const { guideId } = useParams();
  const navigate = useNavigate();
  const { user, isLoggedIn, authLoading, addBooking, addBucketListItem } = useAuth();
  const [searchParams] = useSearchParams();

  const [guide, setGuide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookingComplete, setBookingComplete] = useState(false);

  // Handle Stripe redirect back
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');
    if (paymentStatus === 'success') {
      const savedBooking = sessionStorage.getItem('pending_booking');
      if (savedBooking) {
        const booking = JSON.parse(savedBooking);
        addBooking(booking);
        addBucketListItem({
          title: `${booking.route || 'Adventure'} with ${booking.guideName}`,
          destination: booking.destination || '',
          status: 'booked',
          targetDate: booking.date,
          notes: `Deposit paid: $${booking.deposit}`,
        });
        sessionStorage.removeItem('pending_booking');
        setBookingComplete(true);
      }
      // Credit BLS Points if referral was used
      if (sessionId) {
        fetch(`${apiBase}/api/confirm-payment`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        }).catch(() => {});
      }
    }
  }, [searchParams]);

  useEffect(() => {
    fetchGuideById(guideId).then(g => { setGuide(g); setLoading(false); });
  }, [guideId]);

  const [step, setStep] = useState(0);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [date, setDate] = useState('');
  const [travelers, setTravelers] = useState(1);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [confirmed, setConfirmed] = useState(false);
const [insuranceConfirmed, setInsuranceConfirmed] = useState(false);
const [porterTraining, setPorterTraining] = useState(false);
  const [dateError, setDateError] = useState('');
const [paymentMethod, setPaymentMethod] = useState('stripe');
const [processing, setProcessing] = useState(false);
const [currency, setCurrency] = useState(getStoredCurrency());
const [referralCode, setReferralCode] = useState('');
const [showReferral, setShowReferral] = useState(false);
const [referralStatus, setReferralStatus] = useState(null); // null | 'loading' | 'valid' | 'invalid'
const [referralDiscount, setReferralDiscount] = useState(0);
const [referralName, setReferralName] = useState('');
const [referralError, setReferralError] = useState('');

const validateReferral = async (code) => {
  if (!code.trim()) { setReferralStatus(null); setReferralDiscount(0); setReferralError(''); return; }
  setReferralStatus('loading');
  setReferralError('');
  try {
    const res = await fetch(`${apiBase}/api/validate-referral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.toUpperCase(), currentGuideId: guideId }),
    });
    const data = await res.json();
    if (data.valid) {
      setReferralStatus('valid');
      setReferralDiscount(data.discountAmount);
      setReferralName(data.referrerName);
    } else {
      setReferralStatus('invalid');
      setReferralDiscount(0);
      setReferralError(data.error || 'Invalid code');
    }
  } catch {
    setReferralStatus(null);
    setReferralError('Could not validate code');
  }
};

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ px: 2, pt: 8, textAlign: 'center' }}>
        <CircularProgress sx={{ color: '#2A9D8F' }} />
      </Container>
    );
  }

  if (!guide) {
    return (
      <Container maxWidth="sm" sx={{ px: 2, pt: 4, textAlign: 'center' }}>
        <Typography variant="h1" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>Guide not found</Typography>
        <Button variant="contained" onClick={() => navigate('/book')}>Browse Guides</Button>
      </Container>
    );
  }

  const routeObj = guide.routes.find(r => r.name === selectedRoute);
  const routePrice = routeObj?.price || guide.price;
  const depositAmount = Math.round(routePrice * 0.2);
  const balanceAmount = routePrice - depositAmount;
  const totalTrip = routePrice * travelers;
  const totalDeposit = depositAmount * travelers;
  const porterTrainingAmount = porterTraining ? 10 : 0;
  const discountedDeposit = Math.max(0, totalDeposit - referralDiscount);
  const finalDeposit = discountedDeposit + porterTrainingAmount;

  const handleCurrencyChange = (c) => { setCurrency(c); setStoredCurrency(c); };

  const handleBook = async () => {
    if (date && new Date(date) < new Date(new Date().toDateString())) {
      alert('Start date must be today or later.');
      return;
    }
    const storedUser = (() => { try { const s = localStorage.getItem('bls_user'); return s ? JSON.parse(s) : null; } catch { return null; } })();
    if (!isLoggedIn && !storedUser) {
      navigate(`/auth?redirectTo=/checkout/${guideId}`);
      return;
    }
    setProcessing(true);
    // Save booking to session storage so it persists after Stripe redirect
    const pendingBooking = {
      id: 'bk_' + Date.now(),
      guideName: guide.name,
      guideId: guide.id,
      route: selectedRoute,
      date,
      travelers,
      deposit: totalDeposit,
      total: totalTrip,
      balance: balanceAmount * travelers,
      guestName: name,
      guestEmail: email,
      guestPhone: phone,
      paymentMethod,
      status: 'Deposit Paid — Awaiting Confirmation',
      bookedAt: new Date().toISOString(),
      destination: guide.location,
      referralCode: referralStatus === 'valid' ? referralCode.toUpperCase() : '',
      referralDiscount: referralStatus === 'valid' ? referralDiscount : 0,
    };
    sessionStorage.setItem('pending_booking', JSON.stringify(pendingBooking));

    try {
      const res = await fetch(`${apiBase}/api/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeName: selectedRoute,
          guideName: guide.name,
          guideId: guide.id,
          price: routePrice,
          travelers,
          depositAmount: totalDeposit + porterTrainingAmount,
          guestName: name,
          guestEmail: email,
          date,
          currency: stripeCurrency(currency),
          referralCode: referralStatus === 'valid' ? referralCode.toUpperCase() : '',
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert('Payment failed: ' + (data.error || 'Unknown error'));
        setProcessing(false);
      }
    } catch (err) {
      alert('Could not connect to payment server. Please try again or contact support.');
      setProcessing(false);
    }
  };

  if (bookingComplete) {
    return (
      <Container maxWidth="sm" sx={{ px: 2, pt: 4, textAlign: 'center' }}>
        <Box sx={{ p: 4 }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: '#4CAF50', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <Typography sx={{ color: '#FFF', fontSize: 28 }}>✓</Typography>
          </Box>
          <Typography variant="h1" sx={{ color: '#2A9D8F', mb: 1, fontSize: '1.5rem', fontWeight: 700 }}>Booking Confirmed!</Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Your deposit of <strong>{formatPrice(totalDeposit, currency)}</strong> has been received. {guide.name} will confirm your dates within 24 hours.
          </Typography>

          <Alert severity="success" sx={{ mb: 2, borderRadius: 2, textAlign: 'left' }}>
            <Typography variant="caption" fontWeight={700}>Payment Receipt</Typography>
            <Typography variant="caption" display="block">Paid via: {paymentMethods.find(p => p.id === paymentMethod)?.label || 'Card'}</Typography>
            <Typography variant="caption" display="block">Deposit: {formatPrice(totalDeposit, currency)}{referralDiscount > 0 ? ` (Referral discount: -${formatPrice(referralDiscount, currency)})` : ''}</Typography>
            <Typography variant="caption" display="block">Balance due to {guide.name}: {formatPrice(balanceAmount * travelers, currency)}</Typography>
            <Typography variant="caption" display="block">Booking ref: {Date.now().toString(36).toUpperCase()}</Typography>
          </Alert>

          <Alert severity="info" sx={{ mb: 2, textAlign: 'left', borderRadius: 2 }}>
            <Typography variant="caption" fontWeight={700}>Pay the balance of <strong>{formatPrice(balanceAmount * travelers, currency)}</strong> directly to {guide.name} before the trip (via Wise, bank transfer, or cash on arrival).</Typography>
          </Alert>

          <PreTripChecklist guideName={guide.name} destination={guide.location} />

          <CharityChallengeCTA
            destination={guide.location}
            guideName={guide.name}
          />

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
            <Button variant="outlined" onClick={() => navigate('/bucketlist')}>View My Trips</Button>
            <Button variant="contained" color="primary" onClick={() => navigate('/dashboard')}>My Dashboard</Button>
          </Box>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <SEO title="Book Your Adventure" description="Secure your bucket list adventure with a verified local guide. Pay deposit via Stripe." path={`/checkout/${guideId}`} />
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate(-1)} size="small"><ArrowBackIcon /></IconButton>
        <Typography variant="h1" sx={{ fontSize: '1.5rem', fontWeight: 700 }}>Book Your Adventure</Typography>
      </Box>

      <Paper elevation={0} sx={{ p: 1.5, mb: 3, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Avatar src={guide.photo} alt={guide.name} sx={{ width: 44, height: 44 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={700}>{guide.name}</Typography>
            <Typography variant="caption" color="text.secondary">{guide.location} · {guide.tradingName}</Typography>
          </Box>
          <Chip label={`${guide.rating} ★`} size="small" sx={{ bgcolor: '#FFB80020', color: '#FFB800', fontWeight: 700 }} />
        </Box>
      </Paper>

      <Stepper activeStep={step} sx={{ mb: 3, '& .MuiStepLabel-root .Mui-active': { color: '#2A9D8F' }, '& .MuiStepLabel-root .Mui-completed': { color: '#2A9D8F' } }}>
        <Step><StepLabel>Route & Date</StepLabel></Step>
        <Step><StepLabel>Your Details</StepLabel></Step>
        <Step><StepLabel>Pay</StepLabel></Step>
      </Stepper>

      {step === 0 && (
        <Box>
          <TextField
            select fullWidth label="Select Route"
            value={selectedRoute}
            onChange={(e) => setSelectedRoute(e.target.value)}
            sx={{ mb: 2 }}
          >
            {guide.routes.map(r => (
              <MenuItem key={r.name} value={r.name}>
                {r.name} — {r.days} days — {formatPrice(r.price, currency)}/person
              </MenuItem>
            ))}
          </TextField>
          <TextField fullWidth label="Preferred Start Date" type="date" value={date}
            onChange={(e) => { setDate(e.target.value); setDateError(''); }} InputLabelProps={{ shrink: true }}
            inputProps={{ min: new Date().toISOString().split('T')[0] }}
            error={!!dateError} helperText={dateError} sx={{ mb: 2 }} />
          <TextField fullWidth label="Number of Travelers" type="number" value={travelers}
            onChange={(e) => setTravelers(Math.max(1, parseInt(e.target.value) || 1))}
            inputProps={{ min: 1 }} sx={{ mb: 3 }} />
          <Button variant="contained" color="primary" fullWidth size="large"
            disabled={!selectedRoute || !date} onClick={() => {
              if (date && new Date(date) < new Date(new Date().toDateString())) {
                setDateError('Start date must be today or later');
                return;
              }
              setStep(1);
            }}>
            Continue
          </Button>
        </Box>
      )}

      {step === 1 && (
        <Box>
          {!isLoggedIn && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              <Typography variant="caption">
                <strong>Already have an account?</strong>{' '}
                <Box component="span" onClick={() => navigate(`/auth?redirectTo=/checkout/${guideId}`)} sx={{ color: '#2A9D8F', fontWeight: 700, cursor: 'pointer' }}>Sign in</Box>
                {' '}to auto-fill your details.
              </Typography>
            </Alert>
          )}
          <TextField fullWidth label="Full Name" value={name} onChange={(e) => setName(e.target.value)} sx={{ mb: 2 }} />
          <TextField fullWidth label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2 }} />
          <TextField fullWidth label="Phone (WhatsApp recommended)" value={phone} onChange={(e) => setPhone(e.target.value)} sx={{ mb: 3 }} placeholder="+44..." />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={() => setStep(0)} sx={{ flex: 1 }}>Back</Button>
            <Button variant="contained" color="primary" onClick={() => setStep(2)} disabled={!name || !email} sx={{ flex: 2 }}>Continue</Button>
          </Box>
        </Box>
      )}

      {step === 2 && (
        <Box>
          <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: '#F4F5F7', borderRadius: 2 }}>
            <Typography variant="body2" fontWeight={700} mb={1.5}>Booking Summary</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption">Guide</Typography>
              <Typography variant="caption" fontWeight={600}>{guide.name}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption">Route</Typography>
              <Typography variant="caption" fontWeight={600}>{selectedRoute}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption">Travelers</Typography>
              <Typography variant="caption" fontWeight={600}>{travelers}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption">Date</Typography>
              <Typography variant="caption" fontWeight={600}>{date}</Typography>
            </Box>
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" fontWeight={700}>Total Trip</Typography>
              <Typography variant="body2" fontWeight={800}>{formatPrice(totalTrip, currency)}</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Deposit Due Now (20%)</Typography>
              <Typography variant="caption" fontWeight={700} sx={{ color: '#E05D3A' }}>{formatPrice(totalDeposit, currency)}</Typography>
            </Box>
            {referralStatus === 'valid' && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: '#2A9D8F' }}>Referral Discount ({referralName})</Typography>
                  <Typography variant="caption" fontWeight={700} sx={{ color: '#2A9D8F' }}>-{formatPrice(referralDiscount, currency)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" fontWeight={700}>New Deposit Due Today</Typography>
                  <Typography variant="caption" fontWeight={700} sx={{ color: '#E05D3A' }}>{formatPrice(discountedDeposit, currency)}</Typography>
                </Box>
              </>
            )}
            {porterTraining && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#2A9D8F' }}>Porter Training Fund</Typography>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#2A9D8F' }}>+{formatPrice(10, currency)}</Typography>
              </Box>
            )}
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">Pay {guide.name} Directly Later (80%)</Typography>
              <Typography variant="caption" fontWeight={600}>{formatPrice(balanceAmount * travelers, currency)}</Typography>
            </Box>
          </Paper>

          {/* Referral Code */}
          <Paper elevation={0} sx={{ p: 1.5, mb: 2, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
              onClick={() => setShowReferral(!showReferral)}>
              <DiscountIcon sx={{ fontSize: 16, color: '#2A9D8F' }} />
              <Typography variant="caption" fontWeight={600} sx={{ color: '#2A9D8F' }}>
                {showReferral ? 'Hide' : 'Have a Guide Referral Code?'}
              </Typography>
            </Box>
            <Collapse in={showReferral}>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <TextField fullWidth size="small" placeholder="Enter code (e.g., DAVID50)"
                  value={referralCode}
                  onChange={(e) => { setReferralCode(e.target.value); setReferralStatus(null); setReferralDiscount(0); setReferralError(''); }}
                  disabled={referralStatus === 'loading'}
                  sx={{ '& .MuiInputBase-root': { fontSize: 13 } }} />
                <Button size="small" variant="outlined"
                  onClick={() => validateReferral(referralCode)}
                  disabled={!referralCode.trim() || referralStatus === 'loading'}
                  sx={{ minWidth: 80, fontSize: 12 }}>
                  {referralStatus === 'loading' ? <CircularProgress size={14} /> : 'Apply'}
                </Button>
              </Box>
              {referralStatus === 'valid' && (
                <Typography variant="caption" sx={{ color: '#2A9D8F', mt: 0.5, display: 'block' }}>
                  {formatPrice(referralDiscount, currency)} discount applied! Referred by {referralName}.
                </Typography>
              )}
              {referralError && (
                <Typography variant="caption" sx={{ color: '#E05D3A', mt: 0.5, display: 'block' }}>
                  {referralError}
                </Typography>
              )}
            </Collapse>
          </Paper>

          <Typography variant="caption" fontWeight={700} gutterBottom display="block">
            Pay in
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            {['usd', 'gbp', 'eur'].map(c => (
              <Button key={c} size="small" variant={currency === c ? 'contained' : 'outlined'}
                onClick={() => handleCurrencyChange(c)}
                sx={{ minWidth: 64, minHeight: 40, fontSize: 13, fontWeight: 700 }}>
                {c === 'usd' ? '$ USD' : c === 'gbp' ? '£ GBP' : '€ EUR'}
              </Button>
            ))}
          </Box>

          <Typography variant="caption" fontWeight={700} gutterBottom display="block">
            Payment Method
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
            {paymentMethods.map(pm => (
              <Paper key={pm.id} elevation={0}
                onClick={() => setPaymentMethod(pm.id)}
                sx={{
                  p: 1.5, borderRadius: 2, cursor: 'pointer', display: 'flex', gap: 1.5, alignItems: 'center',
                  border: paymentMethod === pm.id ? '2px solid #2A9D8F' : '1px solid rgba(16,42,67,0.12)',
                  bgcolor: paymentMethod === pm.id ? '#f0faf8' : '#FFF',
                }}
              >
                <pm.icon sx={{ color: '#102A43', fontSize: 24 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={600}>{pm.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{pm.desc}</Typography>
                </Box>
                <Box sx={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid', borderColor: paymentMethod === pm.id ? '#2A9D8F' : 'rgba(16,42,67,0.2)', bgcolor: paymentMethod === pm.id ? '#2A9D8F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {paymentMethod === pm.id && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#FFF' }} />}
                </Box>
              </Paper>
            ))}
          </Box>

          <Alert severity="info" sx={{ mb: 2, borderRadius: 2, fontSize: 12 }}>
            BucketListSpots Ltd acts solely as a disclosed booking agent (Company No. 16595661). Your contract for the trip is directly with {guide.name}. Your deposit is processed securely via Stripe.
          </Alert>

          <Box sx={{ p: 2, mb: 2, bgcolor: '#FFF', borderRadius: 2, border: '1px solid rgba(16,42,67,0.12)', display: 'flex', alignItems: 'flex-start', gap: 1.5, cursor: 'pointer', '&:hover': { borderColor: '#2A9D8F' } }}
            onClick={() => setConfirmed(!confirmed)}
          >
            <Box sx={{ width: 20, height: 20, borderRadius: 0.5, border: '2px solid', borderColor: confirmed ? '#2A9D8F' : 'rgba(16,42,67,0.3)', bgcolor: confirmed ? '#2A9D8F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.2, flexShrink: 0, color: '#FFF', fontSize: 12, fontWeight: 700 }}>
              {confirmed && '✓'}
            </Box>
            <Typography variant="caption" color="text.secondary">
              <strong>I acknowledge</strong> that I have read and accept the{'\n'}
              <strong>BucketListSpots Terms of Use</strong> and{'\n'}
              <strong>{guide.name}'s Booking Conditions</strong>.
            </Typography>
          </Box>

          <Box sx={{ p: 2, mb: 2, bgcolor: '#FFF', borderRadius: 2, border: '1px solid rgba(16,42,67,0.12)', display: 'flex', alignItems: 'flex-start', gap: 1.5, cursor: 'pointer', '&:hover': { borderColor: '#2A9D8F' } }}
            onClick={() => setInsuranceConfirmed(!insuranceConfirmed)}
          >
            <Box sx={{ width: 20, height: 20, borderRadius: 0.5, border: '2px solid', borderColor: insuranceConfirmed ? '#E05D3A' : 'rgba(16,42,67,0.3)', bgcolor: insuranceConfirmed ? '#E05D3A' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.2, flexShrink: 0, color: '#FFF', fontSize: 12, fontWeight: 700 }}>
              {insuranceConfirmed && '✓'}
            </Box>
            <Typography variant="caption" color="text.secondary">
              <strong>Travel Insurance:</strong> I understand that arranging adequate travel insurance (covering high-altitude trekking up to 6,000m and medical evacuation) is <strong>my sole responsibility</strong>. BucketListSpots Ltd is not authorized or regulated by the FCA to provide insurance advice.{'\n'}
              <em>Any insurance links on this platform are for informational purposes only.</em>
            </Typography>
          </Box>

          <Box sx={{ p: 2, mb: 2, bgcolor: '#f0faf8', borderRadius: 2, border: '1px solid #2A9D8F30', display: 'flex', alignItems: 'flex-start', gap: 1.5, cursor: 'pointer', '&:hover': { borderColor: '#2A9D8F' } }}
            onClick={() => setPorterTraining(!porterTraining)}
          >
            <Box sx={{ width: 20, height: 20, borderRadius: 0.5, border: '2px solid', borderColor: porterTraining ? '#2A9D8F' : 'rgba(16,42,67,0.3)', bgcolor: porterTraining ? '#2A9D8F' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 0.2, flexShrink: 0, color: '#FFF', fontSize: 12, fontWeight: 700 }}>
              {porterTraining && '✓'}
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                <strong>Sponsor a Porter's First-Aid Training</strong> (+{formatPrice(10, currency)})
              </Typography>
              <Typography variant="caption" display="block" sx={{ color: 'text.secondary', fontSize: 11, mt: 0.3 }}>
                Your {formatPrice(10, currency)} funds Wilderness First Responder certification for a local porter. This makes the mountain safer and helps porters earn higher wages.
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={() => setStep(1)} sx={{ flex: 1 }}>Back</Button>
            <Button
              variant="contained" color="primary"
              onClick={handleBook}
              disabled={!confirmed || !insuranceConfirmed || processing || authLoading}
              sx={{ flex: 2 }}
            >
              {authLoading ? 'Loading...' : processing ? 'Processing...' : `Pay Deposit ${formatPrice(referralStatus === 'valid' ? finalDeposit : totalDeposit + porterTrainingAmount, currency)}`}
            </Button>
          </Box>
        </Box>
      )}
    </Container>
  );
}
