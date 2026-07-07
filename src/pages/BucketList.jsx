import { Container, Typography, Box, Grid, Button, Tabs, Tab } from '@mui/material';
import { useState } from 'react';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import { useAuth } from '../context/AuthContext';
import GuideCard from '../components/GuideCard';
import ExperienceCard from '../components/ExperienceCard';
import guides, { experiences } from '../data/guides';

export default function BucketList() {
  const [tab, setTab] = useState(0);
  const { savedGuides, savedExperiences, bookings } = useAuth();

  const savedGuideData = guides.filter(g => savedGuides.includes(g.id));
  const savedExpData = experiences.filter(e => savedExperiences.includes(e.id));

  const tabs = [
    { label: 'Saved Guides', icon: ExploreOutlinedIcon, count: savedGuides.length },
    { label: 'Saved Adventures', icon: BookmarkBorderOutlinedIcon, count: savedExperiences.length },
    { label: 'My Trips', icon: FlagOutlinedIcon, count: bookings.length },
  ];

  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <Typography variant="h1" mb={0.5}>My Bucket List</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Plan, track, and remember your adventures.
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{
          mb: 2, minHeight: 48,
          '& .MuiTab-root': { minHeight: 48, py: 0.5, textTransform: 'none', fontWeight: 600, fontSize: 13 },
          '& .Mui-selected': { color: '#2A9D8F' },
          '& .MuiTabs-indicator': { backgroundColor: '#2A9D8F' },
        }}
      >
        {tabs.map(t => (
          <Tab key={t.label} label={`${t.label} (${t.count})`} icon={<t.icon sx={{ fontSize: 20 }} />} iconPosition="start" />
        ))}
      </Tabs>

      {tab === 0 && (
        savedGuideData.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <ExploreOutlinedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">No saved guides yet</Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              Tap the heart icon on a guide to save them here.
            </Typography>
            <Button variant="contained" color="primary" href="/book">Discover Guides</Button>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {savedGuideData.map(guide => (
              <Grid item xs={12} key={guide.id}>
                <GuideCard guide={guide} />
              </Grid>
            ))}
          </Grid>
        )
      )}

      {tab === 1 && (
        savedExpData.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <BookmarkBorderOutlinedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">No saved adventures yet</Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              Save adventures you're dreaming about.
            </Typography>
            <Button variant="contained" color="primary" href="/book">Explore Adventures</Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
            {savedExpData.map(exp => (
              <ExperienceCard key={exp.id} experience={exp} />
            ))}
          </Box>
        )
      )}

      {tab === 2 && (
        bookings.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <FlagOutlinedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">No trips booked yet</Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={2}>
              Your upcoming and past adventures will appear here.
            </Typography>
            <Button variant="contained" color="primary" href="/book">Book Your Adventure</Button>
          </Box>
        ) : (
          bookings.map((booking, idx) => (
            <Box key={idx} sx={{ p: 2, bgcolor: '#FFFFFF', borderRadius: 3, border: '1px solid rgba(16,42,67,0.12)', mb: 2 }}>
              <Typography variant="body2" fontWeight={700}>{booking.guideName}</Typography>
              <Typography variant="caption" color="text.secondary">{booking.route} · {booking.date}</Typography>
              <Typography variant="caption" display="block" color="secondary.main" fontWeight={600} sx={{ mt: 0.5 }}>
                {booking.status}
              </Typography>
            </Box>
          ))
        )
      )}
    </Container>
  );
}
