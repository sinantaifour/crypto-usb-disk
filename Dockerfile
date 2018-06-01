FROM ubuntu:18.04
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && apt-get install -y --no-install-recommends build-essential git curl python make \
    && git clone https://github.com/nodejs/node /root/nodejs \
    && cd /root/nodejs && git checkout 687867dbf02e1d1b7a09faa7849a7b8136cacfa2 \
    && ./configure && make -j 4 && make install \
    && cd / && rm -rf /root/nodejs \
    && apt-get remove -y build-essential git curl python make \
    && apt-get autoremove -y && apt-get autoclean -y \
    && rm -rf /var/lib/apt/lists/*
RUN cd /root && npm install inquirer@5.2.0 chalk@2.4.1 sha1@1.1.1 sha256@0.2.0 md5@2.2.1
COPY main.js setup.js prompt.js util.js test.js /root/
CMD ["node", "/root/main.js"]
