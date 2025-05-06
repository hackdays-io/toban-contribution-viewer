FROM node:18-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

# Create data directory if it doesn't exist
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]
