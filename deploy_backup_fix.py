"""
Deploy backup/restore fixes and orphan-scan fix, then verify.
"""
import paramiko, time

HOST = 'rcgapimtest.eastus2.cloudapp.azure.com'
USER = 'azureadmin'
PWD  = 'Microsoft12345'
PLUGIN = '/var/www/html/wp-content/plugins/research-review-portal'

print("Connecting...")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PWD, timeout=20)
sftp = ssh.open_sftp()

def run(cmd, timeout=30):
    _, o, e = ssh.exec_command(cmd, timeout=timeout)
    return o.read().decode().strip(), e.read().decode().strip()

def deploy(local, remote_name):
    sftp.put(local, f'/tmp/{remote_name}')
    run(f"echo '{PWD}' | sudo -S cp /tmp/{remote_name} {PLUGIN}/{local}")
    run(f"echo '{PWD}' | sudo -S chown www-data:www-data {PLUGIN}/{local}")
    run(f"echo '{PWD}' | sudo -S chmod 644 {PLUGIN}/{local}")
    print(f"  ✓ Deployed {local}")

# Deploy both PHP files
print("\nDeploying files...")
deploy('includes/class-portal-data.php', 'rrp_data.php')
deploy('includes/class-portal-rest.php', 'rrp_rest.php')
deploy('assets/portal.js', 'rrp_portal_js')

# ── Verify backup functions ──────────────────────────────────────────────────
print("\nVerifying backup function changes...")

checks = {
    'addFromString submissions': 'addFromString.*submissions',
    'addFromString config':      'addFromString.*config',
    'addFromString portal-db-meta': 'addFromString.*portal-db-meta',
    'write_submissions in restore': 'Portal_Data::write_submissions',
    'write_config in restore':   'Portal_Data::write_config',
    'write_webhooks in restore': 'Portal_Data::write_webhooks',
    'delete_transient after restore': 'delete_transient.*rrp_reviewer_scan',
    'no more addFile submissions.json': 'addFile.*submissions.json',  # should be 0
    'no more addFile config.json': 'addFile.*config.json',           # should be 0
    'no more file_put_contents restore': 'file_put_contents.*submissions\|file_put_contents.*config',  # should be 0
    'orphan scan uses wpdb->update': 'wpdb->update',
}

for label, pattern in checks.items():
    o, _ = run(f"grep -cP '{pattern}' {PLUGIN}/includes/class-portal-rest.php 2>/dev/null || echo 0")
    print(f"  {label}: {o.strip()}")

# Count wpdb->update in data.php (should be >=1 from orphan scan)
o, _ = run(f"grep -c 'wpdb->update' {PLUGIN}/includes/class-portal-data.php 2>/dev/null || echo 0")
print(f"  wpdb->update in data.php: {o.strip()}")

# ── Run orphan scan ──────────────────────────────────────────────────────────
print("\nClearing transient and running orphan scan...")
o, _ = run(f"echo '{PWD}' | sudo -S -u www-data wp eval 'delete_transient(\"rrp_reviewer_scan\"); echo \"transient cleared\";' --path=/var/www/html --allow-root 2>/dev/null")
print(f"  {o}")

o, e = run(f"echo '{PWD}' | sudo -S -u www-data wp eval 'Portal_Data::flag_orphaned_reviewer_assignments(true); echo \"scan done\";' --path=/var/www/html --allow-root 2>/dev/null")
print(f"  Scan: {o}")
if e:
    print(f"  Errors: {e[:300]}")

# Verify flagged submissions via DB
o, _ = run(f"echo '{PWD}' | sudo -S mysql -u root wordpress -N -e \"\
SELECT submission_id, status, JSON_EXTRACT(data, '$.reviewerRemoved') AS flagged \
FROM wp_rrp_submissions ORDER BY submission_id;\" 2>/dev/null")
print(f"\nSubmissions after scan:\n{o}")

flagged, _ = run(f"echo '{PWD}' | sudo -S mysql -u root wordpress -N -e \"\
SELECT COUNT(*) FROM wp_rrp_submissions \
WHERE JSON_EXTRACT(data, '$.reviewerRemoved') = true;\" 2>/dev/null")
print(f"\nFlagged count: {flagged}")

# ── Test backup API by simulating zip content listing ───────────────────────
print("\nTesting backup via WP eval (verifies DB read path)...")
o, e = run(f"""echo '{PWD}' | sudo -S -u www-data wp eval '
$subs = Portal_Data::read_submissions();
$cfg  = Portal_Data::read_config();
$wh   = Portal_Data::read_webhooks();
echo "Submissions in DB: ".count($subs["submissions"]).PHP_EOL;
echo "Config keys: ".implode(",",array_keys($cfg)).PHP_EOL;
echo "Webhooks count: ".count($wh).PHP_EOL;
$json = wp_json_encode(["submissions"=>$subs["submissions"],"nextIds"=>$subs["nextIds"]]);
echo "submissions.json size: ".strlen($json)." bytes".PHP_EOL;
' --path=/var/www/html --allow-root 2>/dev/null""")
print(o)
if e:
    print("Errors:", e[:300])

sftp.close()
ssh.close()
print("\nDone.")
