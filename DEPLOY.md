# Deploying Lumora (Website + PMS) to Hetzner

This deploys both apps as Docker containers on a single Hetzner Cloud VPS,
fronted by Caddy (automatic HTTPS), sharing one PostgreSQL database.

```
                    Internet
                       │
              ┌────────▼────────┐
              │  Caddy :80/:443 │   (auto Let's Encrypt TLS)
              └───┬─────────┬───┘
   lumoradental.com        pms.lumoradental.com
        │                        │
   ┌────▼─────┐            ┌─────▼────┐
   │ website  │            │   pms    │──runs migrations
   │  :3001   │            │  :3000   │
   └────┬─────┘            └────┬─────┘
        └──────────┬────────────┘
              ┌─────▼─────┐   ┌────────┐
              │ postgres  │   │ redis  │
              └───────────┘   └────────┘
```

Replace `lumoradental.com` throughout with your real domain.

---

## 0. The live server (as actually deployed)

> Sections 1–3 below describe the original Hetzner plan. **Production was
> actually built on DigitalOcean**, so use these facts, not the placeholders.

| Fact | Value |
|------|-------|
| Provider / region | DigitalOcean, `sgp1` (Singapore) |
| Droplet | `ubuntu-s-2vcpu-2gb-sgp1` — 2 vCPU / 2 GB RAM / 58 GB disk |
| OS | Ubuntu 24.04.4 LTS |
| Public IPv4 | `143.198.85.58` |
| SSH user | `root` (the `deploy` user in §3 was never created) |
| SSH key | `~/.ssh/lumora_ed25519` |
| Firewall | ufw active — OpenSSH, 80/tcp, 443/tcp only |

Connect with the `lumora` alias (defined in `~/.ssh/config`):

```bash
ssh lumora
```

Running containers: `lumora_caddy`, `lumora_website`, `lumora_pms`,
`lumora_db` (postgres:16-alpine), `lumora_redis` (redis:7-alpine).

⚠️ **Memory headroom is thin.** The droplet has 2 GB against the 4 GB this
guide recommends for two Next.js apps + Postgres + Redis; ~766 MB was
available at last check. Resize to a 4 GB droplet before adding load, and
add swap in the meantime.

---

## 1. Create the Hetzner Cloud server

1. Log in to <https://console.hetzner.cloud> → **New Project** (e.g. "Lumora").
2. **Add Server**:
   - **Location**: Falkenstein/Nuremberg (EU) or Ashburn (US) — pick closest to your patients. For Sri Lanka, EU (Falkenstein) typically has the best latency of Hetzner's options.
   - **Image**: **Ubuntu 24.04**.
   - **Type**: **CPX21** (3 vCPU / 4 GB RAM / 80 GB) is a comfortable minimum for two Next.js apps + Postgres + Redis. CX22 (2 vCPU / 4 GB) also works to start; go CPX31 if you add heavy AI transcription use.
   - **SSH key**: add your public key (`cat ~/.ssh/id_ed25519.pub`). Avoid password login.
   - **Name**: `lumora-prod`.
3. Create it and note the **public IPv4** address.

---

## 2. Point your Spaceship domain at the server

In the Spaceship dashboard → your domain → **Advanced DNS** (DNS records), add:

| Type  | Host  | Value / Points to        | TTL  |
|-------|-------|--------------------------|------|
| A     | `@`   | `<SERVER_IPv4>`          | Auto |
| A     | `www` | `<SERVER_IPv4>`          | Auto |
| A     | `pms` | `<SERVER_IPv4>`          | Auto |

