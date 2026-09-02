/**
 * OpenTelemetry instrumentation for the Claude Agent SDK runtime.
 *
 * AgentCore Evaluations natively supports the Claude Agent SDK: it selects its
 * field-extraction mapper from a span's instrumentation SCOPE, and for this SDK
 * that scope must be exactly `openinference.instrumentation.claude_agent_sdk`
 * (see the "supported frameworks" devguide page). We therefore emit the OFFICIAL
 * OpenInference span shape produced by
 * `@arizeai/openinference-instrumentation-claude-agent-sdk` instead of the
 * hand-rolled spans this module used to build.
 *
 * Two shims are required to run that library here, both applied by the tracer
 * proxy in {@link makeScopeForcingProvider}:
 *
 *   1. SCOPE FORCING. AWS documents only the PYTHON instrumentation packages;
 *      the npm port registers itself under the scope
 *      `@arizeai/openinference-instrumentation-claude-agent-sdk`, which the
 *      mapper does not recognize. The library resolves its tracer via
 *      `tracerProvider.getTracer(name, version)`, so passing a proxy provider
 *      that ignores the requested name and returns a tracer registered under
 *      the AWS scope makes every emitted span carry the required scope.
 *
 *   2. session.id PINNING. The Python library preserves an existing session.id
 *      (`_has_existing_session_id`); the JS port (0.2.17) does not — it writes
 *      SESSION_ID unconditionally from the SDK's own per-run `session_id`.
 *      Conversation continuity here comes from history injection, not native
 *      `resume`, so the SDK's id differs every turn and each turn would become a
 *      separate eval session. The proxy pins `session.id` to the backend chat
 *      session id for the whole invocation.
 *
 * On top of the official attributes we mirror a small set of `gen_ai.*` keys the
 * AgentCore GenAI console reads (agent-traces rendering + the SESSION-level
 * token metrics). Those dashboards work today and the OpenInference attributes
 * alone do not feed them.
 *
 * Export path: the AWS Distro for OpenTelemetry (ADOT) Node package is preloaded
 * by the container entrypoint:
 *
 *   node --require @aws/aws-distro-opentelemetry-node-autoinstrumentation/register dist/index.js
 *
 * That CJS hook (loaded before this ESM app) installs the global TracerProvider
 * and the SigV4-signed OTLP→CloudWatch pipeline, gated on
 * AGENT_OBSERVABILITY_ENABLED + OTEL_*. There is no standalone OTLP collector on
 * AgentCore Runtime and plain OTEL-JS exporters cannot SigV4-sign to CloudWatch,
 * so we never build our own provider — this module only emits through the global
 * OTEL API (a no-op provider when observability is off).
 */

import {
  trace,
  context,
  propagation,
  createContextKey,
  ROOT_CONTEXT,
  type Span,
  type Tracer,
  type TracerProvider,
  type Context,
  type Attributes,
  type AttributeValue,
} from '@opentelemetry/api';
import { ClaudeAgentSDKInstrumentation } from '@arizeai/openinference-instrumentation-claude-agent-sdk';
import type { TokenUsage } from './types.js';

/**
 * The scope AgentCore Evaluations keys the Claude Agent SDK mapper on. Any other
 * name makes Evaluate reject the session ("no spans with supported scope").
 *
 * Only the NAME is overridden. The scope VERSION is forwarded verbatim from
 * whatever the instrumentation asks for (its own package version), so the span
 * still truthfully identifies the library that produced it — the Python
 * instrumentation reports its version the same way, and a scope with an empty
 * version is indistinguishable from an unknown build when debugging.
 */
const SCOPE = 'openinference.instrumentation.claude_agent_sdk';
const OBSERVABILITY_ENABLED = process.env.AGENT_OBSERVABILITY_ENABLED === 'true';

/** Provider constant for the gen_ai.* / llm.* provider attributes. */
const PROVIDER = 'anthropic';

// --- OpenInference attribute keys we read or write. Inlined as string literals
// so this module has no runtime dependency on the semantic-conventions package.
const OI_SPAN_KIND = 'openinference.span.kind';
const SESSION_ID = 'session.id';
const INPUT_VALUE = 'input.value';
const INPUT_MIME_TYPE = 'input.mime_type';
const OUTPUT_VALUE = 'output.value';
const TOOL_NAME = 'tool.name';
const LLM_MODEL_NAME = 'llm.model_name';
const LLM_TOKEN_COUNT_PROMPT = 'llm.token_count.prompt';
const LLM_TOKEN_COUNT_COMPLETION = 'llm.token_count.completion';
const LLM_TOKEN_COUNT_CACHE_READ = 'llm.token_count.prompt_details.cache_read';
const LLM_TOKEN_COUNT_CACHE_WRITE = 'llm.token_count.prompt_details.cache_write';

