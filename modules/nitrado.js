async function findDayzPath(serviceId) {
  //
  // 1) Known DayZ PS4 folder patterns
  //
  const baseCandidates = [
    'noftp/dayzps/config',
    'ftproot/dayzps/config'
  ];

  //
  // 2) Dynamic prefixes that depend on the REAL serviceId
  //
  const dynamicPrefixes = [
    `/games/${serviceId}_1/`,   // Most common on PS4
    `/games/${serviceId}/`,     // Secondary fallback
    '/'                          // Root fallback
  ];

  //
  // 3) Build list of ALL possible paths
  //
  const possiblePaths = [];

  for (const prefix of dynamicPrefixes) {
    for (const base of baseCandidates) {
      possiblePaths.push(prefix + base);              // ex: /games/12326241_1/noftp/dayzps/config
    }
  }

  // Raw fallback paths (some servers use a different root)
  possiblePaths.push('/noftp/dayzps/config');
  possiblePaths.push('/ftproot/dayzps/config');

  logger.info(
    `🔍 [Nitrado] Testing ${possiblePaths.length} possible log paths for service ${serviceId}...`
  );

  //
  // 4) Test each directory until we find one containing ADM/RPT logs
  //
  for (const p of possiblePaths) {
    try {
      const listing = await listFiles(serviceId, p);
      const entries = listing.data?.entries || listing.entries || [];

      if (!entries.length) continue;

      // Normalize file entries
      const normalized = entries.map(f => ({
        name: f.name || f.filename || '',
        size: f.size || 0,
        modified_at: f.modified_at || f.created_at || 0
      }));

      // Detect DayZ logs (PS4 format)
      const hasLogs = normalized.some(f =>
        /^DayZServer_PS4.*\.(ADM|RPT)$/i.test(f.name)
      );

      if (hasLogs) {
        logger.info(`📂 [Nitrado] Found DayZ log directory: ${p}`);
        return p;
      }
    } catch (err) {
      // Ignore inaccessible paths — continue testing others
    }
  }

  //
  // 5) No usable path found
  //
  logger.warn(`⚠️ [Nitrado] No working DayZ log folder detected for service ${serviceId}`);
  return null;
}
