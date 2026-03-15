const fs = require("fs");
const path = require("path");

function parseEnvFile(content) {
  const values = {};

  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) return;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  });

  return values;
}

function loadLocalEnv() {
  [".env.local", ".env"].forEach((fileName) => {
    const fullPath = path.join(__dirname, fileName);
    if (!fs.existsSync(fullPath)) return;

    const parsed = parseEnvFile(fs.readFileSync(fullPath, "utf8"));
    Object.entries(parsed).forEach(([key, value]) => {
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    });
  });
}

module.exports = {
  loadLocalEnv
};
