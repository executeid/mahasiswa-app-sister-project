# Use an official Node.js runtime as a parent image
FROM node:18-alpine

# Set the working directory to /app
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install any dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3001 
# academic-service akan menggunakan port 3001

# Run the app
CMD [ "npm", "start" ]
#CMD [ "sh", "-c", "tail -f /dev/null" ]