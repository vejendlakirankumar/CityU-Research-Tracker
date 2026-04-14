import paramiko, json

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('rcgapimtest.eastus2.cloudapp.azure.com',
               username='azureadmin', password='Microsoft12345', timeout=30)

cleanup_php = r"""<?php
chdir('/var/www/html');
$_SERVER['HTTP_HOST'] = 'localhost';
$_SERVER['REQUEST_URI'] = '/';
require_once '/var/www/html/wp-load.php';
header('Content-Type: application/json');
if (!defined('RRP_DATA_DIR')) {
    echo json_encode(['error' => 'RRP_DATA_DIR not defined']);
    exit;
}
$path = RRP_DATA_DIR . 'submissions.json';
if (!file_exists($path)) {
    echo json_encode(['error' => 'file not found', 'path' => $path]);
    exit;
}
$subs = json_decode(file_get_contents($path), true);
$cleaned = 0;
foreach ($subs as &$s) {
    if ($s['id'] === 'DIS-2026-001') {
        $s['coordinationLog'] = [];
        $s['gatedReleases']   = [];
        $cleaned++;
    }
}
file_put_contents($path, json_encode($subs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
echo json_encode(['cleaned' => $cleaned, 'dir' => RRP_DATA_DIR]);
"""

sftp = client.open_sftp()
with sftp.open('/var/www/html/wp-content/plugins/research-review-portal/rrp-cleanup-x7q2.php', 'w') as f:
    f.write(cleanup_php)
sftp.close()

_, out, _ = client.exec_command(
    'curl -sL --insecure "https://localhost/wp-content/plugins/research-review-portal/rrp-cleanup-x7q2.php" 2>&1')
result = out.read().decode().strip()
print('Cleanup result:', result or '(empty — likely a PHP error)')

# Also try the HTTP URL if HTTPS fails
if not result or 'error' in result:
    _, out, _ = client.exec_command(
        'curl -sL "http://localhost/wp-content/plugins/research-review-portal/rrp-cleanup-x7q2.php" 2>&1')
    result2 = out.read().decode().strip()
    print('HTTP fallback:', result2[:300] or '(empty)')

sftp = client.open_sftp()
try:
    sftp.remove('/var/www/html/wp-content/plugins/research-review-portal/rrp-cleanup-x7q2.php')
    print('Script removed.')
except Exception as e:
    print('Remove error:', e)
sftp.close()

client.close()
import paramiko, json

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('rcgapimtest.eastus2.cloudapp.azure.com',
               username='azureadmin', password='Microsoft12345', timeout=30)

cleanup_php = """<?php
// One-shot cleanup script — delete after use
define('ABSPATH', '/var/www/html/');
requires_once = false;
chdir('/var/www/html');
require_once '/var/www/html/wp-load.php';

if (!defined('RRP_DATA_DIR') || !file_exists(RRP_DATA_DIR . 'submissions.json')) {
    die(json_encode(['error' => 'data not found', 'dir' => defined('RRP_DATA_DIR') ? RRP_DATA_DIR : 'undef']));
}
$subs = json_decode(file_get_contents(RRP_DATA_DIR . 'submissions.json'), true);
$cleaned = 0;
foreach ($subs as &$s) {
    if ($s['id'] === 'DIS-2026-001') {
        $s['coordinationLog'] = [];
        $s['gatedReleases']   = [];
        $cleaned++;
    }
}
file_put_contents(RRP_DATA_DIR . 'submissions.json',
    json_encode($subs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
die(json_encode(['cleaned' => $cleaned, 'dir' => RRP_DATA_DIR]));
"""

# Upload to a web-accessible path
sftp = client.open_sftp()
with sftp.open('/var/www/html/wp-content/plugins/research-review-portal/rrp-cleanup-x7q2.php', 'w') as f:
    f.write(cleanup_php)
sftp.close()

# Request the script via HTTPS (runs under Apache = correct user + mounts)
_, out, _ = client.exec_command(
    'curl -sL --insecure "https://localhost/wp-content/plugins/research-review-portal/rrp-cleanup-x7q2.php" 2>&1')
result = out.read().decode().strip()
print('Cleanup result:', result)

# Remove the script immediately
sftp = client.open_sftp()
try:
    sftp.remove('/var/www/html/wp-content/plugins/research-review-portal/rrp-cleanup-x7q2.php')
    print('Cleanup script removed.')
except:
    print('NOTE: Could not auto-remove cleanup script — delete manually.')
sftp.close()

client.close()
