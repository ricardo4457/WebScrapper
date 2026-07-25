FROM mcr.microsoft.com/playwright:v1.61.1-jammy

# Required dependencies to run browsers in headed mode inside Docker.
# Xvfb provides a virtual display environment.
RUN apt-get update && apt-get install -y \
    xvfb \
    dbus-x11 \
    x11-utils \
    build-essential \
    python3 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy dependencies first to improve Docker cache usage.
COPY package*.json ./

RUN npm install

# Alternative browser engine used when required.
RUN npm install camoufox-js

# Install Chrome required by Patchright.
RUN npx patchright install --with-deps chrome

# Download Camoufox browser files.
# Uses BuildKit cache to avoid downloading again on every build.
RUN --mount=type=cache,target=/root/.cache/camoufox-fetch-cache \
    mkdir -p /root/.cache/camoufox-fetch-cache/install \
    && CAMOUFOX_INSTALL_DIR=/root/.cache/camoufox-fetch-cache/install npx camoufox-js fetch \
    && rm -rf /root/.cache/camoufox \
    && cp -r /root/.cache/camoufox-fetch-cache/install /root/.cache/camoufox

# Copy application source code.
COPY . .

# Ensure the entrypoint script works correctly inside Linux
# (strips CRLF line endings and sets the exec bit).
RUN sed -i 's/\r$//' src/config/entrypoint.sh && chmod +x src/config/entrypoint.sh

# Virtual display used for headed browser execution.
ENV DISPLAY=:99

EXPOSE 3000

# Container startup script.
# Invoked via bash explicitly (not "./src/config/entrypoint.sh") so the
# container doesn't depend on the shebang or the exec bit surviving future
# COPY/git-checkout steps on a Windows host.
ENTRYPOINT ["/bin/bash", "src/config/entrypoint.sh"]

# Default Node.js application process.
CMD ["node", "src/app.js"]