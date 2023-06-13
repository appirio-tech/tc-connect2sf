# Base Image
FROM node:14.21.3

# Set working directory
WORKDIR /app

# Copy files to the working directory
COPY config config
COPY package.json .
COPY src src
COPY .babelrc .
COPY .eslintignore .
COPY .eslintrc .

# Install dependencies
RUN yarn install

# Command to start the app
CMD yarn start
