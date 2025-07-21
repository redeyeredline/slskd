# Running slskd with Docker Compose

This guide shows how to run slskd with Docker Compose, including the performance improvements for browsing large user lists.

## Prerequisites

- Docker and Docker Compose installed
- Ports 5030, 5031, and 50300 available on your system

## Quick Start

1. **Build and start the container:**

   ```bash
   docker-compose up -d --build
   ```

2. **Access the web interface:**
   - HTTP: http://localhost:5030
   - HTTPS: https://localhost:5031 (self-signed certificate)

3. **View logs:**

   ```bash
   docker-compose logs -f slskd
   ```

4. **Stop the container:**
   ```bash
   docker-compose down
   ```

## Configuration

### Data Persistence

The application data is stored in the `./data` directory, which is mounted to `/app` inside the container.

### Sharing Directories

To share directories with other Soulseek users:

1. Uncomment and modify the volume mappings in `docker-compose.yml`:

   ```yaml
   volumes:
     - ./data:/app:rw
     - /path/to/your/music:/music:rw
     - /path/to/your/ebooks:/ebooks:rw
   ```

2. Uncomment and modify the environment variable:

   ```yaml
   environment:
     - SLSKD_SHARED_DIR=/music;/ebooks
   ```

3. Restart the container:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### User Permissions

The container runs as user ID 1000 by default. If you need to change this:

1. Find your user ID:

   ```bash
   id -u
   ```

2. Update the `user` field in `docker-compose.yml`:
   ```yaml
   user: "1000:1000" # Change to your user ID
   ```

## Performance Improvements

This build includes several performance improvements for browsing large user lists:

- **Virtual Scrolling**: Reduces DOM nodes and memory usage when browsing directories with many items
- **Pagination**: Backend API endpoints support paginated browsing with search
- **Debounced Search**: Frontend search input is debounced to reduce API calls
- **Optimized Rendering**: React components use virtualization for better performance

## Troubleshooting

### Port Conflicts

If you get port binding errors, modify the port mappings in `docker-compose.yml`:

```yaml
ports:
  - "8080:5030/tcp" # Change 8080 to any available port
  - "8443:5031/tcp" # Change 8443 to any available port
  - "50300:50300/tcp" # Soulseek port should remain 50300
```

### Permission Issues

If you encounter permission issues with the data directory:

```bash
sudo chown -R 1000:1000 ./data
```

### Build Issues

If the build fails, try:

```bash
docker-compose build --no-cache
```

## Health Check

The container includes a health check that monitors the web interface. You can check the status with:

```bash
docker-compose ps
```

## Logs

View application logs:

```bash
docker-compose logs -f slskd
```

View build logs:

```bash
docker-compose logs -f slskd --tail=100
```
