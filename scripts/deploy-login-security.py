import paramiko, sys

HOST     = 'your-portal.example.com'  # replace with your VM hostname
PORT     = 22
USER     = 'azureadmin'
PASSWORD = 'YOUR_VM_PASSWORD'         # replace with your VM password
PLUGIN   = '/var/www/html/wp-content/plugins/research-review-portal'

FILES = [
    ('research-review-portal.php',     PLUGIN + '/research-review-portal.php'),
    ('includes/class-portal-rest.php', PLUGIN + '/includes/class-portal-rest.php'),
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
print('Connected to ' + HOST)

sftp = client.open_sftp()
for local, remote in FILES:
    tmp = '/tmp/' + local.replace('/', '_')
    print('Uploading ' + local + ' ...', end=' ', flush=True)
    sftp.put(local, tmp)
    print('OK')
    sudo = 'echo ' + PASSWORD + ' | sudo -S'
    cmd  = sudo + ' mv ' + tmp + ' ' + remote + ' && ' + sudo + ' chown www-data:www-data ' + remote + ' && ' + sudo + ' chmod 644 ' + remote
    _, stdout, stderr = client.exec_command(cmd)
    exit_code = stdout.channel.recv_exit_status()
    err = '\n'.join(ln for ln in stderr.read().decode().splitlines() if 'password for' not in ln.lower())
    if exit_code != 0 and err:
        print('  WARNING: ' + err)
sftp.close()

print('\nPHP syntax checks:')
for _, remote in FILES:
    _, stdout, stderr = client.exec_command('php -l ' + remote)
    result = stdout.read().decode().strip() + stderr.read().decode().strip()
    status = 'OK' if 'No syntax errors' in result else ('FAILED: ' + result)
    print('  ' + remote.split('/')[-1] + ': ' + status)
    if 'FAILED' in status:
        client.close()
        sys.exit(1)

_, stdout, _ = client.exec_command('echo ' + PASSWORD + ' | sudo -S apache2ctl graceful 2>/dev/null')
stdout.channel.recv_exit_status()
print('\nApache graceful reload complete.')
print('Done.')
client.close()
