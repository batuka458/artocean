import { useEffect, useState } from 'react';
import { ArrowRight, Bookmark, CalendarDays, Check, LoaderCircle, MapPin, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { request } from './api.js';
import { ArtImage, ArtworkCard, Avatar, EmptyState, EventCard, FormError, Media } from './components.jsx';

export function ArtworkDetail({ item, saved, onSave, onArtist }) {
  return <div className="artwork-detail"><div className="detail-image-wrap"><Media item={item} controls /></div><div className="detail-info"><span className="eyebrow">{item.category}</span><h3>{item.title}</h3><button className="detail-artist" onClick={() => onArtist(item.artist)}><Avatar artist={item.artist} /><span><strong>{item.artist.full_name}</strong><span>{item.artist.location || 'Independent artist'}</span></span><ArrowRight size={17} /></button><p>{item.description || item.ai_description || 'An original work from an independent creative.'}</p>{item.ai_style && <p className="muted">Style: {item.ai_style}</p>}<div className="detail-tags">{(item.ai_tags || []).map((tag, index) => <span key={`${tag}-${index}`}>{tag}</span>)}</div>{item.demo && <p className="preview-note">Editorial preview · Sample artist information paired with Unsplash imagery.</p>}<button className={`button ${saved ? 'button-outline' : 'button-primary'}`} onClick={() => onSave(item)}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved to your collection' : 'Save to my collection'}</button></div></div>;
}

export function ArtistDetail({ artist, artworks, saved, onSave, onArtwork }) {
  const [portfolio, setPortfolio] = useState(artworks.filter((item) => item.artist_id === artist.id));
  const [loading, setLoading] = useState(!artist.demo);
  const [error, setError] = useState('');
  useEffect(() => {
    if (artist.demo) return;
    let active = true;
    request(`/artist/${artist.id}/portfolio`, { token: null }).then((items) => {
      if (active) setPortfolio(items.map((item) => ({ ...item, artist, category: item.ai_style || artist.talent_skill || 'Mixed media' })));
    }).catch((failure) => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [artist]);
  return <div className="artist-detail"><div className="artist-profile-header"><Avatar artist={artist} size="avatar-xl" /><div><span className="eyebrow">{artist.talent_skill || 'INDEPENDENT ARTIST'}</span><h3>{artist.full_name}</h3>{artist.location && <span className="location muted"><MapPin size={14} />{artist.location}</span>}</div></div><p className="artist-bio">{artist.bio || 'A creative voice with a story to share.'}</p>{artist.demo && <p className="preview-note">This is a sample profile in the editorial preview.</p>}<h4>Selected works <span className="count-tag">{portfolio.length}</span></h4><FormError error={error} />{loading ? <div className="loading-state"><LoaderCircle className="spin" />Loading portfolio…</div> : portfolio.length ? <div className="artwork-grid detail-artwork-grid">{portfolio.map((item) => <ArtworkCard key={item.id} item={item} saved={saved.some((work) => work.id === item.id)} onSave={onSave} onOpen={onArtwork} />)}</div> : !error && <EmptyState title="A fresh canvas" description="This artist hasn’t shared any work yet. Check back for a little inspiration." />}</div>;
}

export function EventDetail({ event, user, onApply, onSignIn, onArtist, notify }) {
  const [applications, setApplications] = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(null);
  async function viewArtist(artistId) {
    setError('');
    try { onArtist(await request(`/artist/${artistId}`, { token: null })); }
    catch (failure) { setError(failure.message); }
  }
  useEffect(() => {
    if (!user || event.demo) return;
    let active = true;
    setLoading(true);
    request(`/events/${event.id}/applications`).then((items) => {
      if (active) { setApplications(items); setCanReview(user.role === 'organizer'); }
    }).catch((failure) => { if (active && failure.status !== 403) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [event.id, event.demo, user]);
  async function updateApplication(application, status) {
    setUpdating(application.id); setError('');
    try {
      const result = await request(`/applications/${application.id}`, { method: 'PATCH', body: { status } });
      setApplications((items) => items.map((item) => item.id === result.id ? result : item));
      notify(`Application ${status}.`);
    } catch (failure) { setError(failure.message); } finally { setUpdating(null); }
  }
  const mine = user?.role === 'artist' ? applications[0] : null;
  const date = event.event_date ? new Date(event.event_date).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' }) : 'To be announced';
  return <div className="event-detail"><div className="event-detail-poster"><ArtImage src={event.event_poster_url} alt={event.title} /></div><span className={`event-status inline-status ${event.status === 'open' ? 'status-open' : ''}`}><span />{event.status === 'open' ? 'Applications open' : event.status.replaceAll('_', ' ')}</span><h3>{event.title}</h3><div className="event-facts"><span><CalendarDays size={17} />{date}</span>{event.budget != null && <span>Budget: {new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(event.budget)}</span>}</div><p className="event-description">{event.description || 'Connect with the organizer and bring your unique perspective to this creative opportunity.'}</p><FormError error={error} />
    {event.demo ? <div className="preview-callout"><strong>A glimpse of what’s possible.</strong><p>This is a sample opportunity. Connect the backend to browse and apply to real events.</p></div> : loading ? <div className="loading-state"><LoaderCircle className="spin" />Checking applications…</div> : mine ? <div className="application-status"><Check size={19} /><span>You’ve applied. Your application is <strong>{mine.status}</strong>.</span></div> : user?.role !== 'organizer' && <button className="button button-primary" disabled={event.status !== 'open'} onClick={user ? () => onApply(event) : onSignIn}>{event.status === 'open' ? user ? 'Apply for this opportunity' : 'Sign in to apply' : 'Applications closed'}<ArrowRight size={17} /></button>}
    {canReview && <section className="applications-panel"><h4>Applications <span className="count-tag">{applications.length}</span></h4>{applications.length ? applications.map((application) => <div className="application-item" key={application.id}><div><strong>Artist #{application.artist_id}</strong><span className={`application-badge ${application.status}`}>{application.status}</span><p>{application.pitch_note || 'No pitch note provided.'}</p></div><div className="application-actions"><button className="button button-small button-outline" onClick={() => viewArtist(application.artist_id)}>View artist & portfolio<ArrowRight size={14} /></button><button className="button button-small button-outline" disabled={updating !== null || application.status === 'accepted'} onClick={() => updateApplication(application, 'accepted')}><Check size={14} />Accept</button><button className="button button-small button-outline" disabled={updating !== null || application.status === 'rejected'} onClick={() => updateApplication(application, 'rejected')}><X size={14} />Decline</button></div></div>) : <p className="muted">No applications yet. Your next collaborator might be just around the corner.</p>}</section>}
  </div>;
}

export function PrivatePage({ user, profile, refreshKey, onSignIn, onProfile, onUpload, onArtwork, onEvent, saved, onSave, notify }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const organizer = user?.role === 'organizer';
  useEffect(() => {
    if (!user || !profile) return;
    let active = true;
    setLoading(true); setError('');
    request(organizer ? '/organizer/events' : '/artist/portfolio').then((result) => {
      if (active) setItems(organizer ? result : result.map((item) => ({ ...item, artist: profile, category: item.ai_style || profile.talent_skill || 'Mixed media' })));
    }).catch((failure) => { if (active) setError(failure.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user, profile, organizer, refreshKey, retry]);
  async function deleteItem(item) {
    if (deleteBusy) return;
    setDeleteBusy(true);
    setDeleting(item.id); setError('');
    try {
      await request(organizer ? `/events/${item.id}` : `/portfolio/${item.id}`, { method: 'DELETE' });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setDeleting(null); notify(organizer ? 'Opportunity deleted.' : 'Artwork deleted.');
    } catch (failure) { setError(failure.message); setDeleting(null); }
    finally { setDeleteBusy(false); }
  }
  if (!user) return <EmptyState title="Your creativity deserves a home." description="Create an account or sign in to build your portfolio, share your work, and discover what comes next." action={onSignIn} actionLabel="Sign in to get started" />;
  if (!profile) return <EmptyState title="Let’s make this space yours." description="Add a few details to your profile before publishing your first work or opportunity." action={onProfile} actionLabel="Set up my profile" />;
  return <><section className="my-profile"><Avatar artist={profile} size="avatar-xl" /><div><span className="eyebrow">{organizer ? 'YOUR ORGANIZATION' : 'YOUR CREATIVE SPACE'}</span><h2>{profile.full_name || profile.company_name}</h2><p>{profile.bio || profile.description || 'Every creative journey starts somewhere.'}</p>{profile.location && <span className="muted location"><MapPin size={14} />{profile.location}</span>}</div><button className="button button-outline" onClick={onProfile}><Pencil size={15} />Edit profile</button></section><div className="section-heading"><div><h2>{organizer ? 'Your opportunities' : 'Your portfolio'} <span className="count-tag">{items.length}</span></h2><p>{organizer ? 'Make room for your next creative collaboration.' : 'A collection of everything that makes you, you.'}</p></div><button className="button button-primary" onClick={onUpload}><Plus size={16} />{organizer ? 'Post opportunity' : 'Add artwork'}</button></div><FormError error={error} />{error && <button className="text-link" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={15} />Try again</button>}
    {loading ? <div className="loading-state"><LoaderCircle className="spin" />Loading your creative space…</div> : items.length ? <div className={organizer ? 'event-grid' : 'artwork-grid'}>{items.map((item) => <div className="owned-item" key={item.id}>{organizer ? <EventCard event={item} onOpen={onEvent} /> : <ArtworkCard item={item} saved={saved.some((entry) => entry.id === item.id)} onSave={onSave} onOpen={onArtwork} onArtist={onProfile} />}{deleting === item.id ? <div className="delete-confirm"><span>Delete this {organizer ? 'event and its applications' : 'artwork'}?</span><button className="text-link danger" disabled={deleteBusy} onClick={() => deleteItem(item)}>{deleteBusy ? 'Deleting…' : 'Yes, delete'}</button><button className="text-link" disabled={deleteBusy} onClick={() => setDeleting(null)}>Cancel</button></div> : <button className="delete-item" onClick={() => setDeleting(item.id)}><Trash2 size={13} />Delete {organizer ? 'event' : 'artwork'}</button>}</div>)}</div> : !error && <EmptyState title={organizer ? 'Your next gathering starts here.' : 'Meet your blank canvas.'} description={organizer ? 'Post your first opportunity and connect with artists ready to bring it to life.' : 'Add your first artwork. There’s a whole ocean of inspiration waiting to discover you.'} action={onUpload} actionLabel={organizer ? 'Post an opportunity' : 'Share my first artwork'} />}</>;
}
