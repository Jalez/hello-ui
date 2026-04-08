# Admin panel

- **Maintenance (purge orphan levels/maps):** `/admin/maintenance`
- **Check admin status (API):** `GET /api/admin/check-status` (auth required)

When the app is served under a base path (e.g. Docker with `NEXT_PUBLIC_BASE_PATH=/hello-ui`), use the full path:

- Maintenance: `https://your-host/hello-ui/admin/maintenance`
- Check status: `https://your-host/hello-ui/api/admin/check-status`

## Env: show admin link without DB seed

If the sidebar does not show the admin link (e.g. in Docker before running the admin seed), set:

```bash
ADMIN_EMAIL=raitsu11@gmail.com
```

The session email is matched case-insensitively. Then restart the app and sign in with that email.

## Seed admin in DB

Run against the same DB the app uses (e.g. inside Docker or with `DATABASE_URL` pointing at the container):

```bash
pnpm db:seed-admin
```
