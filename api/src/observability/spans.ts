import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { Span } from "@opentelemetry/api";

const tracer = trace.getTracer("cosmetics-api");

type SpanAttributes = Record<string, string | number | boolean>;

export async function withSpan<T>(
  name: string,
  attributes: SpanAttributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn(span);
    } catch (error) {
      if (error instanceof Error) {
        span.recordException(error);
      } else {
        span.recordException(String(error));
      }

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
