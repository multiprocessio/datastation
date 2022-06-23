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
    'arch': {
        'x86_64': 'x64',
        'amd64': 'x64',
        'aarch64': 'arm64',
        'arm64': 'arm64',
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
    'required_ext': {
        'linux': '',
        'darwin': '',
        'windows': '.exe',
    }[platform.system().lower()],
    'static_libodbc_flag': {
        'linux': '-extldflags=-l:libodbc.a',
        'darwin': '-extldflags=-l:libodbc.a',
        'windows': '',
    }[platform.system().lower()]
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
            while True:
                if command[i] == '"':
                    if i > 0 and command[i-1] == '\\':
                        token = token[:-1] + command[i]
                        i += 1
                        continue
                    break
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


def quote_line(line, join=True, show=False):
    cp = [*line]
    for i, t in enumerate(cp):
            if " " in t or (t == "" and show):
                quoted =  f'"{t}"'
                # Handle rejoining quotes like -ldflags="-w -s"
                # vs. coming out as -ldflags= "-w -s" (with a space
                # between)
                if i > 0 and cp[i-1].endswith('='):
                    cp[i-1] += quoted
                    del cp[i]
                else:
                    cp[i] = quoted
    l = cp if not join else ' '.join(cp)
    if show:
        print(l)
    else:
        return l


def eval_line(line):
    if line[0] == 'render':
        with open(line[1]) as r:
            _in = r.read()
        out = _in.format(**BUILTIN_VARIABLES, **os.environ)    
        with open(line[2], 'w') as w:
            w.write(out)
        quote_line(line, show=True)
        return
    if line[0] == 'setenv':
        os.environ[line[1]] = line[2].format(**BUILTIN_VARIABLES, **os.environ)
        quote_line(line, show=True)
        return
    if line[0] == 'setenv_default':
        if line[1] not in os.environ:
            os.environ[line[1]] = line[2]
        quote_line(line, show=True)
        return
    if line[0] == 'cd' and line[2] == '&&':
        previousdir = os.getcwd()
        os.chdir(line[1])
        eval_line(line[3:])
        os.chdir(previousdir)
        return
    if line[0] == 'cp' and IS_WINDOWS:
        line[0] = 'copy'

        if line[1] == '-r':
            shutil.copytree(line[2], line[3])
            quote_line(line, show=True)
            return
    elif line[0] == 'rm' and line[1] == '-rf' and IS_WINDOWS:
        quote_line(line, show=True)
        for todelete in line[2:]:
            shutil.rmtree(todelete, ignore_errors=True)
        return
    elif line[0] == 'mkdir':
        quote_line(line, show=True)
        for tomake in line[1:]:
            pathlib.Path(tomake).mkdir(parents=True, exist_ok=True)
        return
    elif line[0] == 'append':
        what = line[1]
        to = line[2]
        quote_line(line, show=True)
        with open(to, 'a') as to:
            to.write('\n'+what)
        return
    elif line[0] == 'prepend':
        what = line[1]
        to = line[2]
        quote_line(line, show=True)
        if not what:
            return
        try:
            with open(to, 'rb+') as to:
                current = to.read()
                to.seek(0)
                to.write(what.encode()+b'\n'+current)
                to.truncate()
        except FileNotFoundError:
            with open(to, 'w') as to:
                to.write(what)
        return

    quote_line(line, show=True)
    if 'powershell' in str(os.environ.get('COMSPEC')):
        subprocess.run(line, check=True, shell=True, env=env)
    else:
        if os.system(quote_line(line)):
            raise Exception('non-zero exit code')


for command in script:
    if command.strip().startswith('#') or not command.strip():
        continue

    line = lex_command(command)
    for i, token in enumerate(line):
        if i == 0:
            continue
        # Do basic variable substitition
        line[i] = token.format(**BUILTIN_VARIABLES, **os.environ)

    eval_line(line)
