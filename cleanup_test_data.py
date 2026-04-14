import paramiko, json

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('rcgapimtest.eastus2.cloudapp.azure.com',
               username='azureadmin', password='Microsoft12345', timeout=30)

def run(cmd):
    _, out, err = client.exec_command(cmd)
    return (out.read().decode().strip() or err.read().decode().strip())

# The data is at the WSL path /mnt/c/Development/CityU-Research-Tracker/data/
# which maps to the Azure VM's Windows C:\Development\CityU-Research-Tracker\data\
data_path = '/mnt/c/Development/CityU-Research-Tracker/data/submissions.json'

print('Submissions file exists:', run(f'test -f "{data_path}" && echo YES || echo NO'))
print('File size:', run(f'wc -c "{data_path}" 2>/dev/null || echo NOT FOUND'))

# Clean test data
cleanup_script = f"""
import json, sys
with open('{data_path}', 'r', encoding='utf-8') as f:
    subs = json.load(f)
changed = 0
for s in subs:
    if s.get('coordinationLog') or s.get('gatedReleases'):
        print('Cleaning:', s['id'], '| clog:', len(s.get('coordinationLog',[])), '| releases:', len(s.get('gatedReleases',[])))
        s['coordinationLog'] = []
        s['gatedReleases'] = []
        changed += 1
if changed:
    with open('{data_path}', 'w', encoding='utf-8') as f:
        json.dump(subs, f, indent=2, ensure_ascii=False)
    print(f'Cleaned {{changed}} submission(s). Done.')
else:
    print('No test data to clean.')
"""

sftp = client.open_sftp()
with sftp.open('/tmp/clean_subs.py', 'w') as f:
    f.write(cleanup_script)
sftp.close()

print('\nCleaning test data:')
print(run('python3 /tmp/clean_subs.py; rm /tmp/clean_subs.py'))

client.close()
import paramiko, json

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('rcgapimtest.eastus2.cloudapp.azure.com',
               username='azureadmin', password='Microsoft12345', timeout=30)

def run(cmd):
    _, out, err = client.exec_command(cmd)
    return (out.read().decode().strip() or err.read().decode().strip())

# Find submissions.json
print('submissions.json location:')
print(run('find /var/www/html -name "submissions.json" 2>/dev/null | head -5'))

# Find what data dir Apache's PHP uses (write a marker file via API, find it)
marker_php = r"""<?php
define('ABSPATH','/var/www/html/');
chdir('/var/www/html');
require_once '/var/www/html/wp-load.php';
echo "RRP_DATA_DIR: " . (defined('RRP_DATA_DIR') ? RRP_DATA_DIR : 'NOT DEFINED') . "\n";
$subs_file = defined('RRP_DATA_DIR') ? RRP_DATA_DIR . 'submissions.json' : '';
if ($subs_file && file_exists($subs_file)) {
    $subs = json_decode(file_get_contents($subs_file), true);
    echo "Found submissions: " . count($subs) . "\n";
    foreach (array_slice($subs, 0, 3) as $s) {
        echo "  " . $s['id'] . " | coordinationLog: " . count($s['coordinationLog'] ?? []) . " | gatedReleases: " . count($s['gatedReleases'] ?? []) . "\n";
    }
    // Clean test data
    $cleaned = 0;
    foreach ($subs as &$s) {
        if ($s['id'] === 'DIS-2026-001') {
            $s['coordinationLog'] = [];
            $s['gatedReleases'] = [];
            $cleaned++;
        }
    }
    file_put_contents($subs_file, json_encode($subs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    echo "Cleaned $cleaned submission(s)\n";
} else {
    echo "submissions.json not found at: $subs_file\n";
}
"""

sftp = client.open_sftp()
with sftp.open('/tmp/rrp_find.php', 'w') as f:
    f.write(marker_php)
sftp.close()

print('\nPHP context check:')
print(run('php /tmp/rrp_find.php 2>&1 | grep -v "already defined\|Warning\|Constant"; rm /tmp/rrp_find.php'))

client.close()
import paramiko, json

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('rcgapimtest.eastus2.cloudapp.azure.com',
               username='azureadmin', password='Microsoft12345', timeout=30)

# Write a PHP cleanup script to the server, run it, then delete it
cleanup_php = r"""<?php
define('ABSPATH','/var/www/html/');
chdir('/var/www/html');
require_once '/var/www/html/wp-load.php';
$data_dir = '/var/www/html/wp-content/plugins/research-review-portal/data/';
$subs_file = $data_dir . 'submissions.json';
if (!file_exists($subs_file)) { echo "submissions.json not found\n"; exit; }
$subs = json_decode(file_get_contents($subs_file), true);
if (!$subs) { echo "Could not parse submissions.json\n"; exit; }
$cleaned = 0;
foreach ($subs as &$s) {
    if ($s['id'] === 'DIS-2026-001') {
        $s['coordinationLog'] = [];
        $s['gatedReleases'] = [];
        $cleaned++;
    }
}
file_put_contents($subs_file, json_encode($subs, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
echo "Cleaned $cleaned submission(s). Done.\n";
"""

sftp = client.open_sftp()
with sftp.open('/tmp/rrp_cleanup.php', 'w') as f:
    f.write(cleanup_php)
sftp.close()

_, out, err = client.exec_command('php /tmp/rrp_cleanup.php 2>&1; rm /tmp/rrp_cleanup.php')
result = out.read().decode().strip() or err.read().decode().strip()
print('Cleanup result:', result)

client.close()
