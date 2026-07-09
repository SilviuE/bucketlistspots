import { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Card, CardMedia, CardContent, IconButton, CircularProgress, Paper, Chip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { supabase } from '../lib/supabaseClient';

export default function UpdateFeed({ userId, authorRole, showCreate = false, onCreated }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, [userId, authorRole]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (userId) params.set('user_id', userId);
      if (authorRole) params.set('author_role', authorRole);
      const res = await fetch(`/api/posts?${params}`);
      if (res.ok) setPosts(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const createPost = async () => {
    if (!content.trim()) return;
    setPosting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ content: content.trim(), image_url: imageUrl || null, video_url: videoUrl || null }),
      });
      if (!res.ok) throw new Error('Failed to post');
      setContent('');
      setImageUrl('');
      setVideoUrl('');
      await fetchPosts();
      onCreated?.();
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  };

  const deletePost = async (id) => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      await fetch(`/api/posts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <CircularProgress size={20} sx={{ display: 'block', mx: 'auto', my: 2 }} />;

  return (
    <Box>
      {showCreate && (
        <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: '#F8FAFB', borderRadius: 2, border: '1px solid #E2E8F0' }}>
          <TextField fullWidth multiline rows={2} placeholder="Share an update..." value={content}
            onChange={e => setContent(e.target.value)} inputProps={{ maxLength: 600 }}
            helperText={`${content.length}/600`} sx={{ mb: 1.5 }} />
          <TextField fullWidth size="small" placeholder="Image URL (optional)" value={imageUrl}
            onChange={e => setImageUrl(e.target.value)} sx={{ mb: 1 }} />
          <TextField fullWidth size="small" placeholder="YouTube video URL (optional)" value={videoUrl}
            onChange={e => setVideoUrl(e.target.value)} sx={{ mb: 1.5 }} />
          <Button variant="contained" color="primary" onClick={createPost} disabled={posting || !content.trim()}>
            {posting ? <CircularProgress size={18} /> : 'Post'}
          </Button>
        </Paper>
      )}
      {posts.length === 0 && !loading && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>No updates yet.</Typography>
      )}
      {posts.map(post => (
        <Card key={post.id} elevation={0} sx={{ mb: 1.5, borderRadius: 2, border: '1px solid #E2E8F0' }}>
          <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                {post.author_name && (
                  <Typography variant="caption" fontWeight={600}>{post.author_name}</Typography>
                )}
                <Chip label={post.author_role} size="small" sx={{
                  height: 18, fontSize: 10,
                  bgcolor: post.author_role === 'guide' ? '#2A9D8F' : '#E9C46A',
                  color: '#FFF',
                }} />
                <Typography variant="caption" color="text.disabled">
                  {new Date(post.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </Typography>
              </Box>
              {showCreate && (
                <IconButton size="small" onClick={() => deletePost(post.id)} sx={{ color: '#E05D3A' }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{post.content}</Typography>
          </CardContent>
          {post.image_url && (
            <CardMedia component="img" image={post.image_url} alt={post.content ? `Photo: ${post.content.slice(0, 80)}` : 'Update photo'}
              sx={{ maxHeight: 300, objectFit: 'cover' }} />
          )}
          {post.video_url && (
            <Box sx={{ px: 2, pb: 1.5 }}>
              <Button size="small" variant="outlined" href={post.video_url} target="_blank" rel="noopener">
                Watch Video
              </Button>
            </Box>
          )}
        </Card>
      ))}
    </Box>
  );
}