# Frontend

Static HTML, CSS, and JavaScript frontend for Hagbad.

## Local config without pushing

This frontend is plain static HTML/JS, so a real browser `.env` file is not used directly.

Instead, use a gitignored local override file:

- Shared default: [js/config.js](/home/zaki/Projects/hagbad-v2/frontend/js/config.js)
- Local override: `frontend/js/config.local.js`
- Example file: [js/config.local.example.js](/home/zaki/Projects/hagbad-v2/frontend/js/config.local.example.js)

`frontend/js/config.local.js` is ignored by git, so you can change the backend URL there without pushing repo changes every time.
If you ever remove it, recreate it by copying `frontend/js/config.local.example.js` to `frontend/js/config.local.js`.

## Run locally

1. Start the backend.
2. Edit `frontend/js/config.local.js` and set your backend URL.
3. Serve the frontend:

```bash
cd frontend
python3 -m http.server 3000
```

Open `http://localhost:3000`.

## Config behavior

The frontend loads config in this order:

1. `frontend/js/config.js`
2. `frontend/js/config.local.js`
3. `frontend/js/app.js`

That means:

- `config.js` stays committed and safe for deployment
- `config.local.js` overrides it on your machine only

## Backend URL examples

Local development:

```js
window.HAGBAD_CONFIG = {
    ...window.HAGBAD_CONFIG,
    apiBaseUrl: "http://localhost:8000",
};
```

Separate backend host:

```js
window.HAGBAD_CONFIG = {
    ...window.HAGBAD_CONFIG,
    apiBaseUrl: "https://api.example.com",
};
```

Same-origin deploy:

```js
window.HAGBAD_CONFIG = {
    ...window.HAGBAD_CONFIG,
    apiBaseUrl: "",
};
```

## Deployment notes

- Keep [js/config.js](/home/zaki/Projects/hagbad-v2/frontend/js/config.js) production-safe.
- The committed default is `""`, which works when frontend and backend are served from the same origin.
- Use `frontend/js/config.local.js` for your machine-specific backend URL.
- Frontend API calls should use `APP.buildApiUrl("/path")`.
- The landing page checks backend root route `/` for connection status.

## Structure

```text
frontend/
├── index.html
├── css/
├── js/
│   ├── config.js
│   ├── config.local.example.js
│   ├── config.local.js
│   └── app.js
├── modules/
└── pages/
```
