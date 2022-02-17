FROM node:17-slim
WORKDIR /datastation
EXPOSE 8080
COPY package.json /datastation
COPY build /datastation/build
COPY node_modules /datastation/node_modules
CMD ["node", "/datastation/build/server.js"]