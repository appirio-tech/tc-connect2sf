FROM node:6.9.4
LABEL version="1.0"
LABEL description="Topcoder Salesforce Integration"

RUN sed -i '/jessie-updates/d' /etc/apt/sources.list
RUN sed -i 's|security.debian.org|archive.debian.org/debian-security|' /etc/apt/sources.list
RUN sed -i 's/deb.debian/archive.debian/' /etc/apt/sources.list

RUN apt-get update && \
    apt-get upgrade -y --force-yes

#RUN apt-get install cron -y


# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Bundle app source
COPY . /usr/src/app
# Install app dependencies
RUN npm install

RUN npm install -g forever babel-cli

#RUN crontab config/scheduler-cron

#RUN service cron start

EXPOSE 3000

ENTRYPOINT ["npm","run"]
# CMD forever -c "npm start" --uid "consumer"  .
