async function findDayzPath(serviceId) {
  //
  // 1) Known DayZ PS4 folder patterns
  //
  const baseCandidates = [
    'noftp/dayzps/config',
    'ftproot/dayzps/config'
  ];

  //
  // 2) Dynamic prefixes based on the real service ID
  //    Example: serviceId = 12326241 → /games/12326241_1/noftp/dayzps/config
  //
  const dynamicPrefixes = [
    `/games/${serviceId}_1/`,
    `/games/${serviceId}/`,
    '/'
  ];

  //
  // 3) Build full path combinations
  //
  const possiblePaths = [];

  // dynamic prefix paths
  for (const prefix of dynamicPrefixes) {
    for (const base of baseCandidates) {
      possiblePaths.push(prefix + base);
    }
  }

  // raw fallback paths
  possiblePaths.push('/noftp/dayzps/config');
  possiblePaths.push('/ftproot/dayzps/config');

  logger.info(
    `🔍 [Nitrado] Testing ${possiblePaths.length} possible log paths for service ${serviceId}...`
  );

  //
  // 4) Test each candidate directory
  //
  for (const p of possiblePaths) {
    try {
      const listing = await listFiles(serviceId, p);
      const entries = listing.data?.entries || listing.entries || [];

      if (!entries.length) continue;

      // Normalize each entry (VERY IMPORTANT)
      const normalized = entries.map(f => ({
        name: f.name || f.filename || '',
        size: f.size || 0,
        modified_at: f.modified_at || f.created_at || 0
      }));

      // Detect DayZ logs
      const hasLogs = normalized.some(f =>
        f.name.match(/DayZServer_PS4.*\.(ADM|RPT)$/)
      );

      if (hasLogs) {
        logger.info(`📂 [Nitrado] Found DayZ log directory: ${p}`);
        return p;
      }
    } catch (_) {
      // Ignore inaccessible paths
    }
  }

  //
  // 5) None found
  //
  logger.warn(`⚠️ [Nitrado] No working DayZ log folder detected for service ${serviceId}`);
  return null;
}
