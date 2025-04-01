FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
# Using npm install instead of npm ci to handle package-lock.json mismatches
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port the app runs on
EXPOSE 5173

# Command to run the application
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]