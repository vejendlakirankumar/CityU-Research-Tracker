# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build the React frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS frontend-builder

WORKDIR /build

COPY frontend/package*.json ./
RUN npm install --silent

COPY frontend/ ./
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Install PHP dependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM composer:2 AS composer-builder

WORKDIR /build

COPY backend/composer.json backend/composer.lock* ./
RUN composer install \
    --no-dev \
    --optimize-autoloader \
    --no-interaction \
    --no-scripts

COPY backend/ ./
RUN composer run-script post-autoload-dump 2>/dev/null || true

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: Runtime image
# ─────────────────────────────────────────────────────────────────────────────
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PHP_VERSION=8.4

RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common \
    ca-certificates \
    && add-apt-repository -y ppa:ondrej/php \
    && apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    php${PHP_VERSION}-fpm \
    php${PHP_VERSION}-pgsql \
    php${PHP_VERSION}-redis \
    php${PHP_VERSION}-mbstring \
    php${PHP_VERSION}-xml \
    php${PHP_VERSION}-curl \
    php${PHP_VERSION}-zip \
    php${PHP_VERSION}-bcmath \
    php${PHP_VERSION}-intl \
    php${PHP_VERSION}-gd \
    curl \
    && rm -rf /var/lib/apt/lists/*

# PHP-FPM config: run as www-data, listen on TCP
RUN sed -i 's/^listen = .*/listen = 127.0.0.1:9000/' /etc/php/${PHP_VERSION}/fpm/pool.d/www.conf
RUN sed -i 's/^;daemonize = .*/daemonize = no/' /etc/php/${PHP_VERSION}/fpm/php-fpm.conf

# Nginx config
COPY docker/nginx.conf /etc/nginx/nginx.conf
RUN rm -f /etc/nginx/sites-enabled/default

# Copy Laravel app
COPY --from=composer-builder --chown=www-data:www-data /build /var/www/html

# Copy built React SPA
COPY --from=frontend-builder --chown=www-data:www-data /build/dist /var/www/frontend

# Set working directory so `docker exec rrp_app php artisan ...` works without a full path
WORKDIR /var/www/html

# Entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
