FROM ubuntu as base
RUN apt-get update -y && \
    apt-get install curl sudo fswatch git g++ -y && \
    rm -rf /var/lib/apt/lists/*
COPY --chown=root:root scripts/ci/prepare_linux.sh /usr/sbin/
RUN export DEBIAN_FRONTEND=noninteractive && prepare_linux.sh

RUN groupadd --gid 1000 datastation \
    && useradd --home-dir /home/datastation --create-home --uid 1000 \
    --gid 1000 --shell /bin/bash --skel /dev/null datastation
USER datastation
