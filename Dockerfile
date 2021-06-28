FROM node:16-alpine

COPY --chown=node:node . /home/node/app

USER node

WORKDIR /home/node/app

RUN npm ci --only=production --no-audit

EXPOSE 3000

CMD ["npm", "start"]
