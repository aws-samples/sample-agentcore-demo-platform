# Connector Packages

Each data connector is a self-contained plugin package. The platform loads these packages at startup and renders them dynamically — no platform code changes needed to add a new connector.

## Package Structure

```
connector-packages/
├── gmail/
│   ├── manifest.json        # Metadata + config schema + credential schema
│   ├── setup-guide.md       # User-facing setup instructions (Markdown, i18n)
│   ├── tools.json           # MCP tool definitions for Gateway Target
│   └── handler.ts           # Lambda handler (deployed separately)
├── salesforce/
│   ├── manifest.json
│   ├── setup-guide.md
│   ├── tools.json
│   └── handler.ts
├── bigquery/
│   └── ...
└── _template/               # Copy this to create a new connector
    ├── manifest.json
    ├── setup-guide.md
    ├── tools.json
    └── handler.ts
```

## manifest.json Schema

See `_template/manifest.json` for the full schema with comments.

## How the Platform Uses These Packages

1. **Backend startup**: Scans `connector-packages/*/manifest.json`, loads all manifests into memory
2. **GET /api/connector-templates**: Returns the manifest list (catalog)
3. **Frontend ConnectorPanel**: Renders catalog cards, wizard steps, and credential forms entirely from manifest data
4. **Connector creation**: Platform reads manifest to determine auth flow, config fields, and Gateway Target setup
5. **Lambda deployment**: `handler.ts` + `tools.json` are packaged and deployed to AWS Lambda via CDK

No platform code changes are needed to add, modify, or remove a connector.
