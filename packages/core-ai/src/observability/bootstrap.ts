import { bootstrapProviders } from '../providers/registry';
import {
  setAILogger,
  getAILogger,
  CompositeAILogger,
  ConsoleAILogger,
  InMemoryAILogger,
} from './aiLogger';
import { SupabaseAILogger, type SupabaseAdminLike } from './supabaseLogger';
import { setSupabaseMetricsReader } from './tenantMetrics';

let bootstrapped = false;
const memoryLogger = new InMemoryAILogger();

export interface BootstrapAIOptions {
  supabaseAdmin?: SupabaseAdminLike;
  enableConsole?: boolean;
}

/** Production bootstrap — providers + log sinks + metrics reader */
export function bootstrapAI(options: BootstrapAIOptions = {}): void {
  if (bootstrapped) return;

  bootstrapProviders();

  const sinks = [];
  if (options.enableConsole !== false) {
    sinks.push(new ConsoleAILogger());
  }
  sinks.push(memoryLogger);
  if (options.supabaseAdmin) {
    sinks.push(new SupabaseAILogger(options.supabaseAdmin));
    setSupabaseMetricsReader(options.supabaseAdmin);
  }

  setAILogger(new CompositeAILogger(sinks));
  bootstrapped = true;
}

export function getMemoryLogger(): InMemoryAILogger {
  return memoryLogger;
}

export function resetAIBootstrap(): void {
  bootstrapped = false;
}

export { getAILogger };
