# ============================================================
# CityU Research Review Portal — Docker image
# Matches production stack: PHP 8.1 · Apache 2.4 · WordPress 6.7
# ============================================================
FROM wordpress:6.7-php8.1-apache

# ── PHP settings — match and improve over production defaults ────────
# Production has 2M upload limit; raise to 64M for research documents.
RUN { \
    echo 'upload_max_filesize = 64M';  \
    echo 'post_max_size       = 64M';  \
    echo 'max_execution_time  = 60';   \
    echo 'memory_limit        = 256M'; \
    echo 'file_uploads        = On';   \
} > /usr/local/etc/php/conf.d/rrp.ini

# ── WP-CLI ──────────────────────────────────────────────────────────
RUN curl -fsSL https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar \
        -o /usr/local/bin/wp \
    && chmod +x /usr/local/bin/wp

# ── One-time init script (WordPress install + plugin activate) ───────
COPY scripts/docker-init.sh /usr/local/bin/docker-init.sh
RUN chmod +x /usr/local/bin/docker-init.sh