- Delete any parking/placeholder A or CNAME records for `@`, `www`, `pms` that Spaceship added by default, or Caddy's cert issuance will fail.
- If you use IPv6 too, add matching `AAAA` records to the server's IPv6.
- Wait for propagation (usually minutes). Verify from your machine:
  ```bash
  nslookup lumoradental.com
  nslookup pms.lumoradental.com
  ```
  Both must return your server IP before you start the stack (Let's Encrypt validates over HTTP).

---

## 3. Prepare the server

SSH in as root, then harden and install Docker:

```bash
ssh root@<SERVER_IPv4>

# Create a non-root deploy user
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy   # copy your SSH key

# Firewall: allow SSH + HTTP + HTTPS only
apt update && apt install -y ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Install Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

Log out and back in as the deploy user:
```bash
ssh deploy@<SERVER_IPv4>
docker version && docker compose version   # sanity check
```

---

## 4. Get the code onto the server

**Option A — git (recommended).** Push this repo to GitHub/GitLab, then:
```bash
git clone <your-repo-url> lumora
cd lumora
```
> Make sure `dental-pms/prisma/migrations/` is committed (its `.gitignore` was
> updated to allow this). Without the migration files the PMS cannot set up the DB.

**Option B — rsync from your machine (no remote repo):**
```bash
# run locally from the project root
rsync -avz --exclude node_modules --exclude .next --exclude '.env*' \
  ./ deploy@<SERVER_IPv4>:~/lumora/
```

---

## 5. Configure secrets

```bash
cd ~/lumora/deploy
cp .env.production.example .env
nano .env
```

Fill in every value. Generate strong secrets:
```bash
openssl rand -base64 32   # use for NEXTAUTH_SECRET
openssl rand -base64 24   # use for POSTGRES_PASSWORD
```
Set `SITE_DOMAIN`, `PMS_DOMAIN`, `ACME_EMAIL`, the clinic contact fields, and any
AI/SMS keys you actually use. Leave optional integrations blank if unused.

---

## 6. Build and launch

```bash
cd ~/lumora/deploy
docker compose -f docker-compose.prod.yml up -d --build
```

First build takes a few minutes. The PMS container runs `prisma migrate deploy`
automatically on startup (see its logs). Watch progress:
```bash
docker compose -f docker-compose.prod.yml logs -f
```

---

## 7. Seed the first admin / initial data (once)

The database starts empty. Run the seed script inside the PMS container:
```bash
docker compose -f docker-compose.prod.yml exec pms npx tsx prisma/seed.ts
```
This creates branches, doctors, and a default staff login. **Log in and change
the seeded password immediately** — the seed uses a known default.

---

## 8. Verify

- <https://lumoradental.com> → marketing site loads over HTTPS.
- <https://pms.lumoradental.com> → PMS login loads over HTTPS.
- The padlock is valid (Caddy got a real Let's Encrypt cert).

If a cert fails: confirm DNS resolves to the server, port 80/443 are open, and
check `docker compose logs caddy`.

---

## Day-2 operations

**Redeploy after code changes:**
```bash
cd ~/lumora && git pull
cd deploy && docker compose -f docker-compose.prod.yml up -d --build
```

**Database backups** (cron this — e.g. daily):
```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U dental_admin dental_pms | gzip > ~/backups/lumora_$(date +%F).sql.gz
```
Also consider enabling Hetzner's automated **snapshots/backups** on the server
(a checkbox in the console) for whole-disk recovery.

**Restore a backup:**
```bash
gunzip -c ~/backups/lumora_YYYY-MM-DD.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres psql -U dental_admin dental_pms
```

**Logs / status:**
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f pms
```

**Stop / start:**
```bash
docker compose -f docker-compose.prod.yml down    # stop (keeps data volumes)
docker compose -f docker-compose.prod.yml up -d    # start
```

---

## Notes & gotchas

- **`NEXT_PUBLIC_*` are baked at build time.** If you change clinic name, phone,
  domain, etc. in `.env`, you must rebuild (`up -d --build`), not just restart.
- **Postgres is not exposed to the internet** — it's only reachable inside the
  Docker network. To connect a DB tool from your laptop, use an SSH tunnel:
  `ssh -L 5432:localhost:5432 deploy@<IP>` after temporarily publishing the port,
  or run `psql` inside the container.
- **The PMS is the only migration owner.** The website shares the DB read/write
  but never migrates. Keep the PMS schema as the source of truth.
- **Handling patient data (PHI/PII).** This stores dental patient records. Ensure
  disk backups are encrypted/access-controlled, keep the server patched
  (`unattended-upgrades`), and restrict PMS access to trusted staff networks if
  your regulations require it.
```
