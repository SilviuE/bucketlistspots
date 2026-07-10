import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

function load(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch { return fallback; }
}

function save(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function buildFallbackUser(authUser) {
  return {
    id: authUser.id,
    name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
    email: authUser.email,
    role: authUser.user_metadata?.role || authUser.app_metadata?.role || 'traveller',
    avatar: '',
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => load('bls_user', null));
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [savedGuides, setSavedGuides] = useState(() => load('bls_saved_guides', []));
  const [savedExperiences, setSavedExperiences] = useState(() => load('bls_saved_experiences', []));
  const [bookings, setBookings] = useState(() => load('bls_bookings', []));
  const [bucketList, setBucketList] = useState(() => load('bls_bucket_list', []));
  const [journalEntries, setJournalEntries] = useState(() => load('bls_journal', []));
  const [galleryImages, setGalleryImages] = useState(() => load('bls_gallery', []));
  const [scoutedGuides, setScoutedGuides] = useState(() => load('bls_scouted_guides', []));
  const [ambassadorCommissions, setAmbassadorCommissions] = useState(() => load('bls_ambassador_commissions', []));
  const [guideEarnings, setGuideEarnings] = useState(() => load('bls_guide_earnings', []));
  const [guideBookings, setGuideBookings] = useState(() => load('bls_guide_bookings', []));
  const [guideAvailability, setGuideAvailability] = useState(() => load('bls_guide_availability', []));

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        supabase.from('users').select('*').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data) {
              setUser(data);
              save('bls_user', data);
            } else {
              const fallback = buildFallbackUser(session.user);
              setUser(fallback);
              save('bls_user', fallback);
            }
          });
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user) {
        supabase.from('users').select('*').eq('id', session.user.id).single()
          .then(({ data }) => {
            if (data) {
              setUser(data);
              save('bls_user', data);
            } else {
              const fallback = buildFallbackUser(session.user);
              setUser(fallback);
              save('bls_user', fallback);
            }
          });
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        save('bls_user', null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const register = useCallback(async (userData) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          name: userData.name,
          role: userData.role || 'traveller',
        },
      },
    });
    if (authError) return { error: authError.message };
    if (!authData.user) return { error: 'Sign up failed' };

    // Wait for the database trigger to create the profile
    await new Promise(r => setTimeout(r, 1000));

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profile) {
      const role = userData.role || 'traveller';
      if (profile.role !== role) {
        await supabase.from('users').update({ role }).eq('id', authData.user.id);
        profile.role = role;
      }
      setUser(profile);
      save('bls_user', profile);
    } else {
      const fallback = buildFallbackUser(authData.user);
      fallback.role = userData.role || 'traveller';
      setUser(fallback);
      save('bls_user', fallback);
    }
    return { success: true };
  }, []);

  const login = useCallback(async (email, password) => {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) return { error: authError.message };
    if (!authData.user) return { error: 'Login failed' };

    const role = authData.user.user_metadata?.role || authData.user.app_metadata?.role || 'traveller';

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profile) {
      if (profile.role !== role) {
        await supabase.from('users').update({ role }).eq('id', authData.user.id);
        profile.role = role;
      }
      setUser(profile);
      save('bls_user', profile);
    } else {
      const fallback = buildFallbackUser(authData.user);
      fallback.role = role;
      setUser(fallback);
      save('bls_user', fallback);
    }
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    save('bls_user', null);
  }, []);

  const updateProfile = useCallback(async (updates) => {
    if (!user) return;
    const { error } = await supabase.from('users').update(updates).eq('id', user.id);
    if (!error) {
      const updated = { ...user, ...updates };
      setUser(updated);
      save('bls_user', updated);
    }
    return { error: error?.message };
  }, [user]);

  const toggleSavedGuide = useCallback((guideId) => {
    setSavedGuides(prev => { const next = prev.includes(guideId) ? prev.filter(id => id !== guideId) : [...prev, guideId]; save('bls_saved_guides', next); return next; });
  }, []);

  const toggleSavedExperience = useCallback((expId) => {
    setSavedExperiences(prev => { const next = prev.includes(expId) ? prev.filter(id => id !== expId) : [...prev, expId]; save('bls_saved_experiences', next); return next; });
  }, []);

  const addBooking = useCallback((booking) => {
    setBookings(prev => { const next = [booking, ...prev]; save('bls_bookings', next); return next; });
    if (user?.role === 'guide') {
      setGuideBookings(prev => { const next = [...prev, { ...booking, status: 'pending' }]; save('bls_guide_bookings', next); return next; });
    }
  }, [user]);

  const confirmGuideBooking = useCallback((bookingId) => {
    setGuideBookings(prev => { const next = prev.map(b => b.id === bookingId ? { ...b, status: 'confirmed' } : b); save('bls_guide_bookings', next); return next; });
  }, []);

  const completeGuideBooking = useCallback((bookingId) => {
    setGuideBookings(prev => { const next = prev.map(b => b.id === bookingId ? { ...b, status: 'completed' } : b); save('bls_guide_bookings', next); return next; });
    setGuideEarnings(prev => {
      const booking = guideBookings.find(b => b.id === bookingId);
      if (!booking) return prev;
      const next = [...prev, { amount: booking.total * 0.8, date: new Date().toISOString(), bookingId }];
      save('bls_guide_earnings', next); return next;
    });
  }, [guideBookings]);

  const addBucketListItem = useCallback((item) => {
    setBucketList(prev => { const next = [{ id: 'bl_' + Date.now(), createdAt: new Date().toISOString(), ...item }, ...prev]; save('bls_bucket_list', next); return next; });
  }, []);

  const updateBucketListItem = useCallback((id, updates) => {
    setBucketList(prev => { const next = prev.map(i => i.id === id ? { ...i, ...updates } : i); save('bls_bucket_list', next); return next; });
  }, []);

  const deleteBucketListItem = useCallback((id) => {
    setBucketList(prev => { const next = prev.filter(i => i.id !== id); save('bls_bucket_list', next); return next; });
  }, []);

  const addJournalEntry = useCallback((entry) => {
    setJournalEntries(prev => { const next = [{ id: 'je_' + Date.now(), createdAt: new Date().toISOString(), ...entry }, ...prev]; save('bls_journal', next); return next; });
  }, []);

  const updateJournalEntry = useCallback((id, updates) => {
    setJournalEntries(prev => { const next = prev.map(e => e.id === id ? { ...e, ...updates } : e); save('bls_journal', next); return next; });
  }, []);

  const deleteJournalEntry = useCallback((id) => {
    setJournalEntries(prev => { const next = prev.filter(e => e.id !== id); save('bls_journal', next); return next; });
  }, []);

  const addGalleryImage = useCallback((image) => {
    setGalleryImages(prev => { const next = [{ id: 'gi_' + Date.now(), createdAt: new Date().toISOString(), ...image }, ...prev]; save('bls_gallery', next); return next; });
  }, []);

  const deleteGalleryImage = useCallback((id) => {
    setGalleryImages(prev => { const next = prev.filter(i => i.id !== id); save('bls_gallery', next); return next; });
  }, []);

  const addScoutedGuide = useCallback((scoutData) => {
    setScoutedGuides(prev => { const next = [{ id: 'sg_' + Date.now(), nominatedAt: new Date().toISOString(), ...scoutData, status: 'nominated' }, ...prev]; save('bls_scouted_guides', next); return next; });
  }, []);

  const updateScoutedGuide = useCallback((id, updates) => {
    setScoutedGuides(prev => { const next = prev.map(s => s.id === id ? { ...s, ...updates } : s); save('bls_scouted_guides', next); return next; });
  }, []);

  const addCommission = useCallback((commission) => {
    setAmbassadorCommissions(prev => { const next = [{ id: 'com_' + Date.now(), ...commission }, ...prev]; save('bls_ambassador_commissions', next); return next; });
  }, []);

  const updateAvailability = useCallback((availability) => {
    setGuideAvailability(availability);
    save('bls_guide_availability', availability);
  }, []);

  const isGuideSaved = useCallback((id) => savedGuides.includes(id), [savedGuides]);
  const isExperienceSaved = useCallback((id) => savedExperiences.includes(id), [savedExperiences]);
  const isLoggedIn = !!user;

  return (
    <AuthContext.Provider value={{
      user, isLoggedIn, authLoading, savedGuides, savedExperiences, bookings,
      bucketList, journalEntries, galleryImages,
      scoutedGuides, ambassadorCommissions,
      guideEarnings, guideBookings, guideAvailability,
      register, login, logout, updateProfile,
      toggleSavedGuide, toggleSavedExperience, isGuideSaved, isExperienceSaved, addBooking,
      addBucketListItem, updateBucketListItem, deleteBucketListItem,
      addJournalEntry, updateJournalEntry, deleteJournalEntry,
      addGalleryImage, deleteGalleryImage,
      addScoutedGuide, updateScoutedGuide,
      addCommission, updateAvailability,
      confirmGuideBooking, completeGuideBooking,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
