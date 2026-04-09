/**
 * API Spec Parser Service
 *
 * Parses OpenAPI/Swagger specs (JSON or YAML) and generates SKILL.md content
 * that Claude can use to make API calls during workflow execution.
 */

import { load as yamlLoad } from 'js-yaml';

interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info?: {
    title?: string;
    description?: string;
    version?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  host?: string;       // Swagger 2.0
  basePath?: string;   // Swagger 2.0
  schemes?: string[];  // Swagger 2.0
  paths?: Record<string, Record<string, PathOperation>>;
  components?: {
    securitySchemes?: Record<string, SecurityScheme>;
  };
  securityDefinitions?: Record<string, SecurityScheme>; // Swagger 2.0
}

interface PathOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    description?: string;
    schema?: SchemaObject;
    type?: string; // Swagger 2.0
  }>;
  requestBody?: {
    description?: string;
    required?: boolean;
    content?: Record<string, { schema?: SchemaObject }>;
  };
  responses?: Record<string, {
    description?: string;
    content?: Record<string, { schema?: SchemaObject }>;
  }>;
}

interface SchemaObject {
  type?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  description?: string;
  enum?: unknown[];
  format?: string;
  $ref?: string;
}

interface SecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  in?: string;
  name?: string;
  flows?: unknown;
}

export interface ParsedEndpoint {
  method: string;
  path: string;
  summary: string;
  description?: string;
  parameters?: Array<{ name: string; in: string; required: boolean; type: string; description?: string }>;
  requestBody?: string;
  responseDescription?: string;
}

export interface ParsedApiSpec {
  title: string;
  description: string;
  version: string;
  baseUrl: string;
  auth: string;
  endpoints: ParsedEndpoint[];
}

export class ApiSpecParserService {
  /**
   * Parse an OpenAPI/Swagger spec from raw content (JSON or YAML string)
   */
  parse(content: string): ParsedApiSpec {
    const spec = this.parseContent(content);
    return {
      title: spec.info?.title || 'Untitled API',
      description: spec.info?.description || '',
      version: spec.info?.version || '1.0.0',
      baseUrl: this.extractBaseUrl(spec),
      auth: this.extractAuth(spec),
      endpoints: this.extractEndpoints(spec),
    };
  }

  /**
   * Generate SKILL.md content from a parsed spec
   */
  generateSkillMd(parsed: ParsedApiSpec): string {
    const lines: string[] = [
      '---',
      `name: ${this.slugify(parsed.title)}`,
      `description: ${parsed.description || parsed.title}`,
      '---',
      '',
      `# ${parsed.title}`,
      '',
    ];

    if (parsed.description) {
      lines.push(parsed.description, '');
    }

    lines.push(`Base URL: ${parsed.baseUrl}`, '');

    if (parsed.auth) {
      lines.push('## Authentication', '', parsed.auth, '');
    }

    lines.push('## Endpoints', '');

    for (const ep of parsed.endpoints) {
      lines.push(`### ${ep.summary || `${ep.method} ${ep.path}`}`);
      lines.push(`\`${ep.method} ${ep.path}\``);
      if (ep.description) lines.push(ep.description);

      if (ep.parameters && ep.parameters.length > 0) {
        lines.push('', 'Parameters:');
        for (const p of ep.parameters) {
          const req = p.required ? '(required)' : '(optional)';
          lines.push(`- \`${p.name}\` ${req} [${p.in}] ${p.type}${p.description ? ` — ${p.description}` : ''}`);
        }
      }

      if (ep.requestBody) {
        lines.push('', 'Request Body:', ep.requestBody);
      }

      if (ep.responseDescription) {
        lines.push('', `Response: ${ep.responseDescription}`);
      }

      lines.push('');
    }

    lines.push('## Usage Notes', '');
    lines.push('Use `curl` or `WebFetch` to call these endpoints.');
    lines.push(`Always include the base URL: ${parsed.baseUrl}`);
    if (parsed.auth) {
      lines.push('Remember to include authentication headers as described above.');
    }

    return lines.join('\n');
  }

  /**
   * Convenience: parse raw content and generate SKILL.md in one step
   */
  parseAndGenerate(content: string): { parsed: ParsedApiSpec; skillMd: string } {
    const parsed = this.parse(content);
    const skillMd = this.generateSkillMd(parsed);
    return { parsed, skillMd };
  }

  private parseContent(content: string): OpenAPISpec {
    const trimmed = content.trim();
    // Try JSON first
    if (trimmed.startsWith('{')) {
      return JSON.parse(trimmed) as OpenAPISpec;
    }
    // Try YAML
    return yamlLoad(trimmed) as OpenAPISpec;
  }

  private extractBaseUrl(spec: OpenAPISpec): string {
    // OpenAPI 3.x
    if (spec.servers && spec.servers.length > 0) {
      return spec.servers[0]!.url ?? 'https://api.example.com';
    }
    // Swagger 2.0
    if (spec.host) {
      const scheme = spec.schemes?.[0] || 'https';
      const basePath = spec.basePath || '';
      return `${scheme}://${spec.host}${basePath}`;
    }
    return 'https://api.example.com';
  }

  private extractAuth(spec: OpenAPISpec): string {
    const schemes = spec.components?.securitySchemes || spec.securityDefinitions || {};
    const parts: string[] = [];

    for (const [name, scheme] of Object.entries(schemes)) {
      if (scheme.type === 'http' && scheme.scheme === 'bearer') {
        parts.push(`Bearer Token: Set header \`Authorization: Bearer {token}\``);
      } else if (scheme.type === 'apiKey') {
        parts.push(`API Key: Set header \`${scheme.name}: {api_key}\` (in: ${scheme.in})`);
      } else if (scheme.type === 'oauth2') {
        parts.push(`OAuth2 (${name}): Obtain token via OAuth2 flow, then set \`Authorization: Bearer {token}\``);
      } else {
        parts.push(`${name}: ${scheme.type}`);
      }
    }

    return parts.join('\n') || 'No authentication specified';
  }

  private extractEndpoints(spec: OpenAPISpec): ParsedEndpoint[] {
    const endpoints: ParsedEndpoint[] = [];
    const paths = spec.paths || {};

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method.toLowerCase())) {
          endpoints.push(this.parseOperation(method.toUpperCase(), path, operation));
        }
      }
    }

    return endpoints;
  }

  private parseOperation(method: string, path: string, op: PathOperation): ParsedEndpoint {
    const endpoint: ParsedEndpoint = {
      method,
      path,
      summary: op.summary || op.operationId || `${method} ${path}`,
      description: op.description,
    };

    // Parameters
    if (op.parameters && op.parameters.length > 0) {
      endpoint.parameters = op.parameters.map(p => ({
        name: p.name,
        in: p.in,
        required: p.required || false,
        type: p.schema?.type || p.type || 'string',
        description: p.description,
      }));
    }

    // Request body (OpenAPI 3.x)
    if (op.requestBody?.content) {
      const jsonContent = op.requestBody.content['application/json'];
      if (jsonContent?.schema) {
        endpoint.requestBody = this.schemaToString(jsonContent.schema);
      }
    }

    // Response
    const successResponse = op.responses?.['200'] || op.responses?.['201'];
    if (successResponse) {
      endpoint.responseDescription = successResponse.description;
    }

    return endpoint;
  }

  private schemaToString(schema: SchemaObject, indent = 0): string {
    if (schema.$ref) {
      return `(ref: ${schema.$ref.split('/').pop()})`;
    }

    if (schema.type === 'object' && schema.properties) {
      const pad = '  '.repeat(indent);
      const lines = ['{'];
      const required = new Set(schema.required || []);
      for (const [key, prop] of Object.entries(schema.properties)) {
        const req = required.has(key) ? '' : '?';
        const type = prop.type || 'any';
        const desc = prop.description ? ` // ${prop.description}` : '';
        lines.push(`${pad}  "${key}"${req}: ${type}${desc}`);
      }
      lines.push(`${pad}}`);
      return lines.join('\n');
    }

    if (schema.type === 'array' && schema.items) {
      return `Array<${this.schemaToString(schema.items, indent)}>`;
    }

    return schema.type || 'any';
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }
}

export const apiSpecParserService = new ApiSpecParserService();
