FROM node:16

COPY build /datastation
COPY node_modules /datastation/node_modules
CMD node /server.js
