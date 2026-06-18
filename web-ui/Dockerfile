FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# --host 0.0.0.0 so Windows can reach the container-mapped port
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
