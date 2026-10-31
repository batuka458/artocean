# Artocean

A creative-community frontend for the existing FastAPI artist, portfolio, event, and application API. Built with React, Vite, and Lucide icons, with a responsive gallery layout, warm neutral colors, and coral accents.

## Run the frontend

Requires Node.js 20.19+ or 22.12+ and npm.

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite, normally **http://127.0.0.1:5173**.

The interface works without a running backend: it displays a clearly labeled **Preview collection** with sample artist profiles, sample opportunities, and Unsplash imagery. Preview entries cannot receive real applications. Account creation, sign-in, profile changes, and publishing require the backend. Bookmarked artwork is stored in this browser’s local storage and does not require an account.

## Connect the backend

In a separate terminal, install the Python dependencies. `python-dotenv` is needed for Uvicorn’s `--env-file` option:

```powershell
python -m pip install -r requirements.txt python-dotenv
Copy-Item .env.example .env
```

Edit `.env` and provide the environment variables already required by the backend:

- `SECRET_KEY`: a long, randomly generated signing secret.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: used for file uploads.
- `GROQ_API_KEY`: used for image analysis. Optionally set `GROQ_VISION_MODEL`.

Then start the API:

```powershell
python -m uvicorn main:app --reload --env-file .env --host 127.0.0.1 --port 8000
```

Vite forwards `/api` requests to `http://127.0.0.1:8000` and removes the `/api` prefix. This avoids needing development CORS changes. Set `API_PROXY_TARGET` in `.env` to use another backend address, then restart Vite. Click **Preview collection** in the page header to retry the connection without reloading.

### Account flows

1. Create an account as an **artist** or **organizer**.
2. Complete the profile form shown after registration.
3. Artists can upload portfolio items and apply to open events. Organizers can publish events and accept or decline applications to their own events.
4. Open **My portfolio** or **My events** to view and delete your own entries. Deletion requires an explicit inline confirmation.

Authentication uses the API’s OAuth2 form-encoded login and bearer tokens. Tokens are kept in session storage, not persistent local storage. All authorization and ownership checks remain on the backend.

## What’s included

- Artwork discovery with creative-discipline filters, media-type filters, and sorting.
- Search across the current artwork collection, artists, or opportunities; `Ctrl + K` focuses search.
- Artist profiles and portfolios, including image, video, audio, and PDF items.
- Opportunity details, event-status filters, artist applications, and organizer application review.
- Account registration, sign-in, profile setup/editing, artwork uploads, and event publishing.
- Device-local saved collections with reload persistence.
- Responsive mobile navigation, keyboard-operable tabs, focus-trapped dialogs, loading states, empty states, and server-error feedback.

Discovery currently loads up to 24 public artists, up to 100 portfolio items per artist, and up to 100 events. Search and filters operate on those loaded records. The frontend does not modify or seed the backend database.

## Production build

```powershell
npm run build
npm run preview
```

`dist/` contains the static production frontend. `npm run preview` serves only the built frontend; it does not start or proxy the API. For a complete deployment, serve the frontend and reverse-proxy `/api/*` to FastAPI, stripping `/api`, or set `VITE_API_URL` to your API address **before building**. A cross-origin API needs its own correctly configured CORS policy. Keep secrets on the backend; only environment variables prefixed with `VITE_` are exposed to the browser.

### Deploy on GitHub Pages

The repository includes `.github/workflows/deploy-pages.yml`. Before running it, open [the repository's Pages settings](https://github.com/batuka458/artocean-backend/settings/pages) and select **GitHub Actions** under **Build and deployment → Source**. This requires repository administrator access. Then push to `main`, or run **Actions → Deploy frontend to GitHub Pages → Run workflow**. The workflow checks the Pages configuration before building, publishes `dist/`, and configures the project-site path automatically.

If `actions/deploy-pages` reports **Failed to create deployment (status: 404)** even though it found the `github-pages` artifact, check that Pages is enabled with **GitHub Actions** as its source, then rerun the workflow. Uploading an artifact does not enable Pages, and the default `GITHUB_TOKEN` cannot automatically enable it. The Node `punycode` deprecation warning is unrelated to this failure. Once deployed, the project site is available at **https://batuka458.github.io/artocean-backend/**.

GitHub Pages cannot proxy the FastAPI service. To use live account and API data, set `VITE_API_URL` as a repository Actions variable before the build, or deploy the API separately with CORS configured. Without it, the frontend displays its built-in preview collection.

The existing `api/index.py` backend entry point is left unchanged. Choose the appropriate API routing for your deployment platform.

Fonts use Google Fonts with system fallbacks. Preview imagery uses Unsplash; missing images display an intentional placeholder. Sample profile names and metadata are fictional and are not claims about the people pictured.
