# ── Build stage ────────────────────────────────────────────────────────
FROM rust:1.85-slim AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src/ src/

RUN cargo build --release

# ── Runtime stage ─────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssh-server \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/run/sshd

# Copy game binary
COPY --from=builder /app/target/release/hunter-game /usr/local/bin/hunter-game

# Copy SSH config and entrypoint
COPY sshd_config /etc/ssh/sshd_config
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create game data directory (mount a volume here for persistence)
RUN mkdir -p /app/data/players

WORKDIR /app
EXPOSE 22

ENTRYPOINT ["/entrypoint.sh"]
