"""
This is a silly wrapper around shell scripting that isn't verbose and
will work on Windows and the *nixes.
"""

import os
import pathlib
import platform
import shutil
import subprocess
import sys

IS_WINDOWS = os.name == 'nt'

BUILTIN_VARIABLES = {
    **os.environ,
    'arch': {
        'x86_64': 'x64',
        'amd64': 'x64',
        'aarch64': 'arm64',
    }[platform.machine().lower()],
    'os': {
        'darwin': 'darwin',
        'linux': 'linux',
        'windows': 'win32',
    }[platform.system().lower()],
    'ext': {
        'linux': '',
        'darwin': '.app',
        'windows': '.exe',
    }[platform.system().lower()],
}
for i, arg in enumerate(sys.argv[2:]):
    BUILTIN_VARIABLES['arg'+str(i)] = arg

with open(sys.argv[1]) as f:
    script = f.read().split('\n')


def lex_command(command):
    line = []
    i = 0
    token = ''
    while i < len(command):
        c = command[i]
        if c == ' ':
            if not token:
                i += 1
                continue

            if IS_WINDOWS:
                token = token.replace('/', '\\')
            line.append(token)
            token = ''
            i += 1
            continue

        if c == '"':
            if token:
                if IS_WINDOWS:
                    token = token.replace('/', '\\')
                line.append(token)
                token = ''
            i += 1 # Skip first "
            while command[i] != '"':
                token += command[i]
                i += 1
            i += 1 # Skip last "
            line.append(token)
            token = ''
            i += 1 # Move onto next character
            continue

        token += c
        i += 1
        continue

    if token:
        if IS_WINDOWS:
            token = token.replace('/', '\\')
        line.append(token)

    return line

for command in script:
    if command.strip().startswith('#') or not command.strip():
        continue

    line = lex_command(command)
    for i, token in enumerate(line):
        if i == 0:
            continue
        # Do basic variable substitition
        line[i] = token.format(**BUILTIN_VARIABLES)

    if line[0] == 'setenv':
        os.environ[line[1]] = line[2]
        print(' '.join(line))
        continue
    if line[0] == 'cp' and IS_WINDOWS:
        line[0] = 'copy'
    elif line[0] == 'rm' and line[1] == '-rf' and IS_WINDOWS:
        print(' '.join(line))
        for todelete in line[2:]:
            shutil.rmtree(todelete, ignore_errors=True)
        continue
    elif line[0] == 'mkdir':
        print(' '.join(line))
        for tomake in line[1:]:
            pathlib.Path(tomake).mkdir(parents=True, exist_ok=True)
        continue
    elif line[0] == 'append':
        what = line[1]
        to = line[2]
        print(' '.join(line))
        with open(to, 'a') as to:
            to.write('\n'+what)
        continue
    elif line[0] == 'prepend':
        what = line[1]
        to = line[2]
        print(' '.join(line))
        with open(to, 'r+') as to:
            current = to.read()
            to.seek(0)
            to.write(what+'\n'+current)
            to.truncate()
        continue

    print(' '.join(line))
    if 'powershell' in str(os.environ.get('COMSPEC')):
        subprocess.run(line, check=True, shell=True, env=env)
    else:
        for i, t in enumerate(line):
            if " " in t:
                line[i] = '"' + t + '"'
        os.system(' '.join(line))
