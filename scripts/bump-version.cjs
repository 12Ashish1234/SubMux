const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];

if (!newVersion) {
  console.error('Error: Please provide a new version number (e.g. npm run bump 0.2.0)');
  process.exit(1);
}

// Clean version string (e.g. "v0.2.0" -> "0.2.0")
const cleanVersion = newVersion.replace(/^v/, '');

// 1. Update package.json
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = cleanVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✓ Updated package.json to ${cleanVersion}`);

// 2. Update src-tauri/tauri.conf.json
const tauriConfPath = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
tauriConf.version = cleanVersion;
fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');
console.log(`✓ Updated src-tauri/tauri.conf.json to ${cleanVersion}`);

// 3. Update src-tauri/Cargo.toml
const cargoTomlPath = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');
let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
cargoToml = cargoToml.replace(
  /^version\s*=\s*"[^"]+"/m,
  `version = "${cleanVersion}"`
);
fs.writeFileSync(cargoTomlPath, cargoToml);
console.log(`✓ Updated src-tauri/Cargo.toml to ${cleanVersion}`);

// 4. Update TitleBar.tsx badge
const titleBarPath = path.join(__dirname, '..', 'src', 'components', 'TitleBar.tsx');
let titleBar = fs.readFileSync(titleBarPath, 'utf8');
titleBar = titleBar.replace(
  /v\d+\.\d+\.\d+/g,
  `v${cleanVersion}`
);
fs.writeFileSync(titleBarPath, titleBar);
console.log(`✓ Updated src/components/TitleBar.tsx to v${cleanVersion}`);

console.log(`\n🎉 Successfully bumped SubMux version to v${cleanVersion}!`);
console.log(`Next steps:`);
console.log(`  git commit -am "chore: bump version to v${cleanVersion}"`);
console.log(`  git tag v${cleanVersion}`);
console.log(`  git push && git push origin v${cleanVersion}`);
