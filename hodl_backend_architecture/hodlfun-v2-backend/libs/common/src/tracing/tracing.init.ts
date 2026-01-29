import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | null = null;

export interface TracingInitOptions {
  serviceName: string;
  serviceVersion?: string;
  endpoint?: string;
  enabled?: boolean;
}

/**
 * Initialize OpenTelemetry tracing SDK.
 * Should be called at the very beginning of the application startup,
 * before any other imports that might need instrumentation.
 */
export function initTracing(options: TracingInitOptions): void {
  const {
    serviceName,
    serviceVersion = '1.0.0',
    endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',
    enabled = process.env.NODE_ENV !== 'test',
  } = options;

  if (!enabled) {
    console.log(`[Tracing] Disabled for service: ${serviceName}`);
    return;
  }

  const traceExporter = new OTLPTraceExporter({
    url: `${endpoint}/v1/traces`,
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable fs instrumentation to reduce noise
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        // Configure HTTP instrumentation
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (request) => {
            const path = request.url || '';
            return path.includes('/health');
          },
        },
      }),
    ],
  });

  sdk.start();
  console.log(`[Tracing] Started for service: ${serviceName} -> ${endpoint}`);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk
      ?.shutdown()
      .then(() => console.log('[Tracing] SDK shut down successfully'))
      .catch((error) => console.log('[Tracing] Error shutting down SDK', error))
      .finally(() => process.exit(0));
  });
}

/**
 * Shutdown the tracing SDK.
 */
export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}
