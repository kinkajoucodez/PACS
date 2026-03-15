# Stage 1: Build the OHIF application
FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests first for better layer caching
COPY package.json yarn.lock lerna.json ./
COPY platform/viewer/package.json ./platform/viewer/
COPY platform/core/package.json ./platform/core/
COPY platform/ui/package.json ./platform/ui/
COPY platform/i18n/package.json ./platform/i18n/

# Copy extension package manifests
COPY extensions/cornerstone/package.json ./extensions/cornerstone/
COPY extensions/dicom-html/package.json ./extensions/dicom-html/
COPY extensions/dicom-microscopy/package.json ./extensions/dicom-microscopy/
COPY extensions/dicom-pdf/package.json ./extensions/dicom-pdf/
COPY extensions/dicom-rt/package.json ./extensions/dicom-rt/
COPY extensions/dicom-segmentation/package.json ./extensions/dicom-segmentation/
COPY extensions/dicom-tag-browser/package.json ./extensions/dicom-tag-browser/
COPY extensions/lesion-tracker/package.json ./extensions/lesion-tracker/
COPY extensions/vtk/package.json ./extensions/vtk/

# Copy local custom extension manifests so yarn workspaces resolves them locally
RUN mkdir -p extensions/worklist extensions/reporting extensions/pacs-admin
COPY extensions/worklist/package.json ./extensions/worklist/
COPY extensions/reporting/package.json ./extensions/reporting/
COPY extensions/pacs-admin/package.json ./extensions/pacs-admin/

RUN yarn install

# Copy all source files
COPY . .

# Copy OHIF Docker config into the expected config location
COPY docker/ohif/ohif-config.js platform/viewer/public/config/docker_ohif-config.js

# NODE_OPTIONS=--openssl-legacy-provider is required because this OHIF 4.12.23
# build uses webpack/node-sass with legacy OpenSSL APIs not available in Node 17+.
RUN NODE_OPTIONS=--openssl-legacy-provider APP_CONFIG=config/docker_ohif-config.js yarn run build

# Remove external polyfill.io script tag (DNS may be unavailable in restricted environments;
# the build is fully self-contained and does not need the runtime polyfill CDN).
RUN sed -i '/<script[^>]*src="[^"]*polyfill\.io[^"]*"[^>]*>/d' platform/viewer/dist/index.html

# Remove the service-worker bootstrap script tag so the app loads its JS bundles
# directly without depending on SW/Workbox registration succeeding.
RUN sed -i '/<script[^>]*src="\/init-service-worker\.js"[^>]*>/d' platform/viewer/dist/index.html

# Stage 2: Serve the built application with Nginx
FROM nginx:alpine

# Remove default nginx configuration
RUN rm -f /etc/nginx/conf.d/default.conf

# Serve the OHIF SPA on port 3000 with:
#   - reverse-proxy for Orthanc DICOMweb/WADO endpoints (used by ohif-config.js)
#   - no-cache for index.html so updates are picked up immediately
#   - long-term cache for content-hashed JS/CSS bundles
RUN printf 'server {\n\
    listen 3000;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # Proxy DICOMweb QIDO-RS / STOW-RS / WADO-RS to Orthanc\n\
    location /orthanc/dicom-web/ {\n\
        proxy_pass http://orthanc:8042/dicom-web/;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
    }\n\
\n\
    # Proxy WADO-URI to Orthanc\n\
    location /orthanc/wado {\n\
        proxy_pass http://orthanc:8042/wado;\n\
        proxy_set_header Host $host;\n\
        proxy_set_header X-Real-IP $remote_addr;\n\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n\
    }\n\
\n\
    # SPA fallback: return index.html for unknown paths\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    # index.html must not be cached so browsers pick up new deployments\n\
    location = /index.html {\n\
        add_header Cache-Control "no-cache, must-revalidate";\n\
    }\n\
\n\
    # Content-hashed JS/CSS/font bundles can be cached for a long time\n\
    location ~* \\.(?:css|js|map|jpe?g|png|gif|ico|svg|woff2?)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}\n' > /etc/nginx/conf.d/ohif.conf

COPY --from=builder /app/platform/viewer/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
