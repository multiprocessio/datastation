"""
This is a silly wrapper around shell scripting that isn't verbose and
will work on Windows and the *nixes.
"""

import os
import platform
import sys

IS_WINDOWS = os.name == 'nt'

BUILTIN_VARIABLES = {
    'arch': {
        'x86_64': 'x64',
        'aarch64': 'arm64',
    }[platform.machine()],
    'os': platform.system().lower(),
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

    print(' '.join(line))

    if line[0] == 'cp' and IS_WINDOWS:
        line[0] = 'copy'
    elif line[0] == 'append':
        what = line[1]
        to = line[2]
        with open(to, 'a') as to:
            to.write('\n'+what)
        continue
    elif line[0] == 'prepend':
        what = line[1]
        to = line[2]
        with open(to, 'r+') as to:
            current = to.read()
            to.seek(0)
            to.write(what+'\n'+current)
            to.truncate()
        continue

    # Quote arguments when passing back to system
    for i, token in enumerate(line):
        if i == 0: continue

        line[i] = '"{}"'.format(token)
    line = ' '.join(line)

    os.system(line)
