const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const tokenKey = 'artocean.session';
let memoryToken = null;

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const session = {
  get() {
    try { return sessionStorage.getItem(tokenKey) || memoryToken; } catch { return memoryToken; }
  },
  set(token) {
    memoryToken = token;
    try { sessionStorage.setItem(tokenKey, token); } catch { return; }
  },
  clear() {
    memoryToken = null;
    try { sessionStorage.removeItem(tokenKey); } catch { return; }
  },
};

export async function request(path, { token = session.get(), ...options } = {}) {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !(options.body instanceof URLSearchParams)) {
    headers.set('Content-Type', 'application/json');
    options.body = JSON.stringify(options.body);
  }
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, { ...options, headers, signal: options.signal || AbortSignal.timeout(12000) });
  } catch {
    throw new ApiError('Cannot reach the server. Make sure the Artocean API is running, then try again.', 0);
  }
  if (!response.ok) {
    if (response.status === 401 && token) {
      session.clear();
      window.dispatchEvent(new Event('artocean:session-expired'));
    }
    const payload = await response.json().catch(() => ({}));
    const detail = payload.detail;
    const message = Array.isArray(detail)
      ? detail.map((error) => `${error.loc?.at(-1) || 'Field'}: ${error.msg}`).join('. ')
      : typeof detail === 'string' ? detail : `Something went wrong (${response.status}). Please try again.`;
    throw new ApiError(message, response.status);
  }
  return response.status === 204 ? null : response.json();
}

export async function authenticate(email, password) {
  const result = await request('/auth/login', {
    method: 'POST', token: null, body: new URLSearchParams({ username: email, password }),
  });
  const user = await request('/auth/me', { token: result.access_token });
  session.set(result.access_token);
  return user;
}

export async function loadPublicData() {
  const [artists, events] = await Promise.all([
    request('/artist/?limit=24', { token: null }),
    request('/events?limit=100', { token: null }),
  ]);
  const portfolios = await Promise.allSettled(artists.map((artist) => request(`/artist/${artist.id}/portfolio?limit=100`, { token: null })));
  const artworks = portfolios.flatMap((result, index) => result.status === 'fulfilled'
    ? result.value.map((item) => ({ ...item, artist: artists[index], category: item.ai_style || artists[index].talent_skill || 'Mixed media', demo: false }))
    : []);
  return { artists, events, artworks, portfolioError: portfolios.some((result) => result.status === 'rejected') };
}
