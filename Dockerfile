FROM mcr.microsoft.com/playwright:v1.61.1-jammy

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
RUN npx patchright install --with-deps chrome



COPY . .

EXPOSE 3000
CMD ["node", "src/app.js"]