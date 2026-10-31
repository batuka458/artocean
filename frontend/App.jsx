import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bookmark, BriefcaseBusiness, Check, ChevronDown, CircleHelp, Compass, LayoutGrid, LoaderCircle, LogOut, Menu, PanelsTopLeft, Plus, RefreshCw, Search, SlidersHorizontal, Sparkles, Users, X } from 'lucide-react';
import { loadPublicData, request, session } from './api.js';
import { categories, demoArtists, demoArtworks, demoEvents } from './data.js';
import { ArtistCard, ArtworkCard, Avatar, Brand, EmptyState, EventCard, Hero, Modal } from './components.jsx';
import { ApplicationForm, AuthForm, ProfileForm, UploadForm } from './forms.jsx';
import { ArtistDetail, ArtworkDetail, EventDetail, PrivatePage } from './pages.jsx';

const pageTitles = { discover: 'Discover', artists: 'Artists', opportunities: 'Opportunities', portfolio: 'My portfolio', saved: 'Saved collections' };
const pageDescriptions = {
  discover: 'A little curiosity. A whole ocean of possibility.',
  artists: 'Meet the people making the world a little more interesting.',
  opportunities: 'Your next creative chapter might start right here.',
  portfolio: 'Your work, your story, your own little corner of the ocean.',
  saved: 'Keep the things that move you, all in one place.',
};

function currentPage() {
  const page = window.location.hash.replace(/^#\/?/, '').split('?')[0];
  return Object.hasOwn(pageTitles, page) ? page : 'discover';
}

function readSaved() {
  try {
    const stored = JSON.parse(localStorage.getItem('artocean.saved') || '[]');
    return Array.isArray(stored) ? stored.filter((item) => item && item.id != null && typeof item.title === 'string' && item.artist && typeof item.artist.full_name === 'string') : [];
  } catch { return []; }
}

export default function App() {
  const [page, setPage] = useState(currentPage);
  const [tab, setTab] = useState('For you');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All artwork');
  const [sort, setSort] = useState('newest');
  const [mediaFilter, setMediaFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [saved, setSaved] = useState(readSaved);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState({ artists: [], artworks: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [demo, setDemo] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const searchInput = useRef(null);
  const toastTimer = useRef(null);
  const loadVersion = useRef(0);
  const accountMenu = useRef(null);

  const notify = useCallback((message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), 5000);
  }, []);
  const closeModal = useCallback(() => setModal(null), []);
  const refresh = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const result = await loadPublicData();
      if (version !== loadVersion.current) return;
      setData(result); setDemo(false);
      if (result.portfolioError) notify('Some portfolios couldn’t load. You can retry using the connection button.');
    } catch {
      if (version !== loadVersion.current) return;
      setData({ artists: demoArtists, artworks: demoArtworks, events: demoEvents }); setDemo(true);
    } finally { if (version === loadVersion.current) setLoading(false); }
  }, [notify]);

  useEffect(() => {
    refresh();
    const onHashChange = () => { setPage(currentPage()); setMobileMenu(false); setFiltersOpen(false); window.scrollTo({ top: 0 }); };
    const onKeyboard = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); searchInput.current?.focus(); }
      if (event.key === 'Escape') { setAccountOpen(false); setMobileMenu(false); setFiltersOpen(false); }
    };
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('keydown', onKeyboard);
    return () => { window.removeEventListener('hashchange', onHashChange); window.removeEventListener('keydown', onKeyboard); clearTimeout(toastTimer.current); loadVersion.current += 1; };
  }, [refresh]);

  useEffect(() => {
    if (!session.get()) return;
    let active = true;
    request('/auth/me').then(async (account) => {
      if (!active) return;
      setUser(account);
      try {
        const result = await request(account.role === 'artist' ? '/artist/profile' : '/organizer/profile');
        if (active) setProfile(result);
      } catch (failure) { if (active && ![403, 404].includes(failure.status)) notify(failure.message); }
    }).catch((failure) => { if (failure.status === 401) session.clear(); });
    return () => { active = false; };
  }, [notify]);

  useEffect(() => {
    const onClickOutside = (event) => { if (!accountMenu.current?.contains(event.target)) setAccountOpen(false); };
    document.addEventListener('pointerdown', onClickOutside);
    return () => document.removeEventListener('pointerdown', onClickOutside);
  }, []);

  useEffect(() => {
    const onExpired = () => { setUser(null); setProfile(null); closeModal(); notify('Your session has expired. Please sign in again to continue.'); };
    window.addEventListener('artocean:session-expired', onExpired);
    return () => window.removeEventListener('artocean:session-expired', onExpired);
  }, [closeModal, notify]);

  useEffect(() => {
    document.title = `${page === 'portfolio' && user?.role === 'organizer' ? 'My events' : pageTitles[page]} — Artocean`;
  }, [page, user]);

  const navigate = (destination) => {
    setQuery(''); setCategory('All artwork'); setMediaFilter('all'); setFiltersOpen(false); setMobileMenu(false); setAccountOpen(false);
    window.location.hash = `/${destination}`;
  };

  const toggleSave = (item) => {
    const exists = saved.some((entry) => entry.id === item.id);
    const next = exists ? saved.filter((entry) => entry.id !== item.id) : [...saved, item];
    setSaved(next);
    try { localStorage.setItem('artocean.saved', JSON.stringify(next)); }
    catch { notify('Saved for this visit. Your browser isn’t allowing persistent storage.'); return; }
    notify(exists ? 'Removed from your collection.' : 'A little inspiration, saved for later.');
  };

  const signIn = (mode = 'login') => { setAccountOpen(false); setModal({ type: 'auth', mode }); };
  const editProfile = () => { setAccountOpen(false); setModal({ type: 'profile' }); };
  const openArtwork = (item) => setModal({ type: 'artwork', item });
  const openArtist = (artist) => setModal({ type: 'artist', artist });
  const openEvent = (event) => setModal({ type: 'event', event });
  const openUpload = () => {
    if (!user) { signIn('register'); return; }
    if (!profile) { editProfile(); return; }
    setModal({ type: 'upload' });
  };

  async function onAuth(account) {
    setUser(account);
    try {
      const result = await request(account.role === 'artist' ? '/artist/profile' : '/organizer/profile');
      setProfile(result); closeModal(); notify('Welcome back. Let’s make something meaningful.');
    } catch (failure) {
      setProfile(null);
      if ([403, 404].includes(failure.status)) { setModal({ type: 'profile' }); notify('Welcome to Artocean. Let’s set up your profile.'); }
      else { closeModal(); notify(failure.message); }
    }
  }

  const textMatches = (values) => values.filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase());
  const artworks = useMemo(() => {
    const source = page === 'saved' ? saved : data.artworks;
    return source.filter((item) => {
      const searchable = [item.title, item.description, item.category, item.artist.full_name, item.artist.talent_skill, ...(item.ai_tags || [])].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(query.trim().toLowerCase())
        && (category === 'All artwork' || [item.category, item.artist.talent_skill, ...(item.ai_tags || [])].join(' ').toLowerCase().includes(category.toLowerCase()))
        && (mediaFilter === 'all' || (item.media_type || 'image') === mediaFilter);
    }).sort((first, second) => sort === 'title' ? first.title.localeCompare(second.title) : sort === 'oldest' ? (Date.parse(first.created_at) || 0) - (Date.parse(second.created_at) || 0) : (Date.parse(second.created_at) || 0) - (Date.parse(first.created_at) || 0));
  }, [data.artworks, page, saved, query, category, mediaFilter, sort]);
  const artists = data.artists.filter((artist) => textMatches([artist.full_name, artist.talent_skill, artist.location, artist.bio]) && (category === 'All artwork' || artist.talent_skill?.toLowerCase().includes(category.toLowerCase())));
  const events = data.events.filter((event) => textMatches([event.title, event.description]) && (eventFilter === 'all' || event.status === eventFilter)).sort((first, second) => (Date.parse(first.event_date) || Infinity) - (Date.parse(second.event_date) || Infinity));
  const isForYou = page === 'discover' && tab === 'For you' && !query.trim();
  const visibleEvents = isForYou ? events.filter((event) => event.status === 'open').slice(0, 3) : events;
  const showArtwork = page === 'saved' || (page === 'discover' && ['For you', 'Artwork'].includes(tab));
  const showArtists = page === 'artists' || (page === 'discover' && tab === 'Artists');
  const showEvents = page === 'opportunities' || (page === 'discover' && tab === 'Opportunities');
  const portfolioTitle = user?.role === 'organizer' ? 'My events' : 'My portfolio';
  const artworkProps = (item) => ({ item, saved: saved.some((entry) => entry.id === item.id), onSave: toggleSave, onOpen: openArtwork, onArtist: openArtist });

  function exploreArtwork() {
    setTab('Artwork'); setQuery(''); setCategory('All artwork');
    setTimeout(() => document.getElementById('discovery-feed')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  const modalTitle = modal ? ({ auth: 'Your creative community', profile: profile ? 'Edit your profile' : 'Make yourself at home', upload: user?.role === 'organizer' ? 'Post an opportunity' : 'Share your artwork', artwork: 'A closer look', artist: 'Meet the artist', event: 'Your next opportunity', apply: 'Make your next move', help: 'A space for your creativity' })[modal.type] : '';

  return <div className="app-shell">
    <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); document.getElementById('main-content')?.focus(); document.getElementById('main-content')?.scrollIntoView(); }}>Skip to content</a>
    {mobileMenu && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><Brand /><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileMenu(false)}><X size={20} /></button></div>
      <span className="brand-tagline">CREATE. CONNECT. GROW.</span>
      <div className="sidebar-section-label">EXPLORE YOUR OCEAN</div>
      <nav aria-label="Main navigation">
        {[['discover', Compass, 'Discover'], ['artists', Users, 'Artists'], ['opportunities', BriefcaseBusiness, 'Opportunities']].map(([destination, Icon, title]) => <a key={destination} href={`#/${destination}`} className={`nav-item ${page === destination ? 'active' : ''}`} aria-current={page === destination ? 'page' : undefined} onClick={() => { setMobileMenu(false); setQuery(''); }}><Icon size={19} strokeWidth={1.7} /><span>{title}</span>{page === destination && <span className="nav-active-dot" />}</a>)}
        <div className="sidebar-section-label your-space-label">YOUR SPACE</div>
        <a href="#/portfolio" className={`nav-item ${page === 'portfolio' ? 'active' : ''}`} aria-current={page === 'portfolio' ? 'page' : undefined} onClick={() => setMobileMenu(false)}><PanelsTopLeft size={19} strokeWidth={1.7} /><span>{portfolioTitle}</span>{page === 'portfolio' && <span className="nav-active-dot" />}</a>
        <a href="#/saved" className={`nav-item ${page === 'saved' ? 'active' : ''}`} aria-current={page === 'saved' ? 'page' : undefined} onClick={() => { setMobileMenu(false); setQuery(''); }}><Bookmark size={19} strokeWidth={1.7} /><span>Saved collections</span>{saved.length > 0 && <span className="nav-count">{saved.length}</span>}</a>
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-promo"><span className="promo-spark">✳</span><h3>Your art deserves<br />to be <span>out there.</span></h3><p>Share your work. Find your people.<br />See where it takes you.</p><button onClick={openUpload}>Make your mark <ArrowUpRight size={16} /></button></div><button className="sidebar-help" onClick={() => setModal({ type: 'help' })}><CircleHelp size={17} strokeWidth={1.6} />A little help & inspiration<ArrowUpRight size={14} /></button><div className="sidebar-copyright">© {new Date().getFullYear()} Artocean <span>Made for creatives.</span></div></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><button className="icon-button mobile-toggle" onClick={() => setMobileMenu(true)} aria-label="Open navigation" aria-expanded={mobileMenu}><Menu size={22} /></button><label className="global-search"><Search size={18} strokeWidth={1.7} /><input ref={searchInput} value={query} onChange={(event) => { setQuery(event.target.value); if (page === 'portfolio') { setTab('Artwork'); window.location.hash = '/discover'; } }} placeholder={page === 'artists' ? 'Find your kind of creative…' : page === 'opportunities' ? 'Find your next opportunity…' : 'Search art, artists, and a little inspiration…'} aria-label="Search current collection" />{query ? <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={15} /></button> : <kbd><span>Ctrl</span> K</kbd>}</label><div className="topbar-actions"><button className="icon-button topbar-help" onClick={() => setModal({ type: 'help' })} aria-label="Help and about Artocean"><CircleHelp size={20} strokeWidth={1.6} /></button><span className="topbar-divider" /><div className="account-wrapper" ref={accountMenu}>{user ? <><button className="account-button" onClick={() => setAccountOpen(!accountOpen)} aria-label="Open account menu" aria-expanded={accountOpen}><Avatar artist={profile || user} /><span>{profile?.full_name?.split(' ')[0] || profile?.company_name || 'My account'}</span><ChevronDown size={14} /></button>{accountOpen && <div className="account-dropdown"><span className="account-email">{user.email}</span><button onClick={editProfile}><PanelsTopLeft size={15} />{profile ? 'Edit profile' : 'Set up profile'}</button><button onClick={() => { session.clear(); setUser(null); setProfile(null); setAccountOpen(false); notify('You’re signed out. Your saved collection stays on this device.'); }}><LogOut size={15} />Sign out</button></div>}</> : <button className="sign-in-button" onClick={() => signIn()}>Sign in <ArrowUpRight size={15} /></button>} </div><button className="button button-primary header-upload" onClick={openUpload}><Plus size={17} /><span>{user?.role === 'organizer' ? 'Post opportunity' : 'Share your work'}</span></button></div></header>

      <main className="main-content" id="main-content" tabIndex={-1}>
        <div className="page-heading"><div><div className="page-title-line"><h1>{page === 'portfolio' ? portfolioTitle : pageTitles[page]}</h1>{page === 'discover' && <span className="page-spark"><Sparkles size={20} strokeWidth={1.4} /></span>}</div><p>{pageDescriptions[page]}</p></div><button className={`connection-status ${demo ? 'connection-preview' : ''}`} onClick={() => { if (!loading) refresh(); }} disabled={loading} title={demo ? 'Showing sample content. Click to retry the API connection.' : 'Refresh artists, artwork, and events from the API.'}>{loading ? <LoaderCircle className="spin" size={13} /> : <span />}{loading ? 'Finding inspiration' : demo ? 'Preview collection' : 'Connected'}{!loading && <RefreshCw size={12} />}</button></div>

        {page === 'discover' && <><Hero onExplore={exploreArtwork} onOpportunities={() => navigate('opportunities')} /><div className="discovery-tabs" id="discovery-feed" role="tablist" aria-label="Discovery content">{[['For you', Sparkles], ['Artwork', LayoutGrid], ['Artists', Users], ['Opportunities', BriefcaseBusiness]].map(([label, Icon]) => <button key={label} id={`tab-${label.replaceAll(' ', '-')}`} role="tab" aria-selected={tab === label} aria-controls="discovery-panel" tabIndex={tab === label ? 0 : -1} onClick={() => { setTab(label); setCategory('All artwork'); setFiltersOpen(false); }} onKeyDown={(event) => { if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const tabs = ['For you', 'Artwork', 'Artists', 'Opportunities']; const index = tabs.indexOf(tab); const next = event.key === 'Home' ? 0 : event.key === 'End' ? 3 : (index + (event.key === 'ArrowRight' ? 1 : 3)) % 4; setTab(tabs[next]); setCategory('All artwork'); document.getElementById(`tab-${tabs[next].replaceAll(' ', '-')}`)?.focus(); }} className={tab === label ? 'active' : ''}><Icon size={17} strokeWidth={1.7} />{label}</button>)}</div></>}

        <div id="discovery-panel" role={page === 'discover' ? 'tabpanel' : undefined} aria-labelledby={page === 'discover' ? `tab-${tab.replaceAll(' ', '-')}` : undefined}>
          {(showArtwork || showArtists) && <div className="filter-toolbar"><div className="category-tabs" aria-label="Filter by creative discipline">{categories.map((label) => <button key={label} className={category === label ? 'active' : ''} onClick={() => setCategory(label)} aria-pressed={category === label}>{showArtists && label === 'All artwork' ? 'All artists' : label}</button>)}</div><button className={`filter-button ${filtersOpen || mediaFilter !== 'all' || sort !== 'newest' ? 'active' : ''}`} onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} aria-controls="filter-panel"><SlidersHorizontal size={15} />Filters</button></div>}
          {filtersOpen && (showArtwork || showArtists) && <div className="filter-panel" id="filter-panel">{showArtwork && <><label>Media type<select value={mediaFilter} onChange={(event) => setMediaFilter(event.target.value)}><option value="all">All media</option><option value="image">Images</option><option value="video">Video</option><option value="audio">Audio</option><option value="document">Documents</option></select></label><label>Sort artwork<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select></label></>}<button className="text-link" onClick={() => { setCategory('All artwork'); setMediaFilter('all'); setSort('newest'); setQuery(''); }}>Reset filters</button><span className="muted">{showArtists ? artists.length : artworks.length} results</span></div>}
          {showEvents && <div className="event-filters">{[['all', 'All opportunities'], ['open', 'Applications open'], ['in_progress', 'In progress'], ['closed', 'Closed']].map(([value, label]) => <button className={eventFilter === value ? 'active' : ''} onClick={() => setEventFilter(value)} aria-pressed={eventFilter === value} key={value}>{label}</button>)}</div>}

          {showArtwork && <section className="gallery-section"><div className="section-heading"><div><h2>{query.trim() ? `Results for “${query.trim()}”` : page === 'saved' ? 'Your inspiration, collected.' : isForYou ? 'A fresh wave of inspiration' : 'Original art. Endless inspiration.'}</h2><p>{page === 'saved' ? `${saved.length} saved ${saved.length === 1 ? 'work' : 'works'} · Stored on this device` : isForYou ? 'Independent voices. Unexpected perspectives. Find what speaks to you.' : `${artworks.length} ${artworks.length === 1 ? 'work' : 'works'} to explore. Follow your curiosity.`}</p></div>{isForYou && <button className="text-link" onClick={exploreArtwork}>View all artwork<ArrowUpRight size={15} /></button>}</div>{loading && page !== 'saved' ? <div className="artwork-grid">{Array.from({ length: 4 }, (_, index) => <div className="skeleton-card" key={index}><div /><span /><span /></div>)}</div> : artworks.length ? <div className="artwork-grid">{(isForYou ? artworks.slice(0, 4) : artworks).map((item) => <ArtworkCard key={item.id} {...artworkProps(item)} />)}</div> : <EmptyState icon={page === 'saved' ? Bookmark : Search} title={page === 'saved' && !saved.length ? 'Start a little collection of wonder.' : query || category !== 'All artwork' || mediaFilter !== 'all' ? 'Nothing here just yet.' : 'The gallery is a fresh canvas.'} description={page === 'saved' && !saved.length ? 'Tap the bookmark on any artwork to save it. Your next spark of inspiration will be right here.' : 'Try a different search or filter, or share the first piece of inspiration.'} action={() => { if (page === 'saved' && !saved.length) navigate('discover'); else { setQuery(''); setCategory('All artwork'); setMediaFilter('all'); } }} actionLabel={page === 'saved' && !saved.length ? 'Find some inspiration' : 'Reset search & filters'} />}</section>}

          {(showArtists || isForYou) && <section className="artists-section"><div className="section-heading"><div><h2>{showArtists ? query ? `Artists matching “${query.trim()}”` : 'Find your kind of creative.' : 'Artists worth knowing'}</h2><p>{showArtists ? `${artists.length} independent ${artists.length === 1 ? 'voice' : 'voices'}, each with a different story.` : 'A world of talent. A community of possibility.'}</p></div>{isForYou && <button className="text-link" onClick={() => navigate('artists')}>Meet all artists<ArrowUpRight size={15} /></button>}</div>{loading ? <div className="loading-state"><LoaderCircle className="spin" />Meeting the creatives…</div> : artists.length ? <div className="artist-grid">{(isForYou ? artists.slice(0, 4) : artists).map((artist) => <ArtistCard key={artist.id} artist={artist} artworks={data.artworks} onOpen={openArtist} />)}</div> : <EmptyState icon={Users} title="Good things are on their way." description="No artists match this search yet. Try a different name, discipline, or location." action={() => { setQuery(''); setCategory('All artwork'); }} actionLabel="Show all artists" />}</section>}

          {(showEvents || isForYou) && <section className="opportunities-section"><div className="section-heading"><div><div className="section-title-row"><h2>{showEvents ? 'Make your next move.' : 'Your next opportunity'}</h2><span className="small-spark">✳</span></div><p>{showEvents ? 'Open calls, exhibitions, and a chance to do something meaningful.' : 'Put your creativity out there. See what comes back.'}</p></div>{isForYou ? <button className="text-link" onClick={() => navigate('opportunities')}>Explore opportunities<ArrowUpRight size={15} /></button> : user?.role === 'organizer' && <button className="button button-outline" onClick={openUpload}><Plus size={15} />Post opportunity</button>}</div>{loading ? <div className="loading-state"><LoaderCircle className="spin" />Finding your next chapter…</div> : visibleEvents.length ? <div className="event-grid">{visibleEvents.map((event) => <EventCard key={event.id} event={event} onOpen={openEvent} />)}</div> : <EmptyState icon={BriefcaseBusiness} title="Room for something new." description="No opportunities match just yet. Try another search or check back for the next open call." action={() => { setQuery(''); setEventFilter('all'); }} actionLabel="Show all opportunities" />}</section>}
          {page === 'portfolio' && <PrivatePage user={user} profile={profile} refreshKey={refreshKey} onSignIn={() => signIn()} onProfile={editProfile} onUpload={openUpload} onArtwork={openArtwork} onEvent={openEvent} saved={saved} onSave={toggleSave} notify={notify} />}
        </div>

        {page === 'discover' && <section className="community-banner"><div className="community-symbol">✳</div><div><span className="eyebrow">BETTER WHEN WE CREATE TOGETHER</span><h2>There’s a place for your kind of creative.</h2><p>Share your work, find your people, and see where your ideas take you.</p></div><button className="button button-dark" onClick={user ? openUpload : () => signIn('register')}>{user ? 'Share something new' : 'Find your place'}<ArrowRight size={17} /></button></section>}
        <footer className="main-footer"><span><Sparkles size={14} strokeWidth={1.5} />Made for the beautifully creative.</span><div>{demo && <button onClick={() => setModal({ type: 'help' })}>Preview content · Unsplash imagery</button>}<button onClick={() => setModal({ type: 'help' })}>About Artocean<ArrowUpRight size={12} /></button></div></footer>
      </main>
    </div>

    {modal && <Modal title={modalTitle} onClose={closeModal} wide={['artwork', 'artist'].includes(modal.type)}>
      {modal.type === 'auth' && <AuthForm initialMode={modal.mode} onSuccess={onAuth} />}
      {modal.type === 'profile' && user && <ProfileForm user={user} profile={profile} onSuccess={(result) => { setProfile(result); setRefreshKey((value) => value + 1); closeModal(); refresh(); notify('Your creative space is ready.'); }} />}
      {modal.type === 'upload' && user && <UploadForm isEvent={user.role === 'organizer'} onSuccess={() => { closeModal(); setRefreshKey((value) => value + 1); refresh(); navigate('portfolio'); notify(user.role === 'organizer' ? 'Your opportunity is live. Let’s bring people together.' : 'Your artwork is published. Welcome to the ocean.'); }} />}
      {modal.type === 'artwork' && <ArtworkDetail item={modal.item} saved={saved.some((item) => item.id === modal.item.id)} onSave={toggleSave} onArtist={openArtist} />}
      {modal.type === 'artist' && <ArtistDetail artist={modal.artist} artworks={data.artworks} saved={saved} onSave={toggleSave} onArtwork={openArtwork} />}
      {modal.type === 'event' && <EventDetail event={modal.event} user={user} onApply={(event) => { if (!profile) editProfile(); else setModal({ type: 'apply', event }); }} onSignIn={() => signIn()} onArtist={openArtist} notify={notify} />}
      {modal.type === 'apply' && <ApplicationForm event={modal.event} onSuccess={() => notify('Your application has been sent. Good things start with a little courage.')} />}
      {modal.type === 'help' && <div className="help-content"><span className="help-symbol">✳</span><h3>A little creativity.<br />A whole ocean of possibility.</h3><p>Artocean brings independent artists and event organizers together. Explore portfolios, collect inspiration, and discover your next creative opportunity.</p><div className="help-features"><span><Bookmark size={18} /><strong>Collect what moves you.</strong>Saved artwork stays in this browser, even without an account.</span><span><Plus size={18} /><strong>Share your creative voice.</strong>Sign up as an artist, create a profile, and upload your portfolio.</span><span><BriefcaseBusiness size={18} /><strong>Make something happen.</strong>Artists can apply to events. Organizers can publish opportunities and review applications.</span></div>{demo && <div className="preview-callout"><strong>You’re exploring the preview collection.</strong><p>The API is currently unavailable. These are sample profiles and opportunities illustrated with Unsplash photography, not real listings. Start the FastAPI backend to load live data. Account and publishing actions require the backend.</p><button className="text-link" onClick={() => { closeModal(); refresh(); }}><RefreshCw size={14} />Retry connection</button></div>}<p className="field-hint">Search the current collection with Ctrl + K. Use Escape to close dialogs.</p></div>}
    </Modal>}
    {toast && <div className="toast" role="status"><span className="toast-icon"><Check size={16} /></span><span>{toast}</span><button aria-label="Dismiss message" onClick={() => setToast('')}><X size={16} /></button></div>}
  </div>;
}
