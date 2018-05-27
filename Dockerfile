FROM ubuntu:18.04
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates htop build-essential git curl python make \
    && rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/nodejs/node ~/nodejs \
    && cd ~/nodejs && git checkout 687867dbf02e1d1b7a09faa7849a7b8136cacfa2 \
    && ./configure && make -j 4 && make install \
    && cd ~/ && rm -rf ~/nodejs
RUN npm install inquirer@5.2.0 chalk@2.4.1 sha1@1.1.1 sha256@0.2.0 md5@2.2.1
COPY main.js setup.js prompt.js util.js ~/
ENTRYPOINT ["node", "~/main.js"]
