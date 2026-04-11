# ── Stage 1: Build dependencies ──────────────────────────────────
FROM php:8.2-cli AS builder

# Install system libs needed by pecl/mongodb and composer
RUN apt-get update && apt-get install -y \
    libssl-dev \
    pkg-config \
    unzip \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install MongoDB PHP extension
RUN pecl install mongodb && docker-php-ext-enable mongodb

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-interaction

# ── Stage 2: Production image ────────────────────────────────────
FROM php:8.2-cli

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    libssl-dev \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install MongoDB extension in production image
RUN pecl install mongodb && docker-php-ext-enable mongodb

WORKDIR /app

# Copy vendor from builder
COPY --from=builder /app/vendor ./vendor

# Copy application source
COPY . .

# Create uploads directory
RUN mkdir -p uploads/certs && chmod -R 777 uploads

# Copy supervisor config
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose API port and WS port
EXPOSE 8000 8001

# Use supervisor to run both HTTP API and WebSocket server
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
