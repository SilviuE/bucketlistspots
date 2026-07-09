import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Container, Typography, Chip, Grid, Slider, FormControlLabel, Switch, Collapse, CircularProgress,
} from '@mui/material';
import SEO from '../components/SEO';
import SearchBar from '../components/SearchBar';
import GuideCard from '../components/GuideCard';
import { fetchGuides } from '../lib/api';
import { formatPrice, getStoredCurrency } from '../lib/currency';

const vibes = ['Relaxed/Fun', 'Strict/Pro', 'Photographer-friendly'];

export default function BookNow() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedVibes, setSelectedVibes] = useState([]);
  const [maxPrice, setMaxPrice] = useState(5000);
  const currency = getStoredCurrency();
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchGuides().then(setGuides).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSearch = (query) => setSearchQuery(query);

  const filteredGuides = useMemo(() => {
    return guides.filter(guide => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesName = guide.name.toLowerCase().includes(q);
        const matchesLocation = guide.location.toLowerCase().includes(q);
        const matchesRoute = guide.routes.some(r => r.name.toLowerCase().includes(q));
        if (!matchesName && !matchesLocation && !matchesRoute) return false;
      }
      if (selectedVibes.length > 0 && !selectedVibes.includes(guide.vibe)) return false;
      if (guide.price > maxPrice) return false;
      return true;
    });
  }, [guides, searchQuery, selectedVibes, maxPrice]);

  const toggleVibe = (vibe) => {
    setSelectedVibes(prev =>
      prev.includes(vibe) ? prev.filter(v => v !== vibe) : [...prev, vibe]
    );
  };

  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <SEO
        title="Book Now"
        description="Browse and book verified local guides for your bucket list adventure. Search by destination, guide, or route. Safe direct booking."
        path="/book"
      />
      <Typography variant="h1" mb={0.5}>Book Now</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Find your perfect guide and adventure.
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress sx={{ color: '#2A9D8F' }} /></Box>
      ) : null}

      <SearchBar onSearch={handleSearch} placeholder="Search guides, destinations, routes..." />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, mb: 1 }}>
        <FormControlLabel
          control={<Switch size="small" checked={showFilters} onChange={(e) => setShowFilters(e.target.checked)} />}
          label={<Typography variant="caption" fontWeight={600}>Filters</Typography>}
        />
        <Typography variant="caption" color="text.secondary">
          {filteredGuides.length} guide{filteredGuides.length !== 1 ? 's' : ''} found
        </Typography>
      </Box>

      <Collapse in={showFilters}>
        <Box sx={{ p: 2, bgcolor: '#FFFFFF', borderRadius: 3, border: '1px solid rgba(16,42,67,0.12)', mb: 2 }}>
          <Typography variant="caption" fontWeight={700} gutterBottom display="block">Vibe</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
            {vibes.map(vibe => (
              <Chip
                key={vibe}
                label={vibe}
                onClick={() => toggleVibe(vibe)}
                color={selectedVibes.includes(vibe) ? 'secondary' : 'default'}
                variant={selectedVibes.includes(vibe) ? 'filled' : 'outlined'}
                size="small"
              />
            ))}
          </Box>
          <Typography variant="caption" fontWeight={700} gutterBottom display="block">
            Max Price: {formatPrice(maxPrice, currency)}
          </Typography>
          <Slider
            value={maxPrice}
            onChange={(_, val) => setMaxPrice(val)}
            min={500}
            max={5000}
            step={100}
            sx={{ color: '#2A9D8F', '& .MuiSlider-thumb': { width: 18, height: 18 } }}
          />
        </Box>
      </Collapse>

      <Grid container spacing={2}>
        {filteredGuides.map(guide => (
          <Grid item xs={12} key={guide.id}>
            <GuideCard guide={guide} />
          </Grid>
        ))}
      </Grid>

      {filteredGuides.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography variant="body1" color="text.secondary">
            No guides found matching your search.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Try adjusting your filters or search terms.
          </Typography>
        </Box>
      )}
    </Container>
  );
}
