import { registerOTel } from "@vercel/otel";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";

export function register() {
  registerOTel({
    serviceName: "hunter-game",
    spanProcessors: [
      new SimpleSpanProcessor(
        new OTLPTraceExporter({
          url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
          headers: {
            Authorization: `Bearer ${process.env.OTEL_EXPORTER_OTLP_AUTH_TOKEN}`,
          },
        })
      ),
    ],
  });
}
