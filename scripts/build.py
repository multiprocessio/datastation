"""
This is a silly wrapper around shell scripting that isn't verbose and
will work on Windows and the *nixes.
"""

import os
import sys

IS_WINDOWS = os.name == 'nt'

with open(sys.argv[1]) as f:
    script = f.read().split('\n')

for line in script:
    line = line.split(' ')
    if line[0] == 'cp' and IS_WINDOWS:
        line[0] = 'copy'
    line = ' '.join(line)

    if line.startswith('#'):
        continue

    print(line)
    os.system(line)