/**
 * Per-invocation state. Carried on the OTEL Context rather than in a module
 * global so concurrent invocations in one container cannot cross-contaminate.
 */
interface InvocationState {
  /** Backend chat session id — pinned onto every span's session.id. */
  sessionId: string;
  /**
   * The raw user turn. The prompt actually handed to the SDK also replays the
   * conversation history (see buildContextualPrompt), which would make
   * `input.value` a whole transcript; evaluators should judge THIS turn, which
   * is also what the spans carried before the switch to the official library.
   */
  prompt: string;
  /** The library's AGENT span, captured when it is created. */
  agentSpan?: Span;
}

const INVOCATION_KEY = createContextKey('super-agent.invocation');

export async function initOtel(): Promise<void> {
  if (OBSERVABILITY_ENABLED) {
    console.log(`[otel] Observability enabled — emitting OpenInference spans as scope ${SCOPE}`);
  }
}

/**
 * Extract an OTEL parent Context from the inbound invocation's HTTP headers.
 *
 * AgentCore's platform emits its own `AgentCore.Runtime.Invoke` span and can
 * forward the W3C `traceparent` (and X-Ray `X-Amzn-Trace-Id`) into the
 * container. Without extracting it the AGENT span starts a NEW trace, so one
 * turn shows as two disconnected traces (platform span + ours) under the same
 * session. ADOT's `register` hook installs the global propagator (W3C + X-Ray),
 * so `propagation.extract` understands both formats. Returns undefined when no
 * usable trace context is present (→ the AGENT span becomes its own root).
 * Never throws.
 */
export function parentContextFromHeaders(headers: Record<string, unknown> | undefined): Context | undefined {
  if (!OBSERVABILITY_ENABLED || !headers) return undefined;
  try {
    // Normalize to a lowercase string→string carrier (getter is case-sensitive).
    const carrier: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (v == null) continue;
      carrier[k.toLowerCase()] = Array.isArray(v) ? String(v[0]) : String(v);
    }
    if (!carrier.traceparent && !carrier['x-amzn-trace-id']) return undefined;
    const ctx = propagation.extract(ROOT_CONTEXT, carrier);
    const sc = trace.getSpanContext(ctx);
    // Only use it if extraction yielded a valid remote span context.
    return sc && sc.traceId ? ctx : undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Span wrapper: pins session.id / input.value and mirrors gen_ai.* keys
// ---------------------------------------------------------------------------

/**
 * Wrap a freshly started span so that:
 *   - `session.id` always reports the backend chat session id (the JS library
 *     would otherwise overwrite it with the SDK's per-run id — see the module
 *     header), and on the AGENT span `input.value` always reports the raw user
 *     turn rather than the history-replay prompt;
 *   - each OpenInference attribute the AgentCore console needs under a
 *     `gen_ai.*` name is mirrored as it is written.
 *
 * The span's kind is not known at creation: `OITracer.startSpan` strips
 * `options.attributes` and re-applies them through `setAttributes`, so
 * `openinference.span.kind` arrives on the first write. We therefore classify
 * lazily and stamp the kind-specific baseline into that same write.
 *
 * Returns the same span object (mutated). The library wraps it in an OISpan, so
 * every attribute it sets funnels through these two methods.
 */
function pinAndMirror(span: Span, state: InvocationState | undefined): Span {
  // Only the ORIGINAL single-key setter is captured. The SDK's own
  // `setAttributes` is implemented as a loop over `this.setAttribute`, so
  // delegating a batch to it would re-enter our override and recurse forever.
  const setOne = span.setAttribute.bind(span);
  const emit = (attrs: Attributes): void => {
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== undefined) setOne(key, value);
    }
  };

  /** undefined until the library declares openinference.span.kind. */
  let isAgent: boolean | undefined;

  /** Kind-specific baseline, emitted once the kind is known. */
  const baseline = (): Attributes => {
    const attrs: Attributes = { 'gen_ai.operation.name': isAgent ? 'invoke_agent' : 'execute_tool' };
    if (isAgent) {
      attrs['gen_ai.agent.name'] = 'super-agent';
      if (state) {
        attrs[INPUT_VALUE] = state.prompt;
        attrs[INPUT_MIME_TYPE] = 'text/plain';
      }
    }
    return attrs;
  };

  /** Substitute pinned values; the library must not win these two keys. */
  const pin = (key: string, value: AttributeValue): AttributeValue => {
    if (!state) return value;
    if (key === SESSION_ID) return state.sessionId;
    if (key === INPUT_VALUE && isAgent) return state.prompt;
    return value;
  };

  /**
   * `gen_ai.*` equivalents of the OpenInference keys. The Agent Traces UI reads
   * gen_ai.operation.name / prompt / completion; the SESSION token metrics
   * (ApplicationSignals InputTokens/OutputTokens) sum gen_ai.usage.*.
   */
  const mirror = (key: string, value: AttributeValue, out: Attributes): void => {
    switch (key) {
      case INPUT_VALUE:
        if (isAgent) {
          out['gen_ai.prompt'] = value;
          out['gen_ai.input.messages'] = JSON.stringify([{ role: 'user', content: [{ type: 'text', text: String(value) }] }]);
        } else {
          out['gen_ai.tool.call.arguments'] = value;
        }
        break;
      case OUTPUT_VALUE:
        if (isAgent) {
          out['gen_ai.completion'] = value;
          out['gen_ai.output.messages'] = JSON.stringify([{ role: 'assistant', content: [{ type: 'text', text: String(value) }] }]);
        } else {
          out['gen_ai.tool.call.result'] = value;
        }
        break;
      case LLM_MODEL_NAME:
        out['gen_ai.request.model'] = value;
        break;
      case LLM_TOKEN_COUNT_PROMPT:
        out['gen_ai.usage.input_tokens'] = value;
        break;
      case LLM_TOKEN_COUNT_COMPLETION:
        out['gen_ai.usage.output_tokens'] = value;
        break;
      case TOOL_NAME:
        out['gen_ai.tool.name'] = value;
        break;
      default:
        break;
    }
  };

  /** Adopt the declared kind; returns the baseline to emit, if newly learned. */
  const classify = (kind: AttributeValue | undefined): Attributes => {
    if (isAgent != null || kind == null) return {};
    isAgent = kind === 'AGENT';
    return baseline();
  };

  span.setAttribute = (key: string, value: AttributeValue): Span => {
    const out: Attributes = key === OI_SPAN_KIND ? classify(value) : {};
    const pinned = pin(key, value);
    out[key] = pinned;
    mirror(key, pinned, out);
    emit(out);
    return span;
  };

  span.setAttributes = (attributes: Attributes): Span => {
    // Classify first: the kind decides how input.value/output.value are pinned
    // and mirrored, and it may arrive in this very batch.
    const out: Attributes = classify(attributes[OI_SPAN_KIND] as AttributeValue | undefined);
    for (const [key, value] of Object.entries(attributes)) {
      if (value == null) continue;
      const pinned = pin(key, value);
      out[key] = pinned;
      mirror(key, pinned, out);
    }
    emit(out);
    return span;
  };

  // Kind-independent baseline. session.id must be on TOOL spans too: child spans
  // inherit nothing, and SESSION-level evaluation groups by this key.
  const initial: Attributes = {
    'gen_ai.provider.name': PROVIDER,
    'gen_ai.system': PROVIDER,
    'llm.provider': PROVIDER,
    'llm.system': PROVIDER,
  };
  if (state) initial[SESSION_ID] = state.sessionId;
  emit(initial);
  return span;
}

// ---------------------------------------------------------------------------
// The instrumentation singleton
// ---------------------------------------------------------------------------

/**
 * Proxy TracerProvider that (a) forces the AWS-required scope and (b) hands back
 * spans wrapped by {@link pinAndMirror}. Per-invocation state is read from the
 * Context the library passes to `startSpan` (falling back to the active one), so
 * nothing is shared through module globals.
 */
function makeScopeForcingProvider(): TracerProvider {
  // Only the scope NAME is replaced; `version` is the version the caller
  // requested (the instrumentation's own), so the span reports which build
  // emitted it.
  const makeTracer = (version?: string): Tracer => ({
    startSpan(name, options, ctx) {
      const activeCtx = ctx ?? context.active();
      const state = activeCtx.getValue(INVOCATION_KEY) as InvocationState | undefined;
      const span = trace.getTracer(SCOPE, version).startSpan(name, options, activeCtx);
      const wrapped = pinAndMirror(span, state);
      // The AGENT span is the first span of an invocation and the only one whose
      // name is the library's query wrapper constant; record it so finalize()
      // can stamp the counters the library does not read.
      if (state && !state.agentSpan) state.agentSpan = wrapped;
      return wrapped;
    },
    // The Claude Agent SDK v1 instrumentation only calls startSpan. Delegate
    // (unwrapped) for interface completeness; the three overloads can't be
    // forwarded variadically without a cast.
    startActiveSpan: ((...args: unknown[]) => {
      const inner = trace.getTracer(SCOPE, version).startActiveSpan as (...a: unknown[]) => unknown;
      return inner(...args);
    }) as Tracer['startActiveSpan'],
  });

  return { getTracer: (_name: string, version?: string) => makeTracer(version) };
}

let instrumented = false;

/**
 * Patch the Claude Agent SDK module with the official OpenInference
 * instrumentation and return the patched exports.
 *
 * The SDK ships as native ESM (`"type": "module"`, `sdk.mjs`) whose namespace
 * exports cannot be reassigned, so `manuallyInstrument` returns a patched COPY
 * and leaves the original namespace untouched — callers MUST use the returned
 * object. `enabled: false` keeps InstrumentationBase from also registering
 * require-in-the-middle hooks, which cannot intercept ESM imports anyway.
 *
 * Idempotent, and a pass-through when observability is disabled.
 */
export function instrumentClaudeAgentSdk<T extends object>(sdkModule: T): T {
  if (!OBSERVABILITY_ENABLED || instrumented) return sdkModule;
  try {
    const instrumentation = new ClaudeAgentSDKInstrumentation({
      instrumentationConfig: { enabled: false },
      tracerProvider: makeScopeForcingProvider(),
    });
    const patched = instrumentation.manuallyInstrument(sdkModule as never) as T;
    instrumented = true;
    console.log('[otel] Claude Agent SDK instrumented (OpenInference AGENT/TOOL spans)');
    return patched;
  } catch (err) {
    // Telemetry must never break the agent: fall back to the unpatched SDK.
    console.warn('[otel] Failed to instrument Claude Agent SDK:', err);
    return sdkModule;
  }
}

// ---------------------------------------------------------------------------
// Per-invocation handle
// ---------------------------------------------------------------------------

export interface Invocation {
  /**
   * The Context that `query()` and its `[Symbol.asyncIterator]()` must both be
   * invoked inside. The library captures `context.active()` at both points — for
   * the AGENT span's parent, for the tool spans' parent, and for our
   * per-invocation state — so the caller must enter it explicitly rather than
   * relying on async-context propagation across generator yields.
   */
  readonly ctx: Context;
  /**
   * Stamp the counters the library does not read. Must be called while the
   * AGENT span is still open — i.e. on the `result` message, before the SDK
   * generator reports done (that is when the library ends the span). The library
   * itself covers prompt/completion/total tokens and llm.cost.total.
   */
  finalize(opts: { numTurns?: number; tokenUsage?: TokenUsage }): void;
}

/**
 * Open an invocation scope for one turn. Does NOT start a span — the official
 * instrumentation starts the AGENT span when iteration begins. Never throws.
 */
export function beginInvocation(sessionId: string, prompt: string, parentCtx?: Context): Invocation {
  const noop: Invocation = { ctx: parentCtx ?? context.active(), finalize() { /* no-op */ } };
  if (!OBSERVABILITY_ENABLED) return noop;
  try {
    const state: InvocationState = { sessionId, prompt };
    const ctx = (parentCtx ?? context.active()).setValue(INVOCATION_KEY, state);
    return {
      ctx,
      finalize({ numTurns, tokenUsage }) {
        const span = state.agentSpan;
        if (!span) return;
        try {
          const attrs: Attributes = {};
          if (numTurns != null) attrs['gen_ai.agent.num_turns'] = Math.trunc(numTurns);
          if (tokenUsage) {
            const cacheRead = Math.trunc(tokenUsage.cache_read_input_tokens || 0);
            const cacheWrite = Math.trunc(tokenUsage.cache_creation_input_tokens || 0);
            // OpenInference detail counters (the library only reads in/out).
            attrs[LLM_TOKEN_COUNT_CACHE_READ] = cacheRead;
            attrs[LLM_TOKEN_COUNT_CACHE_WRITE] = cacheWrite;
            // The four gen_ai.usage.* counters the AgentCore console sums for
            // its SESSION/space token metrics. The SDK's
            // cache_creation_input_tokens maps to the convention's cache_write.
            attrs['gen_ai.usage.input_tokens'] = Math.trunc(tokenUsage.input_tokens || 0);
            attrs['gen_ai.usage.output_tokens'] = Math.trunc(tokenUsage.output_tokens || 0);
            attrs['gen_ai.usage.cache_read_input_tokens'] = cacheRead;
            attrs['gen_ai.usage.cache_write_input_tokens'] = cacheWrite;
          }
          if (Object.keys(attrs).length) span.setAttributes(attrs);
        } catch { /* telemetry must never throw into the agent path */ }
      },
    };
  } catch {
    return noop;
  }
}
