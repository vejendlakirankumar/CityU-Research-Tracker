#!/bin/bash
# Deploy frontend changes and rebuild
set -e

# Copy updated frontend source files
echo "Copying updated frontend pages..."
cp /home/azureadmin/frontend-update/SubmissionsPage.tsx /var/www/rrp/frontend/src/pages/SubmissionsPage.tsx
cp /home/azureadmin/frontend-update/ReviewsPage.tsx /var/www/rrp/frontend/src/pages/ReviewsPage.tsx

# Fix ownership
sudo chown -R rrp:rrp /var/www/rrp/frontend/src/pages/

echo "Building frontend..."
cd /var/www/rrp/frontend
sudo -u rrp npm run build

echo "Frontend build completed successfully"
