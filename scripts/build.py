"""
This is a silly wrapper around shell scripting that isn't verbose and
will work on Windows and the *nixes.
"""

import os
import sys

IS_WINDOWS = os.name == 'nt'

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
    if command.strip().startswith('#'):
        continue

    line = lex_command(command)
    print(' '.join(line))
    
    if line[0] == 'cp' and IS_WINDOWS:
        line[0] = 'copy'
    elif line[0] == 'append':
        what = line[1]
        to = line[2]
        with open(to, 'a') as to:
            to.write('\n'+what)
        continue

    line = ' '.join(line)

    os.system(line)
