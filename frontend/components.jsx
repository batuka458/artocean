import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ArrowUpRight, Bookmark, CalendarDays, Check, FileText, ImagePlus, MapPin, Palette, Sparkles, X } from 'lucide-react';
import { demoArtists, image } from './data.js';

export function Brand() {
  return <a className="brand" href="#/discover" aria-label="Artocean home">
    <svg className="brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="currentColor" />
      <path d="M10 25c3-13 6-13 10 0 4-13 7-13 10 0M14 26h12" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span>artocean<span className="brand-dot">.</span></span>
  </a>;
}

export function Avatar({ artist, size = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  const name = artist?.full_name || artist?.company_name || artist?.email || 'You';
  return <span className={`avatar ${size} ${className}`} aria-label={name}>
    {artist?.avatar && !failed
      ? <img src={image(artist.avatar, 100)} alt="" loading="lazy" onError={() => setFailed(true)} />
      : <span>{name.split(/[\s@]/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>}
  </span>;
}

export function ArtImage({ src, alt, className = '', loading = 'lazy' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed
    ? <img className={className} src={src} alt={alt} loading={loading} onError={() => setFailed(true)} />
    : <span className={`image-placeholder ${className}`} role="img" aria-label={alt}><Palette size={36} strokeWidth={1.2} /><span>Art, in every form.</span></span>;
}

export function Media({ item, controls = false }) {
  if (item.media_type === 'video') return controls
    ? <video className="detail-media" controls src={item.media_url} preload="metadata" />
    : <span className="image-placeholder"><Palette /><span>Video artwork</span></span>;
  if (item.media_type === 'audio') return controls
    ? <audio className="audio-player" controls src={item.media_url} preload="metadata" />
    : <span className="image-placeholder"><Palette /><span>Sound & expression</span></span>;
  if (item.media_type === 'document') return <span className="image-placeholder"><FileText size={36} /><span>Portfolio document</span>{controls && /^https?:\/\//i.test(item.media_url) && <a className="text-link" href={item.media_url} target="_blank" rel="noopener noreferrer">Open document <ArrowUpRight size={16} /></a>}</span>;
  return <ArtImage src={item.media_url} alt={item.title} className={controls ? 'detail-media' : ''} />;
}

export function Modal({ title, children, onClose, wide = false }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => dialog.current?.querySelector('input, textarea, select, button, a[href]')?.focus(), 0);
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const elements = [...dialog.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter((element) => element.getClientRects().length);
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);
  return createPortal(<div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={dialog}>
      <div className="modal-header"><h2 id="dialog-title">{title}</h2><button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button></div>
      {children}
    </section>
  </div>, document.body);
}

export function EmptyState({ title, description, action, actionLabel, icon: Icon = ImagePlus }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={28} strokeWidth={1.5} /></span><h3>{title}</h3><p>{description}</p>{action && <button className="button button-primary" onClick={action}>{actionLabel}<ArrowRight size={16} /></button>}</div>;
}

export function ArtworkCard({ item, saved, onSave, onOpen, onArtist }) {
  const Byline = onArtist ? 'button' : 'div';
  return <article className="artwork-card">
    <div className="artwork-image">
      <button className="image-open" onClick={() => onOpen(item)} aria-label={`View ${item.title}`}><Media item={item} /><span className="artwork-hover">Take a closer look <ArrowUpRight size={16} /></span></button>
      <span className="category-label">{item.category}</span>
      <button className={`save-button ${saved ? 'is-saved' : ''}`} onClick={() => onSave(item)} aria-label={`${saved ? 'Unsave' : 'Save'} ${item.title}`} aria-pressed={saved}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button>
    </div>
    <div className="artwork-info"><button className="artwork-title" onClick={() => onOpen(item)}>{item.title}</button>
      <Byline className="artist-byline" onClick={onArtist ? () => onArtist(item.artist) : undefined}><Avatar artist={item.artist} size="avatar-small" /><span>{item.artist.full_name}</span><span className="byline-dot">·</span><span>{item.artist.talent_skill || 'Artist'}</span></Byline>
    </div>
  </article>;
}

export function ArtistCard({ artist, artworks, onOpen }) {
  const work = artworks.find((item) => item.artist_id === artist.id);
  return <button className="artist-card" onClick={() => onOpen(artist)}>
    <div className="artist-cover"><ArtImage src={work?.media_url} alt={`Work by ${artist.full_name}`} /><span className="artist-card-arrow"><ArrowUpRight size={18} /></span></div>
    <div className="artist-card-body"><Avatar artist={artist} size="avatar-large" /><h3>{artist.full_name}</h3><p>{artist.talent_skill || 'Independent artist'}</p><span className="muted location"><MapPin size={13} />{artist.location || 'Creating everywhere'}</span></div>
  </button>;
}

export function EventCard({ event, onOpen }) {
  const date = event.event_date ? new Date(event.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date to be announced';
  return <button className="event-card" onClick={() => onOpen(event)}>
    <div className="event-cover"><ArtImage src={event.event_poster_url} alt={event.title} /><span className={`event-status ${event.status === 'open' ? 'status-open' : ''}`}><span />{event.status === 'open' ? 'Applications open' : event.status.replaceAll('_', ' ')}</span></div>
    <div className="event-body"><span className="eyebrow">{event.label || 'CREATIVE OPPORTUNITY'}</span><h3>{event.title}</h3><p>{event.description || 'An opportunity to share your work and connect with the creative community.'}</p><div className="event-footer"><span><CalendarDays size={14} />{date}</span><ArrowUpRight size={18} /></div></div>
  </button>;
}

export function Hero({ onExplore, onOpportunities }) {
  return <section className="hero">
    <div className="hero-content"><span className="hero-eyebrow"><span />A SPACE FOR CREATIVE POSSIBILITIES</span><h1>Find your inspiration.<br />Make your <span>next move.</span></h1><p>Discover original art, connect with inspiring artists,<br className="desktop-break" /> and turn your creativity into opportunity.</p><div className="hero-actions"><button className="button button-primary" onClick={onExplore}>Explore artwork <ArrowRight size={17} /></button><button className="hero-secondary" onClick={onOpportunities}>Find opportunities <ArrowUpRight size={16} /></button></div><div className="hero-community"><div className="avatar-stack">{demoArtists.slice(0, 4).map((artist) => <Avatar artist={artist} key={artist.id} />)}</div><span>A little inspiration goes a long way.<br /><strong>Come create something meaningful.</strong></span></div></div>
    <div className="hero-art" aria-label="An editorial collage celebrating independent art">
      <span className="hero-orbit orbit-one" /><span className="hero-orbit orbit-two" />
      <div className="hero-photo photo-back"><ArtImage src={image('photo-1497250681960-ef046c08a56e', 600)} alt="Botanical leaves in soft natural light" loading="eager" /></div>
      <div className="hero-photo photo-main"><ArtImage src={image('photo-1549490349-8643362247b5', 700)} alt="Expressive abstract painting in soft colors" loading="eager" /><div className="hero-photo-caption"><span>Art without boundaries.</span><ArrowUpRight size={17} /></div></div>
      <div className="hero-photo photo-front"><ArtImage src={image('photo-1493106641515-6b5631de4bb9', 400)} alt="Handcrafted ceramic objects" loading="eager" /></div>
      <span className="hero-spark spark-one"><Sparkles size={25} strokeWidth={1.4} /></span><span className="hero-spark spark-two">✳</span>
      <span className="hero-sticker"><span>INDEPENDENT ART.</span><Palette size={23} strokeWidth={1.4} /><span>INFINITE POSSIBILITIES.</span></span>
    </div>
  </section>;
}

export function FormError({ error }) {
  return error ? <p className="form-error" role="alert">{error}</p> : null;
}

export function Success({ title, children }) {
  return <div className="success-state"><span><Check size={28} /></span><h3>{title}</h3>{children}</div>;
}
