# Base Image
FROM node:14.21.3
LABEL version="1.0"
LABEL description="Topcoder Salesforce Integration"

# Adding sources list back to the sources.list.d directory
RUN echo "deb http://archive.debian.org/debian/ jessie-backports main" > /etc/apt/sources.list.d/jessie-backports.list
RUN sed -i '/jessie-updates/d' /etc/apt/sources.list
RUN sed -i 's|security.debian.org|archive.debian.org/debian-security|' /etc/apt/sources.list
RUN sed -i 's/deb.debian/archive.debian/' /etc/apt/sources.list

RUN apt-get -o Acquire::Check-Valid-Until=false update && \
    apt-get upgrade -y --force-yes

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install yarn
RUN npm install -g yarn

# Bundle app source
COPY . /usr/src/app
# Install app dependencies
RUN yarn install

RUN yarn global add forever babel-cli

EXPOSE 3000

ENTRYPOINT ["yarn","run"]
