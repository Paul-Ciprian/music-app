import './App.css';
import { useState, useRef, useEffect } from 'react';

function App() {
  const [user, setUser] = useState(localStorage.getItem('user_id') || null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);

  const [view, setView] = useState('home');
  const [homeData, setHomeData] = useState([]);
  const [playlistData, setPlaylistData] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  
  const [downloads, setDownloads] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [favoriteTitles, setFavoriteTitles] = useState([]); 
  
  const [customPlaylists, setCustomPlaylists] = useState({});
  const [currentCustomPlaylist, setCurrentCustomPlaylist] = useState(null);
  
  const [showModal, setShowModal] = useState(false);
  const [songToAdd, setSongToAdd] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  const [activeQueue, setActiveQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(null);
  const [currentSongUrl, setCurrentSongUrl] = useState(null);
  const [loadingUrl, setLoadingUrl] = useState(null);
  
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [volume, setVolume] = useState(1);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasCountedHistory, setHasCountedHistory] = useState(false);
  
  const [showQueue, setShowQueue] = useState(false); 
  const [lyrics, setLyrics] = useState([]);
  const [isLyricsLoading, setIsLyricsLoading] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('history'); 
  const [themeColor, setThemeColor] = useState(localStorage.getItem('themeColor') || '#1db954'); 
  const [historyData, setHistoryData] = useState([]);

  const [downloadedTitles, setDownloadedTitles] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [dailyMixes, setDailyMixes] = useState([]);

  const audioRef = useRef(null);
  const availableColors = ['#1db954', '#1d70b9', '#b91d1d', '#8a1db9', '#e8a317', '#e8177d'];

  // --- NOU: Funcția care sincronizează datele în Cloud ---
  const syncToCloud = async (updates) => {
    if (!user) return;
    try {
        const payload = {
            user_id: user,
            history: updates.history || JSON.parse(localStorage.getItem('listeningHistory') || '{}'),
            playlists: updates.playlists || customPlaylists,
            favorites: updates.favorites || favorites,
            theme: updates.theme || themeColor
        };
        await fetch('https://music-app-10id.onrender.com/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (e) { console.error("Eroare la sincronizare", e); }
  };

  const handleAuth = async (type) => {
    try {
        const res = await fetch(`https://music-app-10id.onrender.com/api/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            setUser(data.user);
            localStorage.setItem('user_id', data.user);
            setEmail('');
            setPassword('');
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert("Nu ne-am putut conecta la server.");
    }
  };

  const handleLogout = () => {
      setUser(null);
      localStorage.removeItem('user_id');
      localStorage.removeItem('listeningHistory');
      setFavorites([]);
      setFavoriteTitles([]);
      setCustomPlaylists({});
      setShowSettings(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault(); 
        if (audioRef.current) {
          if (audioRef.current.paused) audioRef.current.play();
          else audioRef.current.pause();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!user) return; 

    const fetchInitialData = async () => {
      try {
        // --- NOU: Preluăm datele din Cloud la logare ---
        const syncRes = await fetch(`https://music-app-10id.onrender.com/api/sync/${user}`);
        const syncData = await syncRes.json();
        if (syncData.status === 'success') {
            const db = syncData.data;
            if (db.history) localStorage.setItem('listeningHistory', JSON.stringify(db.history));
            if (db.theme) { setThemeColor(db.theme); localStorage.setItem('themeColor', db.theme); }
            if (db.playlists) setCustomPlaylists(db.playlists);
            if (db.favorites) { setFavorites(db.favorites); setFavoriteTitles(db.favorites.map(s => s.title)); }
        }

        const resHome = await fetch('https://music-app-10id.onrender.com/api/home');
        const dataHome = await resHome.json();
        if (dataHome.status === 'success') setHomeData(dataHome.categories);

        const resLocal = await fetch('https://music-app-10id.onrender.com/api/local_library');
        const dataLocal = await resLocal.json();
        if (dataLocal.status === 'success') setDownloadedTitles(dataLocal.data.map(s => s.title));
        
        const savedRecents = JSON.parse(localStorage.getItem('recentSearches') || '[]');
        setRecentSearches(savedRecents);

        const history = JSON.parse(localStorage.getItem('listeningHistory') || '{}');
        const sortedHistory = Object.values(history).sort((a, b) => b.count - a.count);
        const topArtists = [...new Set(sortedHistory.map(s => s.artist).filter(Boolean))].slice(0, 4);
        
        const mixes = topArtists.map((artist, idx) => ({
            id: `mix-${idx}`,
            title: `Daily Mix ${idx + 1}`,
            artist: `${artist} și alții`,
            searchQuery: `${artist} mix playlist`,
            thumbnail: sortedHistory.find(s => s.artist === artist)?.thumbnail || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&q=80'
        }));
        setDailyMixes(mixes);
      } catch (error) {
        console.error("Eroare la încărcarea datelor:", error);
      }
    };
    fetchInitialData();
  }, [view, user]);

  const handleSearch = async () => {
    if (!query) return;
    const response = await fetch('https://music-app-10id.onrender.com/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: query })
    });
    const data = await response.json();
    if (data.status === 'success') {
      setResults(data.results);
      setView('search');
    }
  };

  const loadDownloads = async () => {
    setView('downloads');
    try {
      const response = await fetch('https://music-app-10id.onrender.com/api/local_library');
      const data = await response.json();
      if (data.status === 'success') {
          setDownloads(data.data);
          setDownloadedTitles(data.data.map(s => s.title));
      }
    } catch (error) {
      alert("Nu mă pot conecta la server.");
      setView('home');
    }
  };

  const loadPlaylist = async (chartId) => {
    setView('playlist');
    setPlaylistData(null); 
    try {
      const response = await fetch(`https://music-app-10id.onrender.com/api/playlist/${chartId}`);
      const data = await response.json();
      if (data.status === 'success') setPlaylistData(data);
    } catch (error) {
      alert("Eroare de conexiune la server.");
      setView('home');
    }
  };

  const openCustomPlaylist = (name) => {
      setCurrentCustomPlaylist(name);
      setView('single_custom_playlist');
  };

  const handleToggleFavorite = async (song, e) => {
    if (e) e.stopPropagation();
    let newFavs = [...favorites];
    if (favoriteTitles.includes(song.title)) {
        newFavs = newFavs.filter(s => s.title !== song.title);
        setFavoriteTitles(favoriteTitles.filter(t => t !== song.title));
    } else {
        newFavs.push(song);
        setFavoriteTitles([...favoriteTitles, song.title]);
    }
    setFavorites(newFavs);
    syncToCloud({ favorites: newFavs }); // Sincronizare la click
  };

  const handleOfflineToggle = async (song, e) => {
      if (e) e.stopPropagation();
      if (downloadedTitles.includes(song.title)) {
          await fetch('https://music-app-10id.onrender.com/api/delete_local', { 
              method: 'POST', 
              headers: { 'Content-Type': 'application/json' }, 
              body: JSON.stringify({ title: song.title }) 
          });
          setDownloadedTitles(prev => prev.filter(t => t !== song.title));
          setDownloads(prev => prev.filter(s => s.title !== song.title));
      } else {
          let targetUrl = song.url;
          if (!targetUrl) {
              const searchRes = await fetch('https://music-app-10id.onrender.com/api/search', { 
                  method: 'POST', 
                  headers: { 'Content-Type': 'application/json' }, 
                  body: JSON.stringify({ query: `${song.title} ${song.artist}` }) 
              });
              const searchData = await searchRes.json();
              if (searchData.status === 'success' && searchData.results.length > 0) targetUrl = searchData.results[0].url;
          }
          if (targetUrl) {
              await fetch('https://music-app-10id.onrender.com/api/download', { 
                  method: 'POST', 
                  headers: { 'Content-Type': 'application/json' }, 
                  body: JSON.stringify({ url: targetUrl, title: song.title }) 
              });
              setDownloadedTitles(prev => [...prev, song.title]);
          }
      }
  };

  const handleOpenModal = (song, e) => {
    if (e) e.stopPropagation();
    setSongToAdd(song);
    setShowModal(true);
  };

  const handleCreateNewPlaylist = async () => {
      if (!newPlaylistName) return;
      const newPlaylists = { ...customPlaylists, [newPlaylistName]: [] };
      setCustomPlaylists(newPlaylists);
      syncToCloud({ playlists: newPlaylists });
      setNewPlaylistName('');
  };

  const handleAddSongToPlaylist = async (playlistName) => {
      const updatedList = [...(customPlaylists[playlistName] || []), songToAdd];
      const newPlaylists = { ...customPlaylists, [playlistName]: updatedList };
      setCustomPlaylists(newPlaylists);
      syncToCloud({ playlists: newPlaylists });
      alert(`Melodia a fost adăugată în ${playlistName}!`);
      setShowModal(false);
  };

  const saveToHistory = (song) => {
    let history = JSON.parse(localStorage.getItem('listeningHistory') || '{}');
    const key = `${song.artist} - ${song.title}`;
    if (!history[key]) history[key] = { ...song, count: 1 };
    else history[key].count += 1;
    localStorage.setItem('listeningHistory', JSON.stringify(history));
    syncToCloud({ history: history });
  };

  const openSettings = () => {
      const history = JSON.parse(localStorage.getItem('listeningHistory') || '{}');
      const sortedHistory = Object.values(history).sort((a, b) => b.count - a.count);
      setHistoryData(sortedHistory);
      setShowSettings(true);
  };

  const changeTheme = (color) => {
      setThemeColor(color);
      localStorage.setItem('themeColor', color);
      syncToCloud({ theme: color });
  };

  const prefetchQueue = async (queue, startIndex) => {
    const nextSong = queue[startIndex + 1];
    if (!nextSong || downloadedTitles.includes(nextSong.title) || nextSong.stream_url) return;
    
    try {
        let targetUrl = nextSong.url;
        if (!targetUrl) {
            const searchRes = await fetch('https://music-app-10id.onrender.com/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `${nextSong.title} ${nextSong.artist}` }) });
            const searchData = await searchRes.json();
            if (searchData.status === 'success' && searchData.results.length > 0) {
                targetUrl = searchData.results[0].url;
                nextSong.url = targetUrl;
                nextSong.thumbnail = searchData.results[0].thumbnail;
            }
        }
        if (targetUrl) {
            const streamRes = await fetch('https://music-app-10id.onrender.com/api/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: targetUrl }) });
            const streamData = await streamRes.json();
            if (streamData.status === 'success') {
                nextSong.stream_url = streamData.stream_url; 
            }
        }
    } catch (e) { console.error(e); }
  };

  const loadLyrics = async () => {
    if (currentIndex === null || !activeQueue[currentIndex]) return;
    setView('lyrics');
    setLyrics([]);
    setIsLyricsLoading(true);
    const song = activeQueue[currentIndex];

    try {
        const res = await fetch('https://music-app-10id.onrender.com/api/lyrics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: song.title, artist: song.artist })
        });
        const data = await res.json();
        
        if (data.status === 'success' && data.data.syncedLyrics) {
            const lines = data.data.syncedLyrics.split('\n');
            const parsedLyrics = [];
            lines.forEach(line => {
                const match = line.match(/\[(\d{2}):(\d{2}(?:\.\d+)?)\](.*)/);
                if (match) {
                    parsedLyrics.push({ time: parseInt(match[1]) * 60 + parseFloat(match[2]), text: match[3].trim() });
                }
            });
            setLyrics(parsedLyrics.filter(l => l.text !== ''));
        } else if (data.status === 'success' && data.data.plainLyrics) {
             setLyrics([{ time: 0, text: "Avem doar varianta nesincronizată:" }, ...data.data.plainLyrics.split('\n').map(l => ({time: 0, text: l}))]);
        } else {
            setLyrics([{ time: 0, text: "Versurile nu au fost găsite." }]);
        }
    } catch (err) {
        setLyrics([{ time: 0, text: "Eroare la preluarea versurilor." }]);
    }
    setIsLyricsLoading(false);
  };

  useEffect(() => {
      if (view === 'lyrics' && activeQueue[currentIndex]) loadLyrics();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  useEffect(() => {
      setHasCountedHistory(false);
  }, [currentIndex]);

  useEffect(() => {
      if (progress > 60 && !hasCountedHistory && currentIndex !== null && activeQueue[currentIndex]) {
          saveToHistory(activeQueue[currentIndex]);
          setHasCountedHistory(true);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  const generateSmartQueue = async (currentSong) => {
    const history = JSON.parse(localStorage.getItem('listeningHistory') || '{}');
    const historyList = Object.values(history).sort((a, b) => b.count - a.count);
    const artistHistory = historyList.filter(s => (s.artist && s.artist.includes(currentSong.artist)) || (currentSong.artist && currentSong.artist.includes(s.artist))).slice(0, 3);
    const searchRes = await fetch('https://music-app-10id.onrender.com/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `${currentSong.artist} ${currentSong.title} mix` }) });
    const searchData = await searchRes.json();
    let mixSongs = [];
    if (searchData.status === 'success') mixSongs = searchData.results.filter(s => s.title !== currentSong.title).slice(0, 7);
    let smartQueue = [...artistHistory, ...mixSongs];
    smartQueue = smartQueue.filter((v, i, a) => a.findIndex(v2 => (v2.title === v.title)) === i);
    return smartQueue;
  };

  const playMix = async (mix) => {
    setView('playlist');
    setPlaylistData(null); 
    try {
        const res = await fetch('https://music-app-10id.onrender.com/api/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: mix.searchQuery })
        });
        const data = await res.json();
        if (data.status === 'success') {
            setPlaylistData({ playlist_name: mix.title, date: "Creat special pentru tine", total_songs: data.results.length, songs: data.results });
        }
    } catch (error) { alert("Eroare la generarea mixului."); setView('home'); }
  };

  const playSong = async (queue, index) => {
    const song = queue[index];
    setActiveQueue(queue);
    setCurrentIndex(index);
    setLoadingUrl(song.title); 

    if (queue === results) {
        let recents = JSON.parse(localStorage.getItem('recentSearches') || '[]');
        recents = recents.filter(s => s.title !== song.title); 
        recents.unshift(song); 
        recents = recents.slice(0, 10); 
        localStorage.setItem('recentSearches', JSON.stringify(recents));
        setRecentSearches(recents);
    }

    try {
        const checkRes = await fetch('https://music-app-10id.onrender.com/api/check_local', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: song.title }) });
        const checkData = await checkRes.json();

        if (checkData.status === 'found') {
            setCurrentSongUrl(`https://music-app-10id.onrender.com/api/play/${encodeURIComponent(checkData.title)}`);
            setIsPlaying(true); setLoadingUrl(null); prefetchQueue(queue, index); return; 
        }

        if (song.stream_url) {
            setCurrentSongUrl(song.stream_url);
            setIsPlaying(true); setLoadingUrl(null); prefetchQueue(queue, index); return;
        }

        let targetUrl = song.url;
        if (!targetUrl) {
            const searchRes = await fetch('https://music-app-10id.onrender.com/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: `${song.title} ${song.artist}` }) });
            const searchData = await searchRes.json();
            if (searchData.status === 'success' && searchData.results.length > 0) {
                targetUrl = searchData.results[0].url;
                queue[index].thumbnail = searchData.results[0].thumbnail; 
            } else {
                setLoadingUrl(null); alert("Melodia nu a fost găsită."); return;
            }
        }

        const response = await fetch('https://music-app-10id.onrender.com/api/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: targetUrl }) });
        const data = await response.json();
        if (data.status === 'success') {
          queue[index].stream_url = data.stream_url; 
          setCurrentSongUrl(data.stream_url);
          setIsPlaying(true);
        }
    } catch (error) { console.error("Eroare:", error); } finally { setLoadingUrl(null); prefetchQueue(queue, index); }
  };

  const playNext = async () => { 
      if (currentIndex === null || activeQueue.length === 0) return;
      if (isShuffle) {
          let nextIdx = Math.floor(Math.random() * activeQueue.length);
          playSong(activeQueue, nextIdx);
      } else if (currentIndex < activeQueue.length - 1) {
          playSong(activeQueue, currentIndex + 1);
      } else {
          setLoadingUrl("smart-queue");
          const newSongs = await generateSmartQueue(activeQueue[currentIndex]);
          if (newSongs.length > 0) {
              const newQueue = [...activeQueue, ...newSongs];
              setActiveQueue(newQueue);
              playSong(newQueue, currentIndex + 1);
          }
          setLoadingUrl(null);
      }
  };

  const playPrevious = () => { if (currentIndex !== null && currentIndex > 0) playSong(activeQueue, currentIndex - 1); };
  
  const togglePlay = () => {
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
  };

  const formatTime = (time) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const renderSongRow = (song, index, currentList) => (
    <div key={index} className="song-item" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', marginBottom: '8px', backgroundColor: '#181818', borderRadius: '6px' }}>
      <div className="song-info" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <span className="song-title" style={{ color: 'white', fontSize: '16px', fontWeight: '600' }}>
          {song.rank ? `${song.rank}. ` : ''}{song.title}
        </span>
        <span className="song-artist" style={{ color: '#b3b3b3', fontSize: '14px', marginTop: '4px' }}>
          {song.artist}
        </span>
      </div>

      <div className="song-actions" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        
        <button onClick={(e) => handleOfflineToggle(song, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: downloadedTitles.includes(song.title) ? themeColor : '#b3b3b3', display: 'flex', alignItems: 'center' }} title={downloadedTitles.includes(song.title) ? "Șterge din PC" : "Descarcă offline"}>
          {downloadedTitles.includes(song.title) ? (
            <svg height="20" width="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          ) : (
            <svg height="20" width="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          )}
        </button>

        <button onClick={(e) => handleToggleFavorite(song, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: favoriteTitles.includes(song.title) ? themeColor : '#b3b3b3' }} title="Favorite">
          {favoriteTitles.includes(song.title) ? (
            <svg height="20" width="20" viewBox="0 0 24 24" fill={themeColor}><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          ) : (
            <svg height="20" width="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          )}
        </button>

        <button onClick={(e) => handleOpenModal(song, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#b3b3b3', display: 'flex', alignItems: 'center' }} title="Adaugă în Playlist">
          <svg height="22" width="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
        </button>

        <button className="play-btn" onClick={() => playSong(currentList, index)} disabled={loadingUrl === song.title} style={{ marginLeft: '10px', background: 'transparent', color: 'white', border: '1px solid white', borderRadius: '20px', padding: '6px 16px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
          {loadingUrl === song.title ? '⏳' : '▶ Redă'}
        </button>
      </div>
    </div>
  );

  // --- ECRANUL DE LOGARE ---
  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#121212', color: 'white' }}>
        <div style={{ backgroundColor: '#181818', padding: '40px', borderRadius: '10px', width: '350px', textAlign: 'center', border: `1px solid ${themeColor}` }}>
          <h1 style={{ marginBottom: '30px', color: themeColor }}>MusicApp</h1>
          <h2 style={{ marginBottom: '20px' }}>{isLoginView ? 'Intră în cont' : 'Creare Cont'}</h2>
          
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '15px', borderRadius: '5px', border: 'none', backgroundColor: '#333', color: 'white', boxSizing: 'border-box' }} />
          <input type="password" placeholder="Parola" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', borderRadius: '5px', border: 'none', backgroundColor: '#333', color: 'white', boxSizing: 'border-box' }} />
          
          <button onClick={() => handleAuth(isLoginView ? 'login' : 'signup')} style={{ width: '100%', padding: '12px', backgroundColor: themeColor, color: 'white', border: 'none', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
            {isLoginView ? 'Logare' : 'Înregistrare'}
          </button>
          
          <p style={{ marginTop: '20px', fontSize: '14px', color: '#b3b3b3', cursor: 'pointer' }} onClick={() => setIsLoginView(!isLoginView)}>
            {isLoginView ? 'Nu ai cont? Creează unul.' : 'Ai deja cont? Loghează-te.'}
          </p>
        </div>
      </div>
    );
  }

  // --- ECRANUL PRINCIPAL ---
  return (
    <div className={`app-container ${showQueue ? 'show-queue' : ''}`}>
      <div className="sidebar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid #282828' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: themeColor, color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '18px' }}>
                {email ? email.charAt(0).toUpperCase() : 'U'}
            </div>
            <div style={{ overflow: 'hidden' }}>
                <div style={{ color: 'white', fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {email ? email.split('@')[0] : 'Utilizator'}
                </div>
                <div style={{ color: '#b3b3b3', fontSize: '12px' }}>Cont gratuit</div>
            </div>
        </div>

        <h2 style={{ fontSize: '14px', color: '#b3b3b3', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '15px' }}>Meniu</h2>
        <ul>
          <li onClick={() => setView('home')} style={{ cursor: 'pointer', color: view === 'home' ? 'white' : '#b3b3b3', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold' }}>
            <svg height="24" width="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Acasă
          </li>
          <li onClick={() => setView('search')} style={{ cursor: 'pointer', color: view === 'search' ? 'white' : '#b3b3b3', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold' }}>
            <svg height="24" width="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            Caută
          </li>
          <li onClick={loadDownloads} style={{ cursor: 'pointer', color: view === 'downloads' ? 'white' : '#b3b3b3', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold' }}>
            <svg height="24" width="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Descărcări
          </li>
          <li onClick={() => setView('favorites')} style={{ cursor: 'pointer', color: view === 'favorites' ? 'white' : '#b3b3b3', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold' }}>
            <svg height="24" width="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            Favoritele Tale
          </li>
          <li onClick={() => setView('my_playlists')} style={{ cursor: 'pointer', color: (view === 'my_playlists' || view === 'single_custom_playlist') ? 'white' : '#b3b3b3', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold' }}>
            <svg height="24" width="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
            Playlisturile Mele
          </li>
          <li onClick={openSettings} style={{ cursor: 'pointer', color: '#b3b3b3', marginTop: '30px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 'bold' }}>
             <svg height="24" width="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
             Setări
          </li>
        </ul>
      </div>
      
      <div className="main-content" style={{ background: `linear-gradient(to bottom, ${themeColor}, #121212)` }}>
        {view === 'home' && (
          <div className="home-view">
            
            {dailyMixes.length > 0 && (
                <div className="home-category">
                    <h2 style={{ fontSize: '24px', color: 'white', marginBottom: '20px' }}>Made For You</h2>
                    <div className="cards-grid">
                        {dailyMixes.map((mix, index) => (
                            <div key={index} className="song-card" onClick={() => playMix(mix)}>
                                <img src={mix.thumbnail} alt={mix.title} />
                                <div className="card-title" style={{ color: themeColor }}>{mix.title}</div>
                                <div className="card-artist">{mix.artist}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="home-category">
                <h2 style={{ fontSize: '24px', color: 'white', marginBottom: '20px' }}>Topuri Globale</h2>
                {homeData.length === 0 ? <p style={{color: '#b3b3b3'}}>Se încarcă topurile...</p> : null}
                <div className="cards-grid">
                    {homeData.map((category, index) => (
                    <div key={index} className="song-card" onClick={() => loadPlaylist(category.id)}>
                        <img src={category.thumbnail} alt={category.title} />
                        <div className="card-title">{category.title}</div>
                    </div>
                    ))}
                </div>
            </div>

          </div>
        )}

        {view === 'lyrics' && (
           <div className="lyrics-view">
              {isLyricsLoading ? (
                  <p style={{color: themeColor, fontSize: '20px'}}>Se caută versurile...</p>
              ) : (
                  lyrics.map((line, index) => {
                      const isActive = progress >= line.time && (!lyrics[index + 1] || progress < lyrics[index + 1].time);
                      return (
                          <div key={index} className={`lyric-line ${isActive ? 'active' : ''}`}>
                              {line.text}
                          </div>
                      )
                  })
              )}
           </div>
        )}

        {view === 'playlist' && (
          <div className="playlist-view">
            {!playlistData ? (
                <p style={{color: '#b3b3b3'}}>Se preiau datele live de pe Billboard...</p>
            ) : (
                <>
                <h1>{playlistData.playlist_name}</h1>
                <p style={{color: '#b3b3b3', marginBottom: '20px'}}>{playlistData.date} • {playlistData.total_songs} melodii</p>
                <div className="results-list">
                    {playlistData.songs.map((song, index) => renderSongRow(song, index, playlistData.songs))}
                </div>
                </>
            )}
          </div>
        )}

        {view === 'search' && (
          <>
            <h1>Caută Muzică</h1>
            <div className="search-section">
              <input 
                type="text" 
                placeholder="Numele melodiei..." 
                value={query} 
                onChange={(e) => {
                    setQuery(e.target.value);
                    if(e.target.value === '') setResults([]); 
                }} 
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()} 
              />
              <button onClick={handleSearch} style={{ backgroundColor: themeColor, color: 'white' }}>Caută</button>
            </div>
            
            {results.length > 0 ? (
                <div className="results-list">
                  {results.map((song, index) => renderSongRow(song, index, results))}
                </div>
            ) : (
                <>
                    {recentSearches.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h2 style={{ color: 'white', fontSize: '20px', margin: 0 }}>Căutări recente</h2>
                                <button onClick={() => { localStorage.removeItem('recentSearches'); setRecentSearches([]); }} style={{ background: 'transparent', border: 'none', color: '#b3b3b3', cursor: 'pointer', fontWeight: 'bold' }}>Șterge istoricul</button>
                            </div>
                            <div className="cards-grid">
                                {recentSearches.map((song, idx) => (
                                    <div key={idx} className="song-card" onClick={() => playSong([song], 0)} style={{ position: 'relative' }}>
                                        <img src={song.thumbnail || 'https://via.placeholder.com/150'} alt="cover" style={{ borderRadius: '50%', width: '120px', height: '120px', margin: '0 auto 16px', display: 'block', objectFit: 'cover' }} />
                                        <div className="card-title" style={{ textAlign: 'center' }}>{song.title}</div>
                                        <div className="card-artist" style={{ textAlign: 'center' }}>{song.artist}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
          </>
        )}

        {view === 'downloads' && (
          <>
            <h1>Descărcări Locale</h1>
            <p style={{ color: '#b3b3b3', marginBottom: '20px' }}>Melodiile salvate fizic pe calculatorul tău.</p>
            <div className="results-list">
              {downloads.map((song, index) => renderSongRow(song, index, downloads))}
            </div>
          </>
        )}

        {view === 'favorites' && (
          <>
            <h1>Favoritele Tale</h1>
            <p style={{ color: '#b3b3b3', marginBottom: '20px' }}>Melodiile apreciate (salvate în cloud).</p>
            <div className="results-list">
              {favorites.map((song, index) => renderSongRow(song, index, favorites))}
            </div>
          </>
        )}

        {view === 'my_playlists' && (
          <>
            <h1>Playlisturile Mele</h1>
            <p style={{ color: '#b3b3b3', marginBottom: '20px' }}>Aici sunt mixurile pe care le-ai creat.</p>
            {Object.keys(customPlaylists).length === 0 ? (
               <p style={{ color: '#b3b3b3' }}>Nu ai creat niciun playlist încă. Apasă pe ➕ din dreptul unei melodii.</p>
            ) : (
               <div className="cards-grid">
                   {Object.keys(customPlaylists).map((plName, idx) => (
                   <div key={idx} className="song-card" onClick={() => openCustomPlaylist(plName)}>
                       <div style={{ backgroundColor: '#333', width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', borderRadius: '5px' }}>🎵</div>
                       <div className="card-title" style={{ marginTop: '10px' }}>{plName}</div>
                   </div>
                   ))}
               </div>
            )}
          </>
        )}

        {view === 'single_custom_playlist' && currentCustomPlaylist && (
          <>
            <h1>{currentCustomPlaylist}</h1>
            <p style={{ color: '#b3b3b3', marginBottom: '20px' }}>{customPlaylists[currentCustomPlaylist].length} melodii salvate</p>
            <div className="results-list">
              {customPlaylists[currentCustomPlaylist].map((song, index) => renderSongRow(song, index, customPlaylists[currentCustomPlaylist]))}
            </div>
          </>
        )}
      </div>

      {showQueue && (
        <div className="queue-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', margin: 0 }}>Queue</h2>
                <button onClick={() => setShowQueue(false)} style={{ background: 'transparent', border: 'none', color: '#b3b3b3', cursor: 'pointer', fontSize: '16px' }}>✕</button>
            </div>
            
            {currentIndex !== null && activeQueue[currentIndex] && (
                <>
                    <h3 style={{ fontSize: '16px', color: 'white', marginBottom: '15px' }}>Now playing</h3>
                    <div className="queue-item" style={{ marginBottom: '20px', cursor: 'default' }}>
                        <img src={activeQueue[currentIndex].thumbnail || 'https://via.placeholder.com/40'} alt="cover" style={{ width: '40px', height: '40px', borderRadius: '4px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ color: themeColor, fontWeight: 'bold', fontSize: '14px' }}>{activeQueue[currentIndex].title}</span>
                            <span style={{ color: '#b3b3b3', fontSize: '12px' }}>{activeQueue[currentIndex].artist}</span>
                        </div>
                    </div>
                </>
            )}

            {activeQueue.length > 0 && currentIndex !== null && currentIndex < activeQueue.length - 1 && (
                <>
                    <h3 style={{ fontSize: '16px', color: '#b3b3b3', marginBottom: '15px' }}>Next</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {activeQueue.slice(currentIndex + 1).map((song, idx) => {
                            const originalIndex = currentIndex + 1 + idx;
                            return (
                                <div key={originalIndex} className="queue-item" onClick={() => playSong(activeQueue, originalIndex)}>
                                    <img src={song.thumbnail || 'https://via.placeholder.com/40'} alt="cover" style={{ width: '40px', height: '40px', borderRadius: '4px' }} />
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ color: 'white', fontSize: '14px', fontWeight: '500' }}>{song.title}</span>
                                        <span style={{ color: '#b3b3b3', fontSize: '12px' }}>{song.artist}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </>
            )}
        </div>
      )}

      {showSettings && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 2000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ backgroundColor: '#282828', padding: '24px', borderRadius: '10px', width: '400px', border: '1px solid #444' }}>
              
              <div className="settings-tabs">
                  <span className={settingsTab === 'history' ? 'active' : ''} onClick={() => setSettingsTab('history')}>Istoric Ascultări</span>
                  <span className={settingsTab === 'custom' ? 'active' : ''} onClick={() => setSettingsTab('custom')}>Customizare</span>
              </div>

              {settingsTab === 'history' && (
                  <div className="history-list">
                      {historyData.length === 0 ? <p style={{color: '#b3b3b3'}}>Nu ai ascultat nicio piesă.</p> : null}
                      <ul>
                          {historyData.map((item, idx) => (
                              <li key={idx}>
                                  <div>
                                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.title}</div>
                                      <div style={{ fontSize: '12px', color: '#b3b3b3' }}>{item.artist}</div>
                                  </div>
                                  <div style={{ color: themeColor, fontSize: '14px', fontWeight: 'bold' }}>x{item.count}</div>
                              </li>
                          ))}
                      </ul>
                  </div>
              )}

              {settingsTab === 'custom' && (
                  <div>
                      <p style={{ color: 'white', fontWeight: 'bold' }}>Alege Culoarea Temei</p>
                      <p style={{ color: '#b3b3b3', fontSize: '12px' }}>Alege o culoare pentru a personaliza aspectul playerului tău.</p>
                      <div className="theme-colors">
                          {availableColors.map(color => (
                              <div key={color} className="color-btn" style={{ backgroundColor: color, border: themeColor === color ? '2px solid white' : 'none' }} onClick={() => changeTheme(color)} />
                          ))}
                      </div>
                  </div>
              )}

              <button onClick={handleLogout} style={{ marginTop: '20px', width: '100%', padding: '10px', backgroundColor: '#b91d1d', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Deconectare
              </button>

              <button onClick={() => setShowSettings(false)} style={{ marginTop: '10px', width: '100%', padding: '12px', backgroundColor: 'transparent', color: 'white', border: '1px solid #444', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>Închide</button>
            </div>
          </div>
      )}

      {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ backgroundColor: '#282828', padding: '20px', borderRadius: '10px', width: '300px', border: '1px solid #444' }}>
              <h3 style={{ color: 'white', marginTop: 0, textAlign: 'center' }}>Adaugă în Playlist</h3>
              <p style={{ color: '#b3b3b3', textAlign: 'center', fontSize: '12px' }}>{songToAdd?.title}</p>
              
              <ul style={{ listStyle: 'none', padding: 0, color: 'white', maxHeight: '200px', overflowY: 'auto' }}>
                {Object.keys(customPlaylists).map(pl => (
                  <li key={pl} style={{ padding: '10px 0', borderBottom: '1px solid #444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }} onClick={() => handleAddSongToPlaylist(pl)}>
                        {pl}
                  </li>
                ))}
              </ul>
              
              <div style={{ display: 'flex', marginTop: '20px' }}>
                <input type="text" placeholder="Nume playlist nou..." value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} style={{ flex: 1, padding: '8px', borderRadius: '5px', border: 'none', outline: 'none', backgroundColor: '#444', color: 'white' }} />
                <button onClick={handleCreateNewPlaylist} style={{ marginLeft: '5px', padding: '8px 12px', backgroundColor: themeColor, color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Creare</button>
              </div>
              <button onClick={() => setShowModal(false)} style={{ marginTop: '15px', width: '100%', padding: '10px', backgroundColor: 'transparent', color: 'white', border: '1px solid #444', borderRadius: '5px', cursor: 'pointer' }}>Anulează</button>
            </div>
          </div>
      )}
      
      <div className="player" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        
        <div className="now-playing" style={{ width: '30%', display: 'flex', alignItems: 'center', gap: '15px' }}>
          {currentIndex !== null && activeQueue[currentIndex] && (
            <>
              {activeQueue[currentIndex].thumbnail ? (
                <img src={activeQueue[currentIndex].thumbnail} alt="Copertă" className="now-playing-img" />
              ) : (
                <div className="now-playing-img" style={{ backgroundColor: '#282828', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>🎵</div>
              )}
              <div className="now-playing-info" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <div>
                  <div className="now-playing-title">{activeQueue[currentIndex].title}</div>
                  <div className="now-playing-artist">{activeQueue[currentIndex].artist}</div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={(e) => handleToggleFavorite(activeQueue[currentIndex], e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: favoriteTitles.includes(activeQueue[currentIndex].title) ? themeColor : '#b3b3b3', display: 'flex', alignItems: 'center' }}>
                        {favoriteTitles.includes(activeQueue[currentIndex].title) ? (
                            <svg height="20" width="20" viewBox="0 0 24 24" fill={themeColor}><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                        ) : (
                            <svg height="20" width="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        )}
                    </button>

                    <button onClick={(e) => handleOpenModal(activeQueue[currentIndex], e)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#b3b3b3', display: 'flex', alignItems: 'center' }} title="Adaugă în Playlist">
                        <svg height="20" width="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="16"></line>
                            <line x1="8" y1="12" x2="16" y2="12"></line>
                        </svg>
                    </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="player-controls-center" style={{ width: '40%' }}>
          <div className="buttons-row">
            <button className="control-btn" onClick={() => setIsShuffle(!isShuffle)} style={{ color: isShuffle ? themeColor : '#b3b3b3' }}>
                <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.151.922a.75.75 0 1 0-1.06 1.06L13.109 3H11.16a3.75 3.75 0 0 0-2.873 1.34l-6.173 7.356A2.25 2.25 0 0 1 .39 12.5H0V14h.391a3.75 3.75 0 0 0 2.873-1.34l6.173-7.356a2.25 2.25 0 0 1 1.724-.804h1.947l-1.017 1.018a.75.75 0 0 0 1.06 1.06L15.98 3.75 13.15.922zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 0 0 .39 3.5z"/><path d="m7.5 10.723.98-1.167 1.737 2.071A2.25 2.25 0 0 0 11.936 12.5H13.88l-1.018-1.018a.75.75 0 1 1 1.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 1 1-1.06-1.06L13.88 14h-1.943a3.75 3.75 0 0 1-2.874-1.34l-1.563-1.86z"/></svg>
            </button>
            <button className="control-btn" onClick={playPrevious}>
              <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3.3 1a.7.7 0 0 1 .7.7v5.15l9.95-5.744a.7.7 0 0 1 1.05.606v12.575a.7.7 0 0 1-1.05.607L4 9.149V14.3a.7.7 0 0 1-.7.7H1.7a.7.7 0 0 1-.7-.7V1.7a.7.7 0 0 1 .7-.7h1.6z"></path></svg>
            </button>
            <button className="control-btn play-circle" onClick={togglePlay}>
              {isPlaying ? (
                <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z"></path></svg>
              ) : (
                <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z"></path></svg>
              )}
            </button>
            <button className="control-btn" onClick={playNext}>
              <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor"><path d="M12.7 1a.7.7 0 0 0-.7.7v5.15L2.05 1.107A.7.7 0 0 0 1 1.712v12.575a.7.7 0 0 0 1.05.607L12 9.149V14.3a.7.7 0 0 0 .7.7h1.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-1.6z"></path></svg>
            </button>
            <button className="control-btn" onClick={() => setIsLooping(!isLooping)} style={{ color: isLooping ? themeColor : '#b3b3b3' }}>
              <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 4.75A3.75 3.75 0 0 1 3.75 1h8.5A3.75 3.75 0 0 1 16 4.75v5a3.75 3.75 0 0 1-3.75 3.75H9.81l1.018 1.018a.75.75 0 1 1-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 1 1 1.06 1.06L9.811 12h2.439a2.25 2.25 0 0 0 2.25-2.25v-5a2.25 2.25 0 0 0-2.25-2.25h-8.5A2.25 2.25 0 0 0 1.5 4.75v5A2.25 2.25 0 0 0 3.75 12H5v1.5H3.75A3.75 3.75 0 0 1 0 9.75v-5z"></path></svg>
            </button>
          </div>
          
          <div className="progress-row">
            <span className="time-text">{formatTime(progress)}</span>
            <input type="range" min="0" max={duration || 100} value={progress} onChange={(e) => { audioRef.current.currentTime = e.target.value; setProgress(e.target.value); }} className="progress-bar" style={{ '--progress-pct': `${duration ? (progress / duration) * 100 : 0}%` }} />
            <span className="time-text">{formatTime(duration)}</span>
          </div>

          {currentSongUrl && (
            <audio ref={audioRef} src={currentSongUrl} autoPlay loop={isLooping} onEnded={playNext}
              onTimeUpdate={() => setProgress(audioRef.current.currentTime)}
              onLoadedMetadata={() => setDuration(audioRef.current.duration)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              style={{ display: 'none' }}
            />
          )}
        </div>

        <div className="player-right-controls" style={{ width: '30%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '15px', paddingRight: '20px' }}>
            
            <button className="control-btn" onClick={() => view === 'lyrics' ? setView('home') : loadLyrics()} title="Lyrics" style={{ color: view === 'lyrics' ? themeColor : '#b3b3b3' }}>
               <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 12.5a4.5 4.5 0 0 0 4.5-4.5V3.5a4.5 4.5 0 0 0-9 0V8A4.5 4.5 0 0 0 8 12.5zm3-9a3 3 0 0 1-6 0V8a3 3 0 0 1 6 0V3.5zM7.25 14.938v-1.55a6 6 0 0 1-4.75-5.888h1.5a4.5 4.5 0 1 0 8 0h1.5a6 6 0 0 1-4.75 5.888v1.55h-1.5z"></path>
               </svg>
            </button>

            <button className="control-btn" onClick={() => setShowQueue(!showQueue)} title="Queue" style={{ color: showQueue ? themeColor : '#b3b3b3' }}>
               <svg role="presentation" height="16" width="16" aria-hidden="true" viewBox="0 0 16 16" fill="currentColor">
                   <path d="M15 15H1v-1.5h14V15zm0-4.5H1V9h14v1.5zm-14-7A2.5 2.5 0 0 1 3.5 1h9a2.5 2.5 0 0 1 0 5h-9A2.5 2.5 0 0 1 1 3.5zm2.5-1a1 1 0 0 0 0 2h9a1 1 0 1 0 0-2h-9z"></path>
               </svg>
            </button>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{color: '#b3b3b3', display: 'flex', alignItems: 'center'}}>
                    <svg role="presentation" height="16" width="16" aria-label="Volum" viewBox="0 0 16 16" fill="currentColor"><path d="M9.741.85a.75.75 0 0 1 .375.65v13a.75.75 0 0 1-1.125.65l-6.925-4a3.642 3.642 0 0 1-1.33-4.967 3.639 3.639 0 0 1 1.33-1.332l6.925-4a.75.75 0 0 1 .75 0zm-6.924 5.3a2.139 2.139 0 0 0 0 3.7l5.8 3.35V2.8l-5.8 3.35zm8.683 4.29V5.56a2.75 2.75 0 0 1 0 4.88z"></path><path d="M11.5 13.614a5.752 5.752 0 0 0 0-11.228v1.55a4.252 4.252 0 0 1 0 8.127v1.55z"></path></svg>
                </span>
                <div className="volume-wrapper">
                    <input type="range" min="0" max="1" step="0.01" value={volume} className="volume-bar"
                        style={{ '--volume-pct': `${volume * 100}%` }}
                        onChange={(e) => { const newVol = parseFloat(e.target.value); setVolume(newVol); if(audioRef.current) audioRef.current.volume = newVol; }} 
                    />
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}

export default App;