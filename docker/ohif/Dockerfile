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
COPY extensions/default/package.json ./extensions/default/ 2>/dev/null || true
COPY extensions/dicom-html/package.json ./extensions/dicom-html/
COPY extensions/dicom-microscopy/package.json ./extensions/dicom-microscopy/
COPY extensions/dicom-pdf/package.json ./extensions/dicom-pdf/
COPY extensions/dicom-rt/package.json ./extensions/dicom-rt/
COPY extensions/dicom-segmentation/package.json ./extensions/dicom-segmentation/
COPY extensions/dicom-tag-browser/package.json ./extensions/dicom-tag-browser/
COPY extensions/lesion-tracker/package.json ./extensions/lesion-tracker/
COPY extensions/vtk/package.json ./extensions/vtk/

RUN yarn install --frozen-lockfile

# Copy all source files
COPY . .

# Copy OHIF Docker config into the expected config location
COPY docker/ohif/ohif-config.js platform/viewer/public/config/docker_ohif-config.js

RUN APP_CONFIG=config/docker_ohif-config.js yarn run build

# Stage 2: Serve the built application with Nginx
FROM nginx:alpine

# Remove default nginx configuration
RUN rm -f /etc/nginx/conf.d/default.conf

# Create a simple nginx config for serving the SPA on port 3000
RUN printf 'server {\n\
    listen 3000;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
\n\
    location ~* \\.(?:css|js|map|jpe?g|png|gif|ico|svg|woff2?)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public";\n\
    }\n\
}\n' > /etc/nginx/conf.d/ohif.conf

COPY --from=builder /app/platform/viewer/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
