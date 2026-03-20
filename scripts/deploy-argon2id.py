"""
Deploy mu-plugin: Argon2id Password Hashing for WordPress

Uploads scripts/mu-argon2id-passwords.php to
/var/www/html/wp-content/mu-plugins/argon2id-passwords.php

Must-use plugins are loaded automatically by WordPress — no activation step.
"""

import paramiko, sys

HOST     = 'your-portal.example.com'  # replace with your VM hostname
PORT     = 22
USER     = 'azureadmin'
PASSWORD = 'YOUR_VM_PASSWORD'         # replace with your VM password

LOCAL_FILE  = 'scripts/mu-argon2id-passwords.php'
REMOTE_DIR  = '/var/www/html/wp-content/mu-plugins'
REMOTE_FILE = REMOTE_DIR + '/argon2id-passwords.php'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=30)
    print(f'Connected to {HOST}')

    # Create mu-plugins directory if it doesn't exist
    _, stdout, stderr = client.exec_command(f'mkdir -p {REMOTE_DIR}')
    stdout.channel.recv_exit_status()

    # Upload to /tmp first (azureadmin has write access), then sudo-move into place
    TMP_FILE = '/tmp/argon2id-passwords.php'

    sftp = client.open_sftp()
    print(f'Uploading {LOCAL_FILE} -> {TMP_FILE} ...', end=' ', flush=True)
    sftp.put(LOCAL_FILE, TMP_FILE)
    print('OK')
    sftp.close()

    # Move into mu-plugins and fix ownership (requires sudo)
    print('Installing into mu-plugins...', end=' ', flush=True)
    sudo = f'echo {PASSWORD} | sudo -S'
    _, stdout, stderr = client.exec_command(
        f'{sudo} mv {TMP_FILE} {REMOTE_FILE} && '
        f'{sudo} chown www-data:www-data {REMOTE_FILE} && '
        f'{sudo} chmod 644 {REMOTE_FILE}'
    )
    exit_code = stdout.channel.recv_exit_status()
    err = stderr.read().decode().strip()
    # sudo -S echoes the password prompt to stderr — filter it out
    real_err = '\n'.join(l for l in err.splitlines() if 'password for' not in l.lower())
    if exit_code != 0 and real_err:
        print('WARNING:', real_err)
    else:
        print('OK')

    # Verify it landed correctly
    _, stdout, _ = client.exec_command(f'ls -lh {REMOTE_FILE}')
    print('Remote file:', stdout.read().decode().strip())

    # Quick sanity check: PHP syntax
    print('PHP syntax check...', end=' ', flush=True)
    _, stdout, stderr = client.exec_command(f'php -l {REMOTE_FILE}')
    result = stdout.read().decode().strip() + stderr.read().decode().strip()
    if 'No syntax errors' in result:
        print('OK')
    else:
        print('FAILED -', result)
        sys.exit(1)

    # Confirm Argon2id is available on the server
    _, stdout, _ = client.exec_command("php -r \"echo defined('PASSWORD_ARGON2ID') ? 'Argon2id: AVAILABLE' : 'Argon2id: NOT available (libargon2 missing)';\"")
    print(stdout.read().decode().strip())

    print('\nDone. Mu-plugin is active — no WordPress activation step needed.')
    print('Existing user passwords will be transparently upgraded to Argon2id')
    print('on each user\'s next successful login.')

except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
finally:
    client.close()
