# ── Build stage ────────────────────────────────────────────────────────
FROM rust:1.88-alpine AS builder

RUN apk add --no-cache musl-dev

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src/ src/

RUN cargo build --release

# ── Runtime stage ─────────────────────────────────────────────────────
FROM alpine:3.21

RUN apk add --no-cache openssh-server

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
