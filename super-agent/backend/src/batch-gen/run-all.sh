#!/bin/bash
# Run batch generation for all remaining industry templates (finance-risk already done).
# Usage: cd backend && bash src/batch-gen/run-all.sh

set -e

TEMPLATES_DIR="src/batch-gen/templates"
DONE_MARKER_DIR="../industry-packs"

for template in "$TEMPLATES_DIR"/*.json; do
  id=$(node -e "console.log(require('./$template').id)")
  pack_dir="$DONE_MARKER_DIR/industry-pack-$id"

  if [ -d "$pack_dir" ]; then
    echo "⏭️  Skipping $id (already exists at $pack_dir)"
    continue
  fi

  echo "🚀 Starting: $id"
  npx tsx src/batch-gen/cli.ts "$template"
  echo "✅ Done: $id"
  echo "---"
done

echo "🎉 All templates processed."
