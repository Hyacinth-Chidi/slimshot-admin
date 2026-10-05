# Hosting the SlimShot dashboard on the VPS

This puts the admin dashboard on the same Contabo VPS as the API, at
**https://slimshot-admin.techfamz.com**. About 15 minutes, all as root.

```
                      ┌──────────────────────────── VPS ─────────────────────────────┐
 your browser ───────▶│ nginx :443 slimshot-admin…  ──▶ 127.0.0.1:3001 ──▶ dashboard │
        HTTPS         │ nginx :443 slimshot-server… ──▶ 127.0.0.1:2700 ──▶ API       │
                      └───────────────────────────────────────────────────────────────┘
```

- The dashboard runs as one Docker container (Next.js standalone server, non-root user),
  reachable only through nginx.
- Your browser talks to the API at `https://slimshot-server.techfamz.com/api/admin/v1` directly;
  the dashboard's own sign-in routes also call that address from the server.
- Firewall, Docker, nginx, certbot and key-only SSH are already in place from the API's
  `setup-vps.sh` (`slimshot_server/docs/deploy/vps-setup.md`, steps 1–3). Nothing here
  repeats them.

Commands marked **PC** run in PowerShell on your computer. The others run on the VPS, as root.

### The order at a glance

| Step | Where | What |
|---|---|---|
| 0 | DNS, PC | A record for `slimshot-admin`, push `main` |
| 1 | VPS | This repo's deploy key and GitHub alias, clone |
| 2 | VPS | `.env` (one line) |
| 3 | VPS | Allow the dashboard in the API's `.env` (`ADMIN_BASE_URL`) |
| 4 | VPS | `setup-nginx.sh`: HTTPS certificate |
| 5 | VPS | `deploy.sh`: first deploy, then sign in |
| 6 | VPS | Everyday commands |

---

## 0. Before you start

1. **The API's server setup is done**: `setup-vps.sh` has run (guide steps 1–3 in
   `slimshot_server`). The API itself doesn't have to be deployed yet, but you can't sign in
   to the dashboard until it is.
2. **The DNS record.** Where `techfamz.com`'s DNS is managed, add an **A record**:
   `slimshot-admin` → *the VPS IP*. Check it (**PC**):
   ```powershell
   nslookup slimshot-admin.techfamz.com
   ```
3. **`main` pushed to GitHub** (**PC**):
   ```powershell
   cd "C:\Users\HP\Desktop\Slimshot workspace\slimshot-admin"
   git push origin main
   ```

## 1. Get the code onto the VPS

GitHub allows one repository per deploy key, so this repo gets its own key and its own
alias, `github-slimshot-admin` (the API uses `github-slimshot`):

```bash
ssh-keygen -t ed25519 -f /root/.ssh/github_slimshot_admin -N "" -C "slimshot-admin-vps"
cat /root/.ssh/github_slimshot_admin.pub
```

Copy the line it prints. On GitHub, open **Hyacinth-Chidi/slimshot-admin → Settings → Deploy
keys → Add deploy key**, paste it, name it `slimshot-admin-vps`, and leave **Allow write
access** off.

Add the alias (one line), then check GitHub greets **this** repository:

```bash
printf '\n# SlimShot dashboard repo: its own deploy key.\nHost github-slimshot-admin\n  HostName github.com\n  User git\n  IdentityFile ~/.ssh/github_slimshot_admin\n  IdentitiesOnly yes\n' >> /root/.ssh/config
ssh -T git@github-slimshot-admin
# Hi Hyacinth-Chidi/slimshot-admin! You've successfully authenticated, but GitHub does not provide shell access.
```

Clone through the alias. Every later `git pull` uses the key by itself:

```bash
cd /var/www
git clone git@github-slimshot-admin:Hyacinth-Chidi/slimshot-admin.git
cd slimshot-admin
```

Everything the dashboard needs comes from this clone except `.env` (step 2).

## 2. `.env`

```bash
cp .env.production.example .env
cat .env
# NEXT_PUBLIC_API_BASE=https://slimshot-server.techfamz.com/api/admin/v1
```

That one line is all the dashboard needs. It holds no secrets: the address is public, and the
dashboard's sign-in goes through the API. It's baked into the build, so after changing it,
run `deploy.sh` again (it rebuilds).

