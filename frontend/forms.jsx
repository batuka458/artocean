import { useEffect, useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, ImagePlus, LoaderCircle } from 'lucide-react';
import { authenticate, request } from './api.js';
import { FormError, Success } from './components.jsx';

function SubmitButton({ busy, children }) {
  return <button type="submit" disabled={busy} className="button button-primary button-full">{busy ? <><LoaderCircle className="spin" size={17} />Working on it…</> : <>{children}<ArrowRight size={17} /></>}</button>;
}

export function AuthForm({ initialMode = 'login', onSuccess }) {
  const [mode, setMode] = useState(initialMode);
  const [role, setRole] = useState('artist');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setError(''); setBusy(true);
    let registered = false;
    try {
      if (mode === 'register') {
        await request('/auth/register', { method: 'POST', token: null, body: { email: fields.email, password: fields.password, role } });
        registered = true;
      }
      const user = await authenticate(fields.email, fields.password);
      await onSuccess(user);
    } catch (failure) {
      if (registered) { setMode('login'); setNotice('Your account is created. Sign in to continue.'); }
      setError(failure.message);
    } finally { setBusy(false); }
  }
  return <div className="auth-content"><span className="form-kicker">YOUR NEXT CHAPTER STARTS HERE</span><h3>{mode === 'login' ? 'Welcome back, creative.' : 'A little space for big ideas.'}</h3><p className="muted">{mode === 'login' ? 'Sign in to share your work and find your next opportunity.' : 'Join Artocean. Connect, create, and see what happens next.'}</p>
    <div className="auth-tabs"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setError(''); }}>Sign in</button><button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => { setMode('register'); setError(''); }}>Create account</button></div>
    {notice && <p className="form-notice">{notice}</p>}
    <form className="form" onSubmit={submit}>
      {mode === 'register' && <fieldset className="role-picker"><legend>I’m here as an</legend>{['artist', 'organizer'].map((value) => <label className={role === value ? 'selected' : ''} key={value}><input type="radio" name="role" value={value} checked={role === value} onChange={() => setRole(value)} />{value === 'artist' ? 'Artist & creative' : 'Event organizer'}{role === value && <Check size={15} />}</label>)}</fieldset>}
      <label>Email address<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} /></label>
      <label>Password<span className="password-field"><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'} minLength={mode === 'register' ? 8 : 1} required /><button type="button" className="icon-button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
      <FormError error={error} /><SubmitButton busy={busy}>{mode === 'login' ? 'Sign in' : 'Create my account'}</SubmitButton>
    </form><p className="auth-footnote">A community built around creativity. And you.</p>
  </div>;
}

export function ProfileForm({ user, profile, onSuccess }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const artist = user.role === 'artist';
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const body = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim() || null]));
    try {
      const path = artist ? '/artist/profile' : profile ? '/organizer/profile' : '/organizer/profile/';
      const result = await request(path, { method: profile ? 'PATCH' : 'POST', body });
      await onSuccess(result);
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <><p className="form-intro">{profile ? 'Keep your creative corner up to date.' : 'Let’s put a name to your creativity. Set up your profile to get started.'}</p><form className="form" onSubmit={submit}>
    <label>{artist ? 'Full name' : 'Organization name'}<input name={artist ? 'full_name' : 'company_name'} defaultValue={artist ? profile?.full_name : profile?.company_name} placeholder={artist ? 'Your name' : 'Your organization'} required maxLength={100} /></label>
    <label>{artist ? 'A little about you' : 'About your organization'}<textarea name={artist ? 'bio' : 'description'} defaultValue={artist ? profile?.bio : profile?.description} placeholder={artist ? 'Your creativity, in a sentence.' : 'Tell artists what you’re all about.'} maxLength={artist ? 50 : 1000} rows={3} />{artist && <span className="field-hint">Keep it short and sweet. Up to 50 characters.</span>}</label>
    {artist ? <label>Your creative discipline<input name="talent_skill" defaultValue={profile?.talent_skill} placeholder="e.g. Painting, Photography, Digital art" maxLength={100} /></label> : <label>Website<input name="website_url" type="url" defaultValue={profile?.website_url} placeholder="https://your-studio.com" maxLength={500} /></label>}
    <label>Location<input name="location" defaultValue={profile?.location} placeholder="City, country" maxLength={100} /></label>
    {artist && <label>Phone number <span className="optional">(optional)</span><input name="phone_number" type="tel" defaultValue={profile?.phone_number} autoComplete="tel" maxLength={30} /></label>}
    <FormError error={error} /><SubmitButton busy={busy}>{profile ? 'Save changes' : 'Create my profile'}</SubmitButton>
  </form></>;
}

