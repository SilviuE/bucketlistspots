import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper, InputBase, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';

export default function SearchBar({ variant = 'hero', placeholder, onSearch }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(query);
    } else {
      navigate(`/book?q=${encodeURIComponent(query)}`);
    }
  };

  return (
    <Paper
      component="form"
      onSubmit={handleSubmit}
      elevation={0}
      sx={{
        display: 'flex', alignItems: 'center',
        borderRadius: variant === 'hero' ? 3 : 18,
        border: '1px solid rgba(16, 42, 67, 0.12)',
        bgcolor: '#FFFFFF',
        height: variant === 'hero' ? 56 : 48,
        pl: 2,
        '&:focus-within': { borderColor: '#2A9D8F', boxShadow: '0 0 0 3px rgba(42,157,143,0.20)' },
      }}
    >
      <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
      <InputBase
        placeholder={placeholder || "Destination, experience, guide name..."}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        sx={{ flex: 1, ml: 1, fontSize: '15px', '& input::placeholder': { color: '#243B53', opacity: 0.6 } }}
      />
      <IconButton type="submit" sx={{ color: 'primary.main', mr: 0.5 }} size="small">
        <SearchIcon />
      </IconButton>
    </Paper>
  );
}
