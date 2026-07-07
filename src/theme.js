import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    navy: { 900: '#102A43', 800: '#243B53' },
    teal: { 600: '#2A9D8F' },
    orange: { 600: '#E05D3A' },
    sand: { 300: '#E9D8A6' },
    stone: { 50: '#F4F5F7' },
    primary: { main: '#E05D3A', contrastText: '#FFFFFF' },
    secondary: { main: '#2A9D8F', contrastText: '#FFFFFF' },
    background: { default: '#F4F5F7', paper: '#FFFFFF' },
    text: { primary: '#102A43', secondary: '#243B53' },
    divider: 'rgba(16, 42, 67, 0.12)',
  },
  typography: {
    fontFamily: '"Inter", "Manrope", system-ui, sans-serif',
    h1: {
      fontFamily: '"Manrope", sans-serif',
      fontSize: '28px',
      lineHeight: '34px',
      fontWeight: 700,
      color: '#102A43',
    },
    h2: {
      fontFamily: '"Manrope", sans-serif',
      fontSize: '22px',
      lineHeight: '28px',
      fontWeight: 700,
      color: '#102A43',
    },
    h3: {
      fontFamily: '"Manrope", sans-serif',
      fontSize: '18px',
      lineHeight: '24px',
      fontWeight: 700,
      color: '#102A43',
    },
    body1: {
      fontSize: '16px',
      lineHeight: '24px',
      fontWeight: 400,
    },
    body2: {
      fontSize: '13px',
      lineHeight: '18px',
      fontWeight: 500,
    },
    caption: {
      fontSize: '12px',
      lineHeight: '16px',
      fontWeight: 600,
      letterSpacing: '0.02em',
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 16,
  },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          padding: '14px 24px',
          fontSize: '16px',
          fontWeight: 600,
          minHeight: 52,
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        sizeSmall: {
          padding: '10px 16px',
          minHeight: 40,
          fontSize: '14px',
          borderRadius: 14,
        },
        containedPrimary: {
          backgroundColor: '#E05D3A',
          color: '#FFFFFF',
          '&:hover': { backgroundColor: '#c94f2e' },
        },
        containedSecondary: {
          backgroundColor: '#2A9D8F',
          color: '#FFFFFF',
          '&:hover': { backgroundColor: '#218377' },
        },
        outlined: {
          borderColor: 'rgba(16, 42, 67, 0.12)',
          color: '#102A43',
          '&:hover': {
            borderColor: 'rgba(16, 42, 67, 0.3)',
            backgroundColor: 'rgba(16, 42, 67, 0.04)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid rgba(16, 42, 67, 0.12)',
          boxShadow: '0 6px 18px rgba(16, 42, 67, 0.10)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          height: 36,
          fontSize: '13px',
          fontWeight: 600,
        },
        filled: {
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(16, 42, 67, 0.12)',
          color: '#102A43',
        },
        colorSecondary: {
          backgroundColor: '#2A9D8F',
          color: '#FFFFFF',
          border: 'none',
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          height: 72,
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid rgba(16, 42, 67, 0.12)',
        },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          color: '#102A43',
          '&.Mui-selected': {
            color: '#2A9D8F',
          },
        },
        label: {
          fontSize: '12px',
          fontWeight: 500,
          '&.Mui-selected': {
            fontSize: '12px',
            fontWeight: 600,
          },
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          backgroundColor: '#FFFFFF',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(16, 42, 67, 0.12)',
          },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#2A9D8F',
            borderWidth: 2,
          },
        },
      },
    },
  },
});

export default theme;
