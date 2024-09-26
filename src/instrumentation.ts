import { OTLPHttpProtoTraceExporter, registerOTel } from "@vercel/otel";

export function register() {
  registerOTel({
    serviceName: "hunter-game",
    traceExporter: new OTLPHttpProtoTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      headers: {
        Authorization: `Bearer ${process.env.OTEL_EXPORTER_OTLP_AUTH_TOKEN}`,
      },
    }),
  });
}
