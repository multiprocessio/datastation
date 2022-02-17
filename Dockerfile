FROM node:17
WORKDIR /datastation
EXPOSE 8080
COPY build /datastation
COPY node_modules /datastation/node_modules
CMD ["node", "/datastation/server.js"]