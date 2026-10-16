#!/usr/bin/env python3
"""Exec a disposable test broker with bounded file descriptors inherited from the JVM."""

import os
import resource
import sys

if __name__ == "__main__":
    # Some macOS JVMs raise RLIMIT_NOFILE to billions. Mosquitto's poll backend allocates
    # one slot per permitted descriptor; bound the child without changing the parent JVM.
    soft, hard = resource.getrlimit(resource.RLIMIT_NOFILE)
    maximum = 1024 if hard == resource.RLIM_INFINITY else min(1024, hard)
    resource.setrlimit(resource.RLIMIT_NOFILE, (maximum, hard))
    os.execvp(sys.argv[1], sys.argv[1:])
