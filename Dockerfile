FROM ubuntu:18.04
RUN apt-get update
RUN apt-get install -y aptitude tree htop build-essential git curl python make
RUN git clone https://github.com/nodejs/node ~/nodejs
RUN cd ~/nodejs && git checkout 687867dbf02e1d1b7a09faa7849a7b8136cacfa2 # v10.1.0
RUN cd ~/nodejs && ./configure && make -j 4 && make install
RUN rm -rf ~/nodejs
RUN npm install inquirer@5.2.0 chalk@2.4.1 sha1@1.1.1 sha256@0.2.0 md5@2.2.1
COPY main.js setup.js util.js ~/
ENTRYPOINT ["node", "~/main.js"]
