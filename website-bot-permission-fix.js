// Website Bot Permission Fix Script
// Copy-paste this into your Website Bot project

const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config/website.config.json', 'utf8'));

// Fix required roles - use exact Patreon role names WITH MEDAL EMOJIS
config.requiredRoles = [
  "🥉Bronze",
  "🥈Silver", 
  "🥇Gold",
  "Partner",
  "Support Staff",
  "Developer"
];

// Update each category to use ARRAY format instead of objects
config.categories = config.categories.map(category => {
  const newPermissions = {};
  
  for (const [roleName, perms] of Object.entries(category.permissions || {})) {
    // Handle old role names without emojis
    let newRoleName = roleName;
    if (roleName === 'Bronze') newRoleName = '🥉Bronze';
    if (roleName === 'Silver') newRoleName = '🥈Silver';
    if (roleName === 'Gold') newRoleName = '🥇Gold';
    
    if (typeof perms === 'object' && !Array.isArray(perms)) {
      // Convert object format to array format
      newPermissions[newRoleName] = Object.entries(perms)
        .filter(([perm, enabled]) => enabled === true)
        .map(([perm]) => perm);
    } else {
      newPermissions[newRoleName] = perms;
    }
  }
  
  return {
    ...category,
    permissions: newPermissions
  };
});

// Fix channel-specific permissions the same way
if (config.channelPermissions) {
  const newChannelPerms = {};
  for (const [channelName, perms] of Object.entries(config.channelPermissions)) {
    const newPerms = {};
    for (const [roleName, rolePerms] of Object.entries(perms)) {
      // Handle old role names without emojis
      let newRoleName = roleName;
      if (roleName === 'Bronze') newRoleName = '🥉Bronze';
      if (roleName === 'Silver') newRoleName = '🥈Silver';
      if (roleName === 'Gold') newRoleName = '🥇Gold';
      
      if (typeof rolePerms === 'object' && !Array.isArray(rolePerms)) {
        newPerms[newRoleName] = Object.entries(rolePerms)
          .filter(([perm, enabled]) => enabled === true)
          .map(([perm]) => perm);
      } else {
        newPerms[newRoleName] = rolePerms;
      }
    }
    newChannelPerms[channelName] = newPerms;
  }
  config.channelPermissions = newChannelPerms;
}

fs.writeFileSync('config/website.config.json', JSON.stringify(config, null, 2), 'utf8');
console.log('✓ Fixed Website Bot permissions with correct Patreon role names');
console.log('\nRole names updated:');
console.log('  🥉Bronze (bronze medal emoji)');
console.log('  🥈Silver (silver medal emoji)');
console.log('  🥇Gold (gold medal emoji)');
console.log('  Partner (no emoji)');
