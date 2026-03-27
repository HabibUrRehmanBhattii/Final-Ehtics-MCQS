#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

const TARGET_FILES = [
  'index.html',
  'data/topics.json',
  'data/topics-updated.json',
  'js/app.js',
  'sw.js'
];

const SOURCE_PATTERNS = [
  /^js\/.+\.js$/i,
  /^css\/.+\.css$/i,
  /^src\/.+\.(js|ts)$/i,
  /^data\/.+\.json$/i,
  /^tests\/.+\.(js|ts)$/i,
  /^index\.html$/i,
  /^sw\.js$/i
];

function readText(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function writeText(relativePath, content) {
  if (dryRun) return;
  fs.writeFileSync(path.join(rootDir, relativePath), content, 'utf8');
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function parseStagedFilesFromEnv() {
  const raw = String(process.env.PRECOMMIT_STAGED_FILES || '');
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isVersionOnlyCommit(stagedFiles) {
  if (stagedFiles.length === 0) return true;
  return stagedFiles.every((filePath) => TARGET_FILES.includes(filePath));
}

function matchesAnyPattern(filePath, patterns) {
  return patterns.some((pattern) => pattern.test(filePath));
}

function getTodayUtcTagDate() {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function nextDateTagDate(currentDateTag) {
  const year = Number(currentDateTag.slice(0, 4));
  const month = Number(currentDateTag.slice(4, 6)) - 1;
  const day = Number(currentDateTag.slice(6, 8));
  const date = new Date(Date.UTC(year, month, day));
  date.setUTCDate(date.getUTCDate() + 1);
  const y = String(date.getUTCFullYear());
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function nextSuffix(currentSuffix) {
  const code = currentSuffix.charCodeAt(0);
  if (code < 97 || code > 122) return null;
  if (code === 122) return null;
  return String.fromCharCode(code + 1);
}

function incrementCacheVersion(version) {
  const parts = version.split('.').map((piece) => Number(piece));
  if (parts.length !== 3 || parts.some((piece) => !Number.isInteger(piece) || piece < 0)) {
    return null;
  }
  return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
}

function updateFileTag(content, oldTag, newTag) {
  return content.split(`v=${oldTag}`).join(`v=${newTag}`);
}

function main() {
  const stagedFiles = parseStagedFilesFromEnv();

  if (dryRun) {
    log('[pre-commit] Running in dry-run mode.');
  }

  if (stagedFiles.length === 0) {
    log('[pre-commit] No staged files. Skipping auto-version bump.');
    return;
  }

  if (isVersionOnlyCommit(stagedFiles)) {
    log('[pre-commit] Version-target files only. Skipping auto-version bump.');
    return;
  }

  const hasSourceChanges = stagedFiles.some((filePath) => (
    !TARGET_FILES.includes(filePath) && matchesAnyPattern(filePath, SOURCE_PATTERNS)
  ));

  if (!hasSourceChanges) {
    log('[pre-commit] No source file changes detected. Skipping auto-version bump.');
    return;
  }

  const indexPath = 'index.html';
  const topicsPath = 'data/topics.json';
  const topicsUpdatedPath = 'data/topics-updated.json';
  const appPath = 'js/app.js';
  const swPath = 'sw.js';

  const indexText = readText(indexPath);
  const oldTagMatch = indexText.match(/v=([0-9]{8}[a-z])/);
  if (!oldTagMatch) {
    fail('[pre-commit] Could not find version tag pattern v=YYYYMMDDa in index.html.');
  }

  const oldTag = oldTagMatch[1];
  const oldDate = oldTag.slice(0, 8);
  const oldSuffix = oldTag.slice(8, 9);
  const todayTagDate = getTodayUtcTagDate();

  let newDate = oldDate === todayTagDate ? oldDate : todayTagDate;
  let newSuffix = oldDate === todayTagDate ? nextSuffix(oldSuffix) : 'a';

  if (!newSuffix) {
    newDate = nextDateTagDate(oldDate);
    newSuffix = 'a';
  }

  const newTag = `${newDate}${newSuffix}`;
  log(`[pre-commit] Auto version bump: ${oldTag} -> ${newTag}`);

  const nextIndexText = updateFileTag(indexText, oldTag, newTag);
  if (nextIndexText !== indexText) {
    writeText(indexPath, nextIndexText);
  }

  const topicsText = readText(topicsPath);
  const nextTopicsText = updateFileTag(topicsText, oldTag, newTag);
  if (nextTopicsText !== topicsText) {
    writeText(topicsPath, nextTopicsText);
  }

  const topicsUpdatedFullPath = path.join(rootDir, topicsUpdatedPath);
  if (fs.existsSync(topicsUpdatedFullPath)) {
    const topicsUpdatedText = readText(topicsUpdatedPath);
    const nextTopicsUpdatedText = updateFileTag(topicsUpdatedText, oldTag, newTag);
    if (nextTopicsUpdatedText !== topicsUpdatedText) {
      writeText(topicsUpdatedPath, nextTopicsUpdatedText);
    }
  }

  const appText = readText(appPath);
  const appBuildPattern = /appBuildVersion:\s*'([0-9]{8}[a-z])'/;
  const cachePattern = /cacheVersion:\s*'v([0-9]+\.[0-9]+\.[0-9]+)'/;
  const appBuildMatch = appText.match(appBuildPattern);
  const cacheMatch = appText.match(cachePattern);

  let nextAppText = appText;
  if (appBuildMatch) {
    nextAppText = nextAppText.replace(appBuildPattern, `appBuildVersion: '${newTag}'`);
  }

  if (cacheMatch) {
    const currentCache = cacheMatch[1];
    const nextCache = incrementCacheVersion(currentCache);
    if (nextCache) {
      nextAppText = nextAppText.replace(cachePattern, `cacheVersion: 'v${nextCache}'`);
      log(`[pre-commit] Cache version bump: v${currentCache} -> v${nextCache}`);
    }
  }

  if (nextAppText !== appText) {
    writeText(appPath, nextAppText);
  }

  const swText = readText(swPath);
  const swCachePattern = /const\s+CACHE_VERSION\s*=\s*'v([0-9]+\.[0-9]+\.[0-9]+)'/;
  const swCacheMatch = swText.match(swCachePattern);
  if (swCacheMatch && cacheMatch) {
    const nextCache = incrementCacheVersion(cacheMatch[1]);
    if (nextCache) {
      const nextSwText = swText.replace(swCachePattern, `const CACHE_VERSION = 'v${nextCache}'`);
      if (nextSwText !== swText) {
        writeText(swPath, nextSwText);
      }
    }
  }

  log('[pre-commit] Version files updated. Hook will stage target files next.');
}

try {
  main();
} catch (error) {
  fail(`[pre-commit] Unexpected failure: ${error.message}`);
}
