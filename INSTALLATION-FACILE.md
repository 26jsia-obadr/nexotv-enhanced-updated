# Easy installation of NexoTV Enhanced

This guide is for a public instance where everyone configures their own playlist
without seeing anyone else's. Copy and paste the blocks in order.

## 1. Create the directory

```bash
mkdir -p nexotv-enhanced/data nexotv-enhanced/config
cd nexotv-enhanced
```

## 2. Create `docker-compose.yml`

Create a file named `docker-compose.yml` with exactly this content:

```yaml
services:
  nexotv:
    image: ghcr.io/aerya/nexotv-enhanced:latest
    container_name: nexotv-enhanced
    ports:
      - "7000:7000"
    env_file:
      - .env
    environment:
      CONFIG_SECRET: ${CONFIG_SECRET:?Set CONFIG_SECRET in the .env file}
    volumes:
      - ./data:/app/data      # required to preserve manifest URLs
      - ./config:/app/config
    restart: unless-stopped
```

## 3. Generate the secret

On Linux, a NAS, or an SSH server:

```bash
openssl rand -hex 32
```

On Windows PowerShell:

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); ($b | ForEach-Object ToString x2) -join ''
```

The command prints a long string of characters. Copy it without spaces.

## 4. Create `.env`

Create a file named `.env` in the same directory:

```env
CONFIG_SECRET=PASTE_THE_LONG_GENERATED_VALUE_HERE
```

Do not add `WEBUI_PASSWORD` for a public instance. It is normal for the
configuration page not to ask for a password: visitors cannot see shared saved
configurations or statistics.

For a strictly private instance, add a second line:

```env
WEBUI_PASSWORD=CHOOSE_A_REAL_PASSWORD
```

Everyone who knows this password will share the same saved configurations.

The `data/` directory also contains the encrypted configurations associated with
short manifest URLs. Do not delete it, and include it in server backups.

## 5. Start the instance

```bash
docker compose pull
docker compose up -d
```

Then open `http://SERVER-ADDRESS:7000/configure`, or the HTTPS domain configured
in front of the container.

## 6. Verify security

Replace `https://nexotv.example.com` with the real domain:

```bash
  curl https://nexotv.example.com/api/capabilities
```

The result must contain:

```json
{"encryptionEnabled":true}
```

Puis lancer :

```bash
  curl -i https://nexotv.example.com/api/configs
```

On a public instance, the result must start with `HTTP/2 403` or `HTTP/1.1 403`.
If it does not, do not share the instance address.

## Updating an existing public instance

If users have already seen each other's configurations, consider the stored
credentials exposed: change the Xtream passwords, private M3U links, and Stalker
MAC addresses with the relevant providers.

Then update the image:

```bash
docker compose pull
docker compose up -d
```

To permanently delete the instance's old saved configurations and history, stop
the container and remove the database. **This command also deletes the cache and
all configurations associated with short manifest URLs. Already-installed addons
must be configured again. This operation cannot be undone.**

```bash
docker compose down
rm -f data/cache.sqlite data/cache.sqlite-shm data/cache.sqlite-wal
docker compose up -d
```

Finally, repeat both checks from the previous section.
