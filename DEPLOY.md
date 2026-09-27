# Deployment

This project is a static site. Upload the entire `birthday-gift-site` directory to any static host, such as GitHub Pages, Netlify, Vercel, Cloudflare Pages, or a normal web server.

## Required paths

- `index.html`
- `src/css/styles.css`
- `src/js/app.js`
- `assets/scene-reference.png`
- `assets/scene-reference-alt.png`
- `assets/birthday-demo.mp4`

No build step is required.

## Local test

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/`.

## Production note

The password flow is intentionally a frontend prototype. Replace the client-side hash verification with server-side authentication before using it as a real access-control system.
