import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Box, Paper, BottomNavigation, BottomNavigationAction, Avatar, IconButton, Typography } from '@mui/material';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import LogoutIcon from '@mui/icons-material/Logout';
import DashboardIcon from '@mui/icons-material/Dashboard';
import RateReviewIcon from '@mui/icons-material/RateReview';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { getStoredCurrency, setStoredCurrency } from '../lib/currency';
import { useState } from 'react';

const navItems = [
  { label: 'Discover', value: '/', icon: ExploreOutlinedIcon },
  { label: 'Book Now', value: '/book', icon: SearchOutlinedIcon },
  { label: 'Bucket List', value: '/bucketlist', icon: BookmarkBorderOutlinedIcon },
  { label: 'Trust Hub', value: '/trust', icon: VerifiedOutlinedIcon },
];

export default function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useAuth();
  const [currency, setCurrency] = useState(getStoredCurrency);

  const currentValue = navItems.find(item => {
    if (item.value === '/') return location.pathname === '/';
    return location.pathname.startsWith(item.value);
  })?.value || '/';

  const isDashboard = location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/guide-dashboard') ||
    location.pathname.startsWith('/ambassador-dashboard') ||
    location.pathname.startsWith('/auth');

  const getDashboardLink = () => {
    if (!user) return '/auth';
    if (user.role === 'guide') return '/guide-dashboard';
    if (user.role === 'ambassador') return '/ambassador-dashboard';
    return '/dashboard';
  };

  if (isDashboard) {
    return (
      <Box sx={{ pb: '72px', minHeight: '100vh', bgcolor: 'background.default' }}>
        <Outlet />
        <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100 }} elevation={0}>
          <BottomNavigation value={currentValue} onChange={(_, val) => navigate(val)} showLabels>
            {navItems.map(item => (
              <BottomNavigationAction key={item.value} label={item.label} value={item.value} icon={<item.icon />} />
            ))}
          </BottomNavigation>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: '72px', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1200, display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1.5, py: 0.8 }}>
        <Logo size="small" onClick={() => navigate('/')} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {['usd', 'gbp', 'eur'].map(c => (
          <IconButton key={c} size="small" onClick={() => { setCurrency(c); setStoredCurrency(c); window.location.reload(); }}
            sx={{ fontSize: 11, fontWeight: 700, bgcolor: currency === c ? '#2A9D8F' : 'rgba(255,255,255,0.9)', color: currency === c ? '#FFF' : '#102A43', width: 36, height: 36, backdropFilter: 'blur(10px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            {c === 'usd' ? '$' : c === 'gbp' ? '£' : '€'}
          </IconButton>
        ))}
        {isLoggedIn && (
          <>
            {user?.role === 'admin' && (
              <IconButton size="small" onClick={() => navigate('/admin/applications')} sx={{ bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                <RateReviewIcon sx={{ fontSize: 20, color: '#E9C46A' }} />
              </IconButton>
            )}
            <IconButton size="small" onClick={() => navigate(getDashboardLink())} sx={{ bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <DashboardIcon sx={{ fontSize: 20, color: '#102A43' }} />
            </IconButton>
            <IconButton size="small" onClick={() => { logout(); navigate('/'); }} sx={{ bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <LogoutIcon sx={{ fontSize: 20, color: '#E05D3A' }} />
            </IconButton>
          </>
        )}
        </Box>
      </Box>
      <Box sx={{ pt: '52px' }}>
        <Outlet />
      </Box>
      <Box sx={{ textAlign: 'center', py: 2, px: 2 }}>
        <Typography variant="caption" color="text.disabled" display="block" mb={0.5}>
          &copy; {new Date().getFullYear()} BucketListSpots Ltd &middot; Company No. 16595661
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5 }}>
          <Typography variant="caption" sx={{ cursor: 'pointer', '&:hover': { color: '#2A9D8F' }, color: 'text.disabled', textDecoration: 'none' }} component="a" href="/terms">Terms</Typography>
          <Typography variant="caption" sx={{ cursor: 'pointer', '&:hover': { color: '#2A9D8F' }, color: 'text.disabled', textDecoration: 'none' }} component="a" href="/privacy">Privacy</Typography>
          <Typography variant="caption" sx={{ cursor: 'pointer', '&:hover': { color: '#2A9D8F' }, color: 'text.disabled', textDecoration: 'none' }} component="a" href="mailto:hello@bucketlistspots.com">Contact</Typography>
        </Box>
      </Box>
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100 }} elevation={0}>
        <BottomNavigation value={currentValue} onChange={(_, val) => navigate(val)} showLabels>
          {navItems.map(item => (
            <BottomNavigationAction key={item.value} label={item.label} value={item.value} icon={<item.icon />} />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
