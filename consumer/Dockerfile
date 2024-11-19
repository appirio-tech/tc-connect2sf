FROM node:12.22.12
LABEL version="1.0"
LABEL description="Topcoder Salesforce Integration"

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