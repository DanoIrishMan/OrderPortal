export function normalizeCustomerMatchKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

/** True when `shorter` is a whole-word prefix of `longer` (e.g. "Wigan Athletic" ⊂ "Wigan Athletic Community Trust"). */
export function isWordBoundaryPrefix(shorter: string, longer: string): boolean {
  if (!longer.startsWith(shorter)) return false;
  return longer.length === shorter.length || longer[shorter.length] === " ";
}

export interface RelatedNameMatch {
  clientId: string;
  matchedName: string;
}

/**
 * Match a CSV customer name to an existing club when one name extends the other
 * (e.g. "Wigan Athletic Community Trust" → client "Wigan Athletic").
 * Prefers the longest matching prefix to avoid matching generic names like "Wigan".
 */
export function findClientIdByRelatedName(
  csvCustomerName: string,
  clients: Array<{ id: string; name: string }>,
  aliasNames: Array<{ clientId: string; csvCustomerName: string }>
): RelatedNameMatch | null {
  const csv = normalizeCustomerMatchKey(csvCustomerName);
  if (!csv) return null;

  const seen = new Set<string>();
  const candidates: Array<{ clientId: string; name: string }> = [];

  for (const client of clients) {
    const key = `${client.id}:${client.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ clientId: client.id, name: client.name });
  }

  for (const alias of aliasNames) {
    const key = `${alias.clientId}:${alias.csvCustomerName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ clientId: alias.clientId, name: alias.csvCustomerName });
  }

  let best: { clientId: string; matchedName: string; score: number } | null = null;

  for (const candidate of candidates) {
    const label = normalizeCustomerMatchKey(candidate.name);
    if (!label || label === csv) continue;

    const csvExtendsLabel = isWordBoundaryPrefix(label, csv);
    const labelExtendsCsv = isWordBoundaryPrefix(csv, label);

    if (!csvExtendsLabel && !labelExtendsCsv) continue;

    const score = csvExtendsLabel ? label.length : csv.length;
    if (!best || score > best.score) {
      best = { clientId: candidate.clientId, matchedName: candidate.name, score };
    }
  }

  return best ? { clientId: best.clientId, matchedName: best.matchedName } : null;
}
