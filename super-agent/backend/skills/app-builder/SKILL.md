---
name: app-builder
description: Guide for building web applications with persistent data storage on the Super Agent platform. Use this skill whenever the user asks to build, create, or develop a web app, dashboard, tool, or any interactive application. This skill teaches you how to use the platform's built-in Data API for backend storage.
---

# App Builder

Build full-stack web applications with persistent data storage on the Super Agent platform.

## When to Use

- User asks to "build an app", "create a dashboard", "make a tool"
- User needs an app that stores/retrieves data (expenses, tasks, inventory, etc.)
- User wants a BI dashboard or reporting tool
- Any request for an interactive web application

## Architecture

Apps on this platform are:
- **Frontend**: React/Vue/vanilla HTML+JS built with Vite
- **Backend**: The platform provides a built-in Data API — no custom server needed
- **Data**: Stored as JSONB documents in collections, queryable with filters and aggregations

## CRITICAL — Platform Data API

The platform provides a REST API for persistent data storage. Every published app gets access to it.

**Base URL**: `${API_BASE_URL}/api/apps/${APP_ID}/data`

The `API_BASE_URL` and `AUTH_TOKEN` are injected as environment variables at runtime.
The `APP_ID` is available after publishing (or use the session-based preview endpoint).

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/:collection` | List documents (supports `?limit=`, `?offset=`, `?filter=`, `?sort=`, `?order=`) |
| `GET` | `/:collection/:id` | Get single document |
| `POST` | `/:collection` | Create document (body = JSON object) |
| `PUT` | `/:collection/:id` | Replace document |
| `PATCH` | `/:collection/:id` | Merge-update document |
| `DELETE` | `/:collection/:id` | Delete document |
| `POST` | `/:collection/aggregate` | Run aggregation query |

### Filter Syntax

Pass `?filter={"status":"approved","department":"Engineering"}` as URL-encoded JSON.

### Aggregation

```json
POST /:collection/aggregate
{
  "groupBy": "department",
  "sum": "amount",
  "avg": "amount",
  "count": true,
  "where": { "status": "approved", "amount_gt": 100 },
  "orderBy": "sum_amount",
  "order": "desc",
  "limit": 10
}
```

Supported operators in `where`: exact match, `_gt`, `_gte`, `_lt`, `_lte`.

## Client SDK

When building an app, always include this helper module. Create it as `src/api.js` or `src/api.ts`:

```typescript
// src/api.ts — Platform Data API client
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? window.location.origin;
const APP_ID = import.meta.env.VITE_APP_ID ?? '';

function getToken(): string {
  return localStorage.getItem('cognito_id_token') ?? '';
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
  };
}

async function request(method: string, path: string, body?: unknown) {
  const url = `${API_BASE}/api/apps/${APP_ID}/data${path}`;
  const res = await fetch(url, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}

export const db = {
  list: (collection: string, opts?: { limit?: number; offset?: number; filter?: object; sort?: string; order?: string }) => {
    const params = new URLSearchParams();
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    if (opts?.filter) params.set('filter', JSON.stringify(opts.filter));
    if (opts?.sort) params.set('sort', opts.sort);
    if (opts?.order) params.set('order', opts.order);
    const qs = params.toString();
    return request('GET', `/${collection}${qs ? '?' + qs : ''}`);
  },
  get: (collection: string, id: string) => request('GET', `/${collection}/${id}`),
  create: (collection: string, data: object) => request('POST', `/${collection}`, data),
  update: (collection: string, id: string, data: object) => request('PUT', `/${collection}/${id}`, data),
  patch: (collection: string, id: string, data: object) => request('PATCH', `/${collection}/${id}`, data),
  remove: (collection: string, id: string) => request('DELETE', `/${collection}/${id}`),
  aggregate: (collection: string, query: object) => request('POST', `/${collection}/aggregate`, query),
};
```

## Build Rules

### Project Setup

1. Use Vite + React (or vanilla if simple)
2. Always set `base: './'` in `vite.config.ts` for sub-path deployment
3. Use `<HashRouter>` instead of `<BrowserRouter>` for React Router apps
4. Include the `src/api.ts` client SDK above in every app that needs data

### Environment Variables

Set these in `.env` for local dev, they're auto-injected in production:

```
VITE_API_BASE_URL=http://localhost:3000
VITE_APP_ID=<uuid-after-publish>
```

### Data Modeling

- Use **collections** like database tables: `expenses`, `employees`, `tasks`
- Each document is a JSON object — no schema required
- Use consistent field names within a collection
- Store numeric values as numbers (not strings) for aggregation support
- Use ISO date strings for date fields

### Example: Expense Tracker Data Model

```
Collection: expenses
{ "title": "Team lunch", "amount": 85.50, "department": "Engineering", "status": "pending", "date": "2026-02-15", "submitted_by": "alice@co.com" }

Collection: departments
{ "name": "Engineering", "budget": 50000, "manager": "bob@co.com" }
```

### Authentication

The app runs inside an authenticated iframe on the platform. The user's Cognito token is available in `localStorage` as `cognito_id_token`. The `src/api.ts` client SDK handles this automatically.

### Preview & Publish

After building the app:
1. Use the `app-publisher` skill to preview or publish
2. The Data API becomes available immediately after publish
3. The `APP_ID` is returned by the publish step — update `.env` or hardcode it

## Workflow

1. Scaffold the Vite project with `npm create vite@latest`
2. Add the `src/api.ts` client SDK
3. Build the UI with React components
4. Use `db.list()`, `db.create()`, `db.aggregate()` etc. for all data operations
5. Test locally, then use `app-publisher` to deploy
