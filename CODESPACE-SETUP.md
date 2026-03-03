# GitHub Codespace Setup for Research Review Portal

## Quick Start Guide

### 1. Open in GitHub Codespace
1. Push current code to GitHub repository
2. Open repository in GitHub Codespace
3. Codespace should auto-provision with PHP/WordPress environment

### 2. Verify Environment
```bash
# Check PHP version (should be 7.4+)
php --version

# Check if WordPress CLI is available
wp --info

# Verify file structure
ls -la
```

### 3. WordPress Setup (if needed)
```bash
# If WordPress not installed, download and configure
wp core download
wp config create --dbname=wordpress --dbuser=root --dbpass=password --dbhost=localhost
wp core install --url=localhost:8080 --title="Research Portal Dev" --admin_user=admin --admin_password=admin --admin_email=admin@example.com
```

### 4. Plugin Activation
```bash
# Create plugins directory if needed
mkdir -p wp-content/plugins

# Copy plugin files (or create symlink)
cp -r . wp-content/plugins/research-review-portal/

# Activate plugin
wp plugin activate research-review-portal
```

### 5. Run Sprint 1 Tests
```bash
cd wp-content/plugins/research-review-portal
php testing/sprint1-test-runner.php
```

### 6. Test Web Interface
```bash
# Start WordPress development server
wp server --host=0.0.0.0 --port=8080
```

Then access:
- Main site: `https://[codespace-url]:8080`
- Process docs: `https://[codespace-url]:8080?page_id=1` (add shortcode to page)
- Admin: `https://[codespace-url]:8080/wp-admin`

## File Verification Checklist

Ensure these files exist and have content:

### Core Plugin Files:
- [ ] `research-review-portal.php` (main plugin file)
- [ ] `data/config.json`
- [ ] `data/reviewers.json` 
- [ ] `data/submissions.json`

### New Sprint 1 Files:
- [ ] `includes/class-user-management.php`
- [ ] `includes/class-process-documentation.php`
- [ ] `assets/process-docs.css`
- [ ] `assets/process-docs.js`
- [ ] `testing/sprint1-test-runner.php`

### Documentation:
- [ ] `requirements.md`
- [ ] `SPRINT1-CHECKPOINT.md`
- [ ] `testing/sprint1-test-plan.md`

## Common Issues & Solutions

### Issue: Plugin won't activate
**Solution**: Check PHP syntax
```bash
php -l research-review-portal.php
php -l includes/*.php
```

### Issue: Database connection error
**Solution**: Verify WordPress config
```bash
wp config get
```

### Issue: Permissions error
**Solution**: Check file permissions
```bash
chmod 644 *.php
chmod -R 644 includes/
```

### Issue: Assets not loading
**Solution**: Verify WordPress URL settings
```bash
wp option get home
wp option get siteurl
```

## Testing Commands

### Quick validation:
```bash
# Test plugin activation
wp plugin status research-review-portal

# Test user roles
wp role list | grep research

# Test REST API
curl -X GET "localhost:8080/wp-json/research-portal/v1/process-docs"
```

### Full test suite:
```bash
php testing/sprint1-test-runner.php
```

---
**Once testing is complete in Codespace, you'll be ready for Sprint 2! 🚀**