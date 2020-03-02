ARG NODE_VERSION=10.16.3
ARG SonarScanner_RELEASE=3.0.3.778

ENV NODE_ENV=dev

# Note: The mkdir is required due to a bug in the debian-slim image.
RUN apt-get update \
 && apt-get install -y libsecret-1-0 iproute2 xvfb x11-utils libdbus-1-3 libgtk-3-0 libnotify-bin libgnome-keyring0 libgconf2-4 libasound2 libcap2 libcups2 libxtst6 libxss1 libnss3 \
 && rm -rf /var/lib/apt/lists/* /tmp/*

WORKDIR /opt

RUN wget --no-verbose https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz &&\
    tar -xJf node-v${NODE_VERSION}-linux-x64.tar.xz &&\
    rm node-v${NODE_VERSION}-linux-x64.tar.xz &&\
    ln -s node-v${NODE_VERSION}-linux-x64 node
ENV PATH=$PATH:/opt/node/bin

RUN curl -o sonarscanner.zip -L https://binaries.sonarsource.com/Distribution/sonar-scanner-cli/sonar-scanner-cli-${SonarScanner_RELEASE}-linux.zip && \
    unzip sonarscanner.zip && \
    rm sonarscanner.zip && \
    mv sonar-scanner-${SonarScanner_RELEASE}-linux sonar-scanner
ENV PATH=$PATH:/opt/sonar-scanner/bin

ENV SONAR_RUNNER_HOME=/opt/sonar-scanner