## 3. Allow the dashboard in the API

The API only accepts browser requests from the dashboard's address. In the **API's** `.env`:

```bash
nano /var/www/slimshot_server/.env
# ADMIN_BASE_URL=https://slimshot-admin.techfamz.com
```

If the API is already running, apply it:

```bash
cd /var/www/slimshot_server && SKIP_PULL=1 ./deploy/scripts/deploy.sh && cd /var/www/slimshot-admin
```

If the API isn't deployed yet, its first `deploy.sh` picks the value up.

## 4. HTTPS with a free certificate

```bash
./deploy/scripts/setup-nginx.sh slimshot-admin.techfamz.com you@techfamz.com
```

It checks the domain points at this VPS, gets a Let's Encrypt certificate, installs the nginx
site from `deploy/nginx/`, and tests automatic renewal. Until the first deploy, the site
answers **502**. That's expected.

## 5. First deploy

```bash
./deploy/scripts/deploy.sh
```

The first build takes 3–5 minutes. Then open **https://slimshot-admin.techfamz.com**: you get the
sign-in page. Sign in with the owner account from the API's `ADMIN_BOOTSTRAP_EMAIL` and
`ADMIN_BOOTSTRAP_PASSWORD`, then continue with the API guide's step 7 (provider keys,
pricing, and removing the bootstrap lines).

## 6. Everyday use

| To | Run (as root, in `/var/www/slimshot-admin`) |
|---|---|
| Deploy new code (push from your PC first) | `./deploy/scripts/deploy.sh` |
| Point it at a different API address | edit `.env`, then `SKIP_PULL=1 ./deploy/scripts/deploy.sh` |
| Follow its log | `docker compose -f docker-compose.prod.yml logs -f web` |
| See if it's running | `docker compose -f docker-compose.prod.yml ps` |
| Restart it | `docker compose -f docker-compose.prod.yml restart web` |
| nginx logs | `tail -f /var/log/nginx/slimshot-admin.error.log` |
| Reinstall nginx config after editing `deploy/nginx/*` | `./deploy/scripts/setup-nginx.sh slimshot-admin.techfamz.com you@techfamz.com` |

Deploys are manual: push, then run `deploy.sh`. Automatic deploys can be added later the same
way as the API's (its step 9), with this dashboard on its own listener port.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Browser shows **502 Bad Gateway** | The dashboard isn't running: `docker compose -f docker-compose.prod.yml ps`, then `… logs --tail=100 web` |
| `deploy.sh`: "The dashboard did not become healthy" | Read the log lines it printed |
| Sign-in page loads, but signing in fails or the browser console shows a **CORS** error | The API's `ADMIN_BASE_URL` isn't exactly `https://slimshot-admin.techfamz.com` (step 3), or the API isn't running (`curl https://slimshot-server.techfamz.com/health`) |
| "The server returned an unreadable response" | The API is down or answering 502; check the API's logs |
| Signed out on every reload | The sign-in cookie needs HTTPS. Open the `https://` address, not `http://` |
| `setup-nginx.sh`: "does not resolve" / "points to …" | The `slimshot-admin` A record is missing, wrong, or hasn't spread yet |
| `git pull`: `Permission denied (publickey)` | The alias or deploy key is missing: redo step 1's `printf` line and the GitHub deploy key |

## Where things live

| Path | What it is |
|---|---|
| `Dockerfile` | The image: Next.js standalone server on Node 24, non-root |
| `docker-compose.prod.yml` | One container, `127.0.0.1:3001`, project `slimshot-admin` |
| `.env.production.example` | Template for `.env` (the API address) |
| `deploy/scripts/setup-nginx.sh` | nginx and the Let's Encrypt certificate |
| `deploy/scripts/deploy.sh` | Pull, build, restart, health check |
| `deploy/nginx/` | The nginx site, its proxy settings and the certificate-request config |
| On the VPS: `/var/www/slimshot-admin` | The code and `.env` |
| On the VPS: `/root/.ssh/github_slimshot_admin` | This repo's deploy key (alias `github-slimshot-admin` in `/root/.ssh/config`) |
| On the VPS: `/etc/nginx/sites-available/slimshot-admin` | The installed nginx site |