function FilePicker({ file, onChange, imageOnly = false }) {
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <label className={`file-picker ${file ? 'has-file' : ''}`}>
    {preview ? <img src={preview} alt="Selected image preview" /> : <span className="file-picker-icon"><ImagePlus size={28} strokeWidth={1.4} /></span>}
    <strong>{file ? file.name : imageOnly ? 'Choose your event poster' : 'Give your work a home'}</strong><span>{file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB · Click to choose another file` : imageOnly ? 'JPG, PNG or WebP · Up to 10 MB' : 'Images, MP4, MP3, WAV or PDF · Up to 10 MB'}</span>
    <input type="file" aria-label={imageOnly ? 'Event poster' : 'Artwork file'} required accept={imageOnly ? 'image/jpeg,image/png,image/webp' : 'image/jpeg,image/png,image/webp,video/mp4,audio/mpeg,audio/wav,application/pdf'} onChange={(event) => onChange(event.target.files?.[0] || null)} />
  </label>;
}

export function UploadForm({ onSuccess, isEvent = false }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!file) { setError('Choose a file to continue.'); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Please choose a file smaller than 10 MB.'); return; }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', ...(!isEvent ? ['video/mp4', 'audio/mpeg', 'audio/wav', 'application/pdf'] : [])];
    if (!allowed.includes(file.type)) { setError('That file format is not supported. Please choose one of the listed formats.'); return; }
    const body = new FormData(event.currentTarget);
    body.set(isEvent ? 'event_poster' : 'media', file);
    if (isEvent) body.set('event_date', new Date(body.get('event_date')).toISOString());
    setBusy(true); setError('');
    try {
      const result = await request(isEvent ? '/organizer/events' : '/artist/portfolio', { method: 'POST', body, signal: AbortSignal.timeout(90000) });
      await onSuccess(result);
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <><p className="form-intro">{isEvent ? 'Bring the creative community together. Share an exhibition, open call, or collaboration.' : 'Share something you’ve made. Image uploads also receive AI-generated descriptions and tags.'}</p><form className="form" onSubmit={submit}>
    <FilePicker file={file} onChange={setFile} imageOnly={isEvent} />
    <label>{isEvent ? 'Event title' : 'Artwork title'}<input name="title" placeholder={isEvent ? 'Something worth showing up for' : 'Give your work a name'} required maxLength={200} /></label>
    <label>Description<textarea name="description" placeholder={isEvent ? 'What’s the opportunity? Who should apply?' : 'The story, the process, or a little context…'} rows={3} maxLength={5000} /></label>
    {isEvent && <div className="form-row"><label>Budget<input name="budget" type="number" required min="0" step="0.01" placeholder="e.g. 25000" /><span className="field-hint">Your event’s total budget.</span></label><label>Event date & time<input name="event_date" type="datetime-local" required /><span className="field-hint">In your local timezone.</span></label></div>}
    <FormError error={error} /><SubmitButton busy={busy}>{isEvent ? 'Publish opportunity' : 'Publish my artwork'}</SubmitButton>
    {busy && <p className="field-hint">Uploading and processing your file. This can take a moment.</p>}
  </form></>;
}

export function ApplicationForm({ event, onSuccess }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  async function submit(submitEvent) {
    submitEvent.preventDefault();
    if (busy) return;
    const fields = new FormData(submitEvent.currentTarget);
    setBusy(true); setError('');
    try {
      await request(`/events/${event.id}/applications`, { method: 'POST', body: { pitch_note: fields.get('pitch_note') || null } });
      setComplete(true); onSuccess();
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  if (complete) return <Success title="You’ve made your next move."><p>Your application for <strong>{event.title}</strong> has been sent. The organizer can now review your work.</p></Success>;
  return <><p className="form-intro">Apply to <strong>{event.title}</strong>. The organizer will be able to view your profile and portfolio.</p><form className="form" onSubmit={submit}><label>Your pitch <span className="optional">(optional)</span><textarea name="pitch_note" rows={5} maxLength={5000} placeholder="Introduce yourself. What would you love to bring to this opportunity?" /></label><FormError error={error} /><SubmitButton busy={busy}>Send application</SubmitButton></form></>;
}
