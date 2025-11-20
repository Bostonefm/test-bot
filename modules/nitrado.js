async function findDayzPath(serviceId) {
  // Multi-guild safe: these are only “known PS4 DayZ folder patterns”
  // The service ID determines which "niXXXX" folder is correct.
  const baseCandidates = [
    'noftp/dayzps/config',
    'ftproot/dayzps/config'
  ];

  // Try dynamic prefix paths based on serviceId
  const dynamicPrefixes = [
    `/games/${serviceId}_1/`,     // most common for PS4
    `/games/${serviceId}/`,       // fallback
    '/'                           // root fallback
  ];

  // build combinations: dynamic prefix + base candidates
  const possiblePaths = [];
  for (const prefix of dynamicPrefixes) {
    for (const base of baseCandidates) {
      possiblePaths.push(prefix + base);
    }
  }

  // Also try raw paths directly (no prefix)
  possiblePaths.push('/noftp/dayzps/config');
  possiblePaths.push('/ftproot/dayzps/config');

  logger.info(`🔍 [Nitrado] Testing ${possiblePaths.length} possible log paths for service ${serviceId}...`);

  for (const p of possiblePaths) {
    try {
      const res = await listFiles(serviceId, p);
      const entries = res.data?.entries || [];

      if (!entries.length) continue;

      // Normalize all entries — VERY IMPORTANT
      const normalized = entries.map(f => ({
        name: f.name || f.filename || '',
        size: f.size || 0,
        modified_at: f.modified_at || f.created_at || 0,
      }));

      // Check for DayZ log naming pattern
      const hasLogs = normalized.some(f =>
        f.name.match(/DayZServer_PS4.*\.(ADM|RPT)$/)
      );

      if (hasLogs) {
        logger.info(`📂 [Nitrado] Found DayZ log directory: ${p}`);
        return p;
      }

    } catch (err) {
      // Ignore invalid paths
    }
  }

  logger.warn(`⚠️ [Nitrado] No working DayZ log folder detected for service ${serviceId}`);
  return null;
}
