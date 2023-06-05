# Base Image
FROM node:14.21.3
LABEL version="1.0"
LABEL description="Topcoder Salesforce Integration"

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Bundle app source
COPY . /usr/src/app

# Install app dependencies
RUN yarn install

RUN yarn global add forever babel-cli

EXPOSE 3000

ENTRYPOINT ["yarn","run"]
