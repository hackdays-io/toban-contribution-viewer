FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Create data directory
RUN mkdir -p /app/data

# Copy application code
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
