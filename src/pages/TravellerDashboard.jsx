import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Container, Typography, Paper, Button, TextField, Chip, IconButton, Grid, Avatar, MenuItem,
  LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, Divider, Alert,
} from '@mui/material';
import SEO from '../components/SEO';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ShareIcon from '@mui/icons-material/Share';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import FlagIcon from '@mui/icons-material/Flag';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BookOnlineIcon from '@mui/icons-material/BookOnline';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import BookIcon from '@mui/icons-material/Book';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../context/AuthContext';
import guides from '../data/guides';

const statusColors = { dreaming: '#9E9E9E', planning: '#2A9D8F', booked: '#E05D3A', completed: '#4CAF50' };
const statusIcons = { dreaming: FlagIcon, planning: EditIcon, booked: BookOnlineIcon, completed: CheckCircleIcon };

const popularDestinations = [
  { name: 'Climb Kilimanjaro', image: '/images/uhuru-peak.jpg', desc: 'Tanzania — 5,895m' },
  { name: 'Patagonia Ice Trek', image: '/images/glacier-view.jpg', desc: 'Chile — Southern Patagonian Ice Field' },
  { name: 'Everest Base Camp', image: 'https://images.unsplash.com/photo-1486911278844-a81c6e1a0e4a?w=400&h=300&fit=crop', desc: 'Nepal — 5,364m' },
  { name: 'Machu Picchu', image: 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=400&h=300&fit=crop', desc: 'Peru — Inca Trail' },
];

export default function TravellerDashboard() {
  const navigate = useNavigate();
  const { user, logout, bucketList, addBucketListItem, updateBucketListItem, deleteBucketListItem, bookings, journalEntries, galleryImages } = useAuth();
  const [tab, setTab] = useState('overview');
  const [openNew, setOpenNew] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ title: '', destination: '', targetDate: '', status: 'dreaming', notes: '' });

  const handleLogout = () => { logout(); navigate('/'); };

  const openNewDialog = () => { setForm({ title: '', destination: '', targetDate: '', status: 'dreaming', notes: '' }); setEditId(null); setOpenNew(true); };

  const openEditDialog = (item) => { setForm({ title: item.title, destination: item.destination, targetDate: item.targetDate || '', status: item.status, notes: item.notes || '' }); setEditId(item.id); setOpenNew(true); };

  const handleSave = () => {
    if (!form.title) return;
    if (editId) { updateBucketListItem(editId, form); } else { addBucketListItem(form); }
    setOpenNew(false);
  };

  const handleShare = (title) => {
    const text = `I'm planning to ${title} with BucketListSpots! Join me.`;
    if (navigator.share) { navigator.share({ title: 'My Bucket List', text }); }
    else { navigator.clipboard.writeText(text); }
  };

  const tabs = [
    { key: 'overview', label: 'Overview', icon: FlightTakeoffIcon },
    { key: 'bucketlist', label: 'Bucket List', icon: FlagIcon },
    { key: 'bookings', label: 'My Trips', icon: BookOnlineIcon },
    { key: 'journal', label: 'Journal', icon: BookIcon },
    { key: 'gallery', label: 'Gallery', icon: PhotoLibraryIcon },
  ];

  const completedCount = bucketList.filter(i => i.status === 'completed').length;
  const bookedCount = bucketList.filter(i => i.status === 'booked').length;

  return (
    <Container maxWidth="sm" sx={{ px: 2, pt: 2, pb: 4 }}>
      <SEO title="Traveller Dashboard" description="Manage your bucket list, bookings, and travel journal on BucketListSpots." path="/dashboard" />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h1" sx={{ fontSize: '22px' }}>
            {user?.name || 'Traveller'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.email}
          </Typography>
        </Box>
        <IconButton onClick={handleLogout} sx={{ color: 'text.secondary' }}>
          <LogoutIcon />
        </IconButton>
      </Box>

      <Paper elevation={0} sx={{ p: 1.5, mb: 2, bgcolor: '#102A43', borderRadius: 3, display: 'flex', justifyContent: 'space-around', color: '#FFF' }}>
        {[
          { label: 'Dreaming', count: bucketList.filter(i => i.status === 'dreaming').length, color: '#9E9E9E' },
          { label: 'Planning', count: bucketList.filter(i => i.status === 'planning').length, color: '#2A9D8F' },
          { label: 'Booked', count: bookedCount, color: '#E05D3A' },
          { label: 'Done', count: completedCount, color: '#4CAF50' },
        ].map(s => (
          <Box key={s.label} sx={{ textAlign: 'center' }}>
            <Typography fontWeight={800} sx={{ fontSize: 22, color: s.color }}>{s.count}</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>{s.label}</Typography>
          </Box>
        ))}
      </Paper>

      <Box sx={{ display: 'flex', gap: 0.5, overflowX: 'auto', mb: 2, pb: 0.5, '&::-webkit-scrollbar': { display: 'none' } }}>
        {tabs.map(t => (
          <Chip key={t.key} label={t.label} icon={<t.icon sx={{ fontSize: 16 }} />}
            onClick={() => setTab(t.key)}
            color={tab === t.key ? 'secondary' : 'default'}
            variant={tab === t.key ? 'filled' : 'outlined'}
            size="small" />
        ))}
      </Box>

      {tab === 'overview' && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="h2">Your Journey</Typography>
            <Button size="small" variant="contained" color="primary" startIcon={<AddIcon />}
              onClick={openNewDialog} sx={{ fontSize: 12 }}>
              New Dream
            </Button>
          </Box>

          {bucketList.length === 0 ? (
            <Paper elevation={0} sx={{ p: 3, mb: 2, textAlign: 'center', border: '2px dashed rgba(16,42,67,0.15)', borderRadius: 3, bgcolor: '#F4F5F7' }}>
              <FlagIcon sx={{ fontSize: 48, color: 'rgba(16,42,67,0.2)', mb: 1 }} />
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Your bucket list is empty
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Start dreaming about your next adventure
              </Typography>
              <Button variant="contained" color="primary" size="small" startIcon={<AddIcon />} onClick={openNewDialog}>
                Add Your First Dream
              </Button>
            </Paper>
          ) : (
            <>
              {bucketList.slice(0, 3).map(item => {
                const StatusIcon = statusIcons[item.status];
                return (
                  <Paper key={item.id} elevation={0} sx={{ p: 1.5, mb: 1, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: `${statusColors[item.status]}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <StatusIcon sx={{ color: statusColors[item.status], fontSize: 20 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>{item.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{item.destination} · {item.targetDate || 'No date set'}</Typography>
                    </Box>
                    <Chip label={item.status} size="small" sx={{ fontSize: 10, bgcolor: `${statusColors[item.status]}20`, color: statusColors[item.status], fontWeight: 700 }} />
                  </Paper>
                );
              })}
              {bucketList.length > 3 && (
                <Button variant="text" size="small" fullWidth onClick={() => setTab('bucketlist')}>
                  View all {bucketList.length} items
                </Button>
              )}
            </>
          )}

          {bookings.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h2" mb={1.5}>Upcoming Trips</Typography>
              {bookings.slice(0, 2).map((b, i) => (
                <Paper key={i} elevation={0} sx={{ p: 1.5, mb: 1, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2, display: 'flex', gap: 1.5 }}>
                  <Avatar src={guides.find(g => g.id === b.guideId)?.photo || ''} sx={{ width: 40, height: 40 }} />
                  <Box>
                    <Typography variant="body2" fontWeight={700}>{b.route || 'Adventure'}</Typography>
                    <Typography variant="caption" color="text.secondary">with {b.guideName} · {b.date}</Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}

          <Box sx={{ mt: 3 }}>
            <Typography variant="h2" mb={1.5}>Inspiration</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
              {popularDestinations.map(d => (
                <Paper key={d.name} elevation={0} sx={{ minWidth: 180, borderRadius: 3, overflow: 'hidden', cursor: 'pointer' }}
                  onClick={() => { setForm({ ...form, title: d.name, destination: d.desc }); setOpenNew(true); }}>
                  <Box sx={{ height: 100, backgroundImage: `url(${d.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                  <Box sx={{ p: 1 }}>
                    <Typography variant="body2" fontWeight={700}>{d.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{d.desc}</Typography>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Box>
        </>
      )}

      {tab === 'bucketlist' && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h2">My Bucket List</Typography>
            <Button size="small" variant="contained" color="primary" startIcon={<AddIcon />} onClick={openNewDialog}>
              Add Dream
            </Button>
          </Box>

          {bucketList.length === 0 ? (
            <Paper elevation={0} sx={{ p: 4, textAlign: 'center', border: '2px dashed rgba(16,42,67,0.15)', borderRadius: 3, bgcolor: '#F4F5F7' }}>
              <Typography variant="body2" color="text.secondary">Your bucket list is empty. Start dreaming!</Typography>
            </Paper>
          ) : (
            bucketList.map(item => {
              const StatusIcon = statusIcons[item.status];
              const progress = item.status === 'dreaming' ? 10 : item.status === 'planning' ? 40 : item.status === 'booked' ? 70 : 100;
              return (
                <Paper key={item.id} elevation={0} sx={{ p: 1.5, mb: 1.5, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: `${statusColors[item.status]}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <StatusIcon sx={{ color: statusColors[item.status], fontSize: 22 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box>
                          <Typography variant="body2" fontWeight={700}>{item.title}</Typography>
                          <Typography variant="caption" color="text.secondary">{item.destination}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.2 }}>
                          <IconButton size="small" onClick={() => openEditDialog(item)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                          <IconButton size="small" onClick={() => handleShare(item.title)}><ShareIcon sx={{ fontSize: 16 }} /></IconButton>
                          <IconButton size="small" onClick={() => deleteBucketListItem(item.id)}><DeleteIcon sx={{ fontSize: 16, color: '#E05D3A' }} /></IconButton>
                        </Box>
                      </Box>
                      <Box sx={{ mt: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Box sx={{ flex: 1 }}><LinearProgress variant="determinate" value={progress} sx={{ height: 4, borderRadius: 2, bgcolor: 'rgba(16,42,67,0.08)', '& .MuiLinearProgress-bar': { bgcolor: statusColors[item.status] } }} /></Box>
                        <Chip label={item.status} size="small" sx={{ fontSize: 10, bgcolor: `${statusColors[item.status]}20`, color: statusColors[item.status], fontWeight: 700 }} />
                      </Box>
                      {item.notes && <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{item.notes}</Typography>}
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                        {['dreaming', 'planning', 'booked', 'completed'].map(s => (
                          <Chip key={s} label={s} size="small" variant={item.status === s ? 'filled' : 'outlined'}
                            onClick={() => updateBucketListItem(item.id, { status: s })}
                            sx={{ fontSize: 9, height: 22, cursor: 'pointer' }} />
                        ))}
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              );
            })
          )}
        </>
      )}

      {tab === 'bookings' && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h2">My Trips</Typography>
          </Box>
          {bookings.length === 0 ? (
            <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: '#F4F5F7' }}>
              <BookOnlineIcon sx={{ fontSize: 48, color: 'rgba(16,42,67,0.2)', mb: 1 }} />
              <Typography variant="body2" color="text.secondary" gutterBottom>No trips booked yet</Typography>
              <Button variant="contained" color="primary" size="small" onClick={() => navigate('/book')}>Browse Adventures</Button>
            </Paper>
          ) : (
            bookings.map((b, i) => (
              <Paper key={i} elevation={0} sx={{ p: 1.5, mb: 1, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                  <Avatar src={guides.find(g => g.id === b.guideId)?.photo || ''} sx={{ width: 44, height: 44 }} />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={700}>{b.route || 'Adventure'}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">Guide: {b.guideName}</Typography>
                    <Typography variant="caption" color="text.secondary">{b.date} · {b.travelers} traveler(s) · ${b.deposit} deposit</Typography>
                  </Box>
                  <Chip label={b.status || 'Confirmed'} size="small" color={b.status?.includes('Paid') ? 'success' : 'default'} sx={{ fontSize: 10 }} />
                </Box>
              </Paper>
            ))
          )}
        </>
      )}

      {tab === 'journal' && (
        <JournalView user={user} />
      )}

      {tab === 'gallery' && (
        <GalleryView />
      )}

      <Dialog open={openNew} onClose={() => setOpenNew(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editId ? 'Edit Dream' : 'New Dream'}</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} sx={{ mb: 2, mt: 1 }} />
          <TextField fullWidth label="Destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="Target Date" type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
          <TextField select fullWidth label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} sx={{ mb: 2 }}>
            {['dreaming', 'planning', 'booked', 'completed'].map(s => (<MenuItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</MenuItem>))}
          </TextField>
          <TextField fullWidth label="Notes" multiline rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpenNew(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleSave} disabled={!form.title}>
            {editId ? 'Update' : 'Add to Bucket List'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

function JournalView({ user }) {
  const { journalEntries, addJournalEntry, deleteJournalEntry } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', location: '', date: new Date().toISOString().split('T')[0], image: '' });

  const handleAdd = () => {
    if (!form.title) return;
    addJournalEntry({ ...form, author: user?.name || 'Anonymous' });
    setForm({ title: '', content: '', location: '', date: new Date().toISOString().split('T')[0], image: '' });
    setOpen(false);
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h2">Travel Journal</Typography>
        <Button size="small" variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
          New Entry
        </Button>
      </Box>

      {journalEntries.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: '#F4F5F7' }}>
          <BookIcon sx={{ fontSize: 48, color: 'rgba(16,42,67,0.2)', mb: 1 }} />
          <Typography variant="body2" color="text.secondary" gutterBottom>No journal entries yet</Typography>
          <Typography variant="caption" color="text.secondary" display="block" mb={2}>Document your adventures and memories</Typography>
          <Button variant="contained" color="primary" size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Write First Entry</Button>
        </Paper>
      ) : (
        journalEntries.map(entry => (
          <Paper key={entry.id} elevation={0} sx={{ p: 1.5, mb: 1.5, border: '1px solid rgba(16,42,67,0.08)', borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
              <Typography variant="body2" fontWeight={700}>{entry.title}</Typography>
              <IconButton size="small" onClick={() => deleteJournalEntry(entry.id)}><DeleteIcon sx={{ fontSize: 16, color: '#E05D3A' }} /></IconButton>
            </Box>
            {entry.image && <Box component="img" src={entry.image} sx={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 2, mb: 1 }} />}
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>{entry.content}</Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Chip label={entry.location || 'No location'} size="small" variant="outlined" sx={{ fontSize: 10 }} />
              <Chip label={entry.date} size="small" variant="outlined" sx={{ fontSize: 10 }} />
            </Box>
          </Paper>
        ))
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Journal Entry</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} sx={{ mb: 2, mt: 1 }} />
          <TextField fullWidth label="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} sx={{ mb: 2 }} />
          <TextField fullWidth label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} InputLabelProps={{ shrink: true }} sx={{ mb: 2 }} />
          <TextField fullWidth label="Image URL (optional)" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} sx={{ mb: 2 }} placeholder="Paste an image link..." />
          <TextField fullWidth label="Your Story" multiline rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleAdd} disabled={!form.title}>Save Entry</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function GalleryView() {
  const { galleryImages, addGalleryImage, deleteGalleryImage } = useAuth();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');

  const handleAdd = () => {
    if (!url) return;
    addGalleryImage({ url, caption });
    setUrl(''); setCaption(''); setOpen(false);
  };

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h2">Photo Gallery</Typography>
        <Button size="small" variant="contained" color="primary" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Add Photo</Button>
      </Box>

      {galleryImages.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: '#F4F5F7' }}>
          <PhotoLibraryIcon sx={{ fontSize: 48, color: 'rgba(16,42,67,0.2)', mb: 1 }} />
          <Typography variant="body2" color="text.secondary" gutterBottom>No photos yet</Typography>
          <Button variant="contained" color="primary" size="small" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Add First Photo</Button>
        </Paper>
      ) : (
        <Grid container spacing={1}>
          {galleryImages.map(img => (
            <Grid item xs={4} key={img.id}>
              <Box sx={{ position: 'relative', borderRadius: 2, overflow: 'hidden', cursor: 'pointer', '&:hover .del': { opacity: 1 } }}>
                <Box component="img" src={img.url} sx={{ width: '100%', height: 120, objectFit: 'cover' }} />
                <IconButton className="del" size="small" onClick={() => deleteGalleryImage(img.id)}
                  sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(0,0,0,0.5)', color: '#FFF', opacity: 0, transition: '0.2s', width: 24, height: 24 }}>
                  <DeleteIcon sx={{ fontSize: 14 }} />
                </IconButton>
                {img.caption && <Typography variant="caption" sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, p: 0.5, bgcolor: 'rgba(0,0,0,0.5)', color: '#FFF', fontSize: 9 }}>{img.caption}</Typography>}
              </Box>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Photo</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Image URL" value={url} onChange={(e) => setUrl(e.target.value)} sx={{ mb: 2, mt: 1 }} placeholder="Paste an image link..." />
          <TextField fullWidth label="Caption (optional)" value={caption} onChange={(e) => setCaption(e.target.value)} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleAdd} disabled={!url}>Add Photo</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
