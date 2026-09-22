const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extractJson(text) {
  const trimmed = text.trim();
  const arrayAt = trimmed.indexOf("[");
  const objectAt = trimmed.indexOf("{");
  const start =
    arrayAt === -1 ? objectAt : objectAt === -1 ? arrayAt : Math.min(arrayAt, objectAt);
  return start > 0 ? trimmed.slice(start) : trimmed;
}

export function parseD1List(raw) {
  const data = typeof raw === "string" ? JSON.parse(extractJson(raw)) : raw;
  const rows = Array.isArray(data) ? data : Array.isArray(data?.result) ? data.result : [];
  return rows
    .map((row) => ({
      name: row?.name ?? row?.database_name ?? "",
      id: row?.uuid ?? row?.database_id ?? row?.id ?? "",
    }))
    .filter((row) => row.name && row.id);
}

export function findDatabase(rows, name) {
  return rows.find((row) => row.name === name) ?? null;
}

export function parseCreatedDatabaseId(stdout) {
  const match = String(stdout).match(/database_id["'\s:=]+([0-9a-f-]{36})/i);
  return match?.[1] ?? null;
}

export function patchDatabaseId(source, id) {
  if (!UUID.test(id)) {
    throw new Error("Invalid D1 database id");
  }
  if (/"database_id"\s*:\s*"[^"]+"/.test(source)) {
    return source.replace(/"database_id"\s*:\s*"[^"]+"/, `"database_id": "${id}"`);
  }
  const nameLine = source.match(/^[ \t]*"database_name"\s*:\s*"[^"]+",?[ \t]*$/m);
  if (!nameLine) {
    throw new Error("wrangler.jsonc is missing database_name");
  }
  const line = nameLine[0];
  const indent = line.match(/^[ \t]*/)[0];
  const withComma = line.trimEnd().endsWith(",") ? line : `${line.trimEnd()},`;
  return source.replace(line, `${withComma}\n${indent}"database_id": "${id}",`);
}

export function isPlaceholderDatabaseId(id) {
  return !id || id.replaceAll("0", "").replaceAll("-", "") === "";
}
