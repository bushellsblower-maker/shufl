const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseD1List(raw) {
  const data = typeof raw === "string" ? JSON.parse(raw) : raw;
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
  if (!/"database_id"\s*:\s*"[^"]+"/.test(source)) {
    throw new Error("wrangler.jsonc is missing database_id");
  }
  return source.replace(/"database_id"\s*:\s*"[^"]+"/, `"database_id": "${id}"`);
}

export function isPlaceholderDatabaseId(id) {
  return !id || id.replaceAll("0", "").replaceAll("-", "") === "";
}
