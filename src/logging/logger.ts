import pino, { type Logger, type LoggerOptions } from "pino";
import pretty from "pino-pretty";

export type LogFormat = "json" | "pretty";

export interface LoggerConfig {
  format?: LogFormat;
  level?: string;
  name?: string;
}

function getLogFormat(configuredFormat?: LogFormat): LogFormat {
  if (configuredFormat !== undefined) {
    return configuredFormat;
  }

  const environmentFormat = process.env.LOG_FORMAT?.toLowerCase();

  if (environmentFormat === "json" || environmentFormat === "pretty") {
    return environmentFormat;
  }

  if (environmentFormat !== undefined) {
    throw new Error(`Unsupported LOG_FORMAT: ${environmentFormat}`);
  }

  return process.stdout.isTTY ? "pretty" : "json";
}

export function createLogger(config: LoggerConfig = {}): Logger {
  const format = getLogFormat(config.format);
  const options: LoggerOptions = {
    name: config.name ?? "defi-liquidity-rebalancer",
    level: config.level ?? process.env.LOG_LEVEL ?? "info",
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
    },
    redact: {
      paths: ["apiKey", "*.apiKey", "authorization", "*.authorization"],
      censor: "[REDACTED]",
    },
  };

  if (format === "pretty") {
    return pino(
      options,
      pretty({
        colorize: process.stderr.isTTY,
        destination: 2,
        ignore: "pid,hostname",
        sync: true,
        translateTime: "SYS:standard",
      }),
    );
  }

  return pino(options);
}

export const logger = createLogger();
