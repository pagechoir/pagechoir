# Pagechoir

A free book studio: manuscript, lore bible, timeline, boards, goals, and EPUB, PDF, Word, and Markdown export.

## Local

```bash
npm install
# optional: set AUTH_SECRET and DATABASE_URL in .env.local
npm run dev
```

Without `DATABASE_URL`, Pagechoir keeps a Postgres-compatible database in `data/`. With `DATABASE_URL`, it uses Neon Postgres, which is what the Vercel deployment expects.

Set `AUTH_SECRET` in the Vercel project. Set `BLOB_READ_WRITE_TOKEN` if uploaded images should go to Vercel Blob. Imports are read in the browser.

The app source is [github.com/pagechoir/pagechoir](https://github.com/pagechoir/pagechoir). A push to `main` is the production deploy.
