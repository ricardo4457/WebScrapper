FROM mcr.microsoft.com/playwright:v1.61.1-jammy

# Xvfb + dbus para permitir correr o Chrome em headed mode (headless: false)
# dentro do container, necessário para o Patchright contornar deteção da Cloudflare.
# x11-utils dá-nos o xdpyinfo, usado no entrypoint para confirmar que o Xvfb
# já está pronto antes de lançarmos o Chrome.
RUN apt-get update && apt-get install -y \
    xvfb \
    dbus-x11 \
    x11-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install
RUN npx patchright install --with-deps chrome

COPY . .

RUN sed -i 's/\r$//' src/config/entrypoint.sh && chmod +x src/config/entrypoint.sh

ENV DISPLAY=:99

EXPOSE 3000
ENTRYPOINT ["./src/config/entrypoint.sh"]
CMD ["node", "src/app.js"]