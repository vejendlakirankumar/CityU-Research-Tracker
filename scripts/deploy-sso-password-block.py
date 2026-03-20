"""
Deploy SSO password-login lockout fixes.

Files deployed:
  research-review-portal.php      — new authenticate filter blocks SSO users
  includes/class-portal-rest.php  — blocks password change/reset for SSO users
"""

import paramiko, sys

HOST     = 'your-portal.example.com'  # replace with your VM hostname
PORT     = 22
USER     = 'azureadmin'
PASSWORD = 'YOUR_VM_PASSWORD'         # replace with your VM password
PLUGIN   = '/var/www/html/wp-content/plugins/research-review-portal'

FILES = [
    ('research-review-portal.php',      f'{PLUGIN}/research-review-portal.php'),
    ('includes/class-portal-rest.php',  f'{PLUGIN}/includes/class-portal-rest.php'),
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    print(f'Connected to {HOST}')

    sftp = client.open_sftp()
    for local, remote in FILES:
        tmp = f'/tmp/{local.replace("/", "_")}'
        print(f'Uploading {local} ...', end=' ', flush=True)
        sftp.put(local, tmp)
        print('OK')

        sudo = f'echo {PASSWORD} | sudo -S'
        _, stdout, stderr = client.exec_command(
            f'{sudo} mv {tmp} {remote} && '
            f'{sudo} chown www-data:www-data {remote} && '
            f'{sudo} chmod 644 {remote}'
        )
        rc = stdout.channel.recv_exit_status()
        err = '\n'.join(l for l in stderr.read().decode().splitlines() if 'password for' not in l.lower())
        if rc != 0 and err:
            print(f'  WARNING: {err}')
    sftp.close()

    # PHP syntax check both files
    print('\nPHP syntax checks:')
    for _, remote in FILES:
        _, stdout, stderr = client.exec_command(f'php -l {remote}')
        result = stdout.read().decode().strip() + stderr.read().decode().strip()
        status = 'OK' if 'No syntax errors' in result else f'FAILED — {result}'
        print(f'  {remote.split("/")[-1]}: {status}')
        if 'FAILED' in status:
            sys.exit(1)

    # Graceful Apache reload
    print('\nReloading Apache...', end=' ', flush=True)
    _, stdout, _ = client.exec_command(f'echo {PASSWORD} | sudo -S apache2ctl graceful 2>/dev/null')
    stdout.channel.recv_exit_status()
    print('Done.')

    print('\nAll files deployed. SSO password-login lockout is now active.')

except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
finally:
    client.close()
