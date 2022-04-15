#!/usr/bin/env python3

import json
import subprocess

pinned = {
    # Can't upgrade to React 18 until we drop Enzyme
    'react': '17',
    'react-dom': '17',
    '@types/react': '17',
    '@types/react-dom': '17',
    # node-fetch 3 breaks because it requires everything to be jsmodules
    'node-fetch': '2',
}

def upgrade_section(items, extra_flag):
    packages = []
    to_remove = []
    for package, version in items:
        to_remove.append(package)

        if pinned.get(package):
            package += '@'+pinned[package]
        if version.startswith('npm:'):
            package += '@' + version

        packages.append(package)

    subprocess.run(['yarn', 'remove'] + to_remove, check=True)
    add = ['yarn', 'add']
    if extra_flag:
        add.append(extra_flag)
    subprocess.run(add + packages, check=True)

with open('package.json') as p:
    j = json.load(p)
    upgrade_section(j['dependencies'].items(), '')
    upgrade_section(j['devDependencies'].items(), '--dev')
