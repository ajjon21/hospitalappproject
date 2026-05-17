FROM php:8.2-apache

WORKDIR /var/www/html

COPY . /var/www/html/

# Set ownership + permissions so Apache can read files
RUN chown -R www-data:www-data /var/www/html \
    && find /var/www/html -type d -exec chmod 755 {} \; \
    && find /var/www/html -type f -exec chmod 644 {} \;

EXPOSE 80