/**
 * Ephemeral store for passing a SOP File object between pages.
 * React Router navigation state cannot reliably serialize File objects,
 * so we use a simple module-level reference that is consumed once.
 */

let _pendingFile: File | null = null;

export function setSopFile(file: File): void {
  _pendingFile = file;
}

export function consumeSopFile(): File | null {
  const file = _pendingFile;
  _pendingFile = null;
  return file;
}
