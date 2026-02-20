/**
 * Self-update command — checks GitHub for a newer release and replaces the binary in-place.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as p from '@clack/prompts';
import pkg from '../package.json';
import { isPortableMode, getBinaryDir } from './config/paths';

const REPO = 'michaelbromley/sherlock';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const CHANGELOG_URL = `https://raw.githubusercontent.com/${REPO}/main/CHANGELOG.md`;
const SKILL_URL = `https://raw.githubusercontent.com/${REPO}/main/.claude/skills/sherlock/SKILL.md`;

// ============================================================================
// Platform helpers
// ============================================================================

/** Map process.platform + process.arch to the GitHub release asset name */
function getAssetName(): string | null {
    const { platform, arch } = process;
    const map: Record<string, Record<string, string>> = {
        darwin: { arm64: 'sherlock-darwin-arm64', x64: 'sherlock-darwin-x64' },
        linux: { x64: 'sherlock-linux-x64' },
        win32: { x64: 'sherlock-windows.exe' },
    };
    return map[platform]?.[arch] ?? null;
}

/** Returns true when running as a compiled binary (not `bun run src/...`) */
function isCompiledBinary(): boolean {
    return path.basename(process.execPath).startsWith('sherlock');
}

// ============================================================================
// Version helpers
// ============================================================================

/** Compare two semver strings. Returns -1 | 0 | 1 */
function compareSemver(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff < 0) return -1;
        if (diff > 0) return 1;
    }
    return 0;
}

// ============================================================================
// Changelog parser
// ============================================================================

/**
 * Extract changelog entries for all versions between `current` (exclusive) and
 * `latest` (inclusive) from a Keep-a-Changelog formatted markdown string.
 */
function extractChangelog(markdown: string, current: string, latest: string): string | null {
    const lines = markdown.split('\n');
    const sections: { version: string; content: string[] }[] = [];

    let currentSection: { version: string; content: string[] } | null = null;

    for (const line of lines) {
        const match = line.match(/^## \[(\d+\.\d+\.\d+)\]/);
        if (match) {
            if (currentSection) sections.push(currentSection);
            currentSection = { version: match[1], content: [] };
        } else if (currentSection) {
            currentSection.content.push(line);
        }
    }
    if (currentSection) sections.push(currentSection);

    const relevant = sections.filter(
        (s) => compareSemver(s.version, current) > 0 && compareSemver(s.version, latest) <= 0,
    );

    if (relevant.length === 0) return null;

    return relevant
        .map((s) => {
            const body = s.content.join('\n').trim();
            return `### v${s.version}\n${body}`;
        })
        .join('\n\n');
}

// ============================================================================
// Network helpers
// ============================================================================

interface ReleaseAsset {
    name: string;
    browser_download_url: string;
}

interface ReleaseInfo {
    tag_name: string;
    assets: ReleaseAsset[];
}

async function fetchReleaseInfo(): Promise<ReleaseInfo> {
    const res = await fetch(RELEASES_API, {
        headers: { 'User-Agent': `sherlock/${pkg.version}` },
    });
    if (!res.ok) {
        throw new Error(`Could not check for updates (HTTP ${res.status})`);
    }
    return (await res.json()) as ReleaseInfo;
}

async function fetchChangelog(): Promise<string | null> {
    try {
        const res = await fetch(CHANGELOG_URL, {
            headers: { 'User-Agent': `sherlock/${pkg.version}` },
        });
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}

// ============================================================================
// Binary replacement
// ============================================================================

async function downloadAndReplace(url: string, targetPath: string): Promise<void> {
    const res = await fetch(url, {
        headers: { 'User-Agent': `sherlock/${pkg.version}` },
    });
    if (!res.ok) {
        throw new Error(`Download failed (HTTP ${res.status})`);
    }

    const buffer = await res.arrayBuffer();
    const tmpPath = targetPath + '.tmp';

    try {
        fs.writeFileSync(tmpPath, Buffer.from(buffer));
        fs.chmodSync(tmpPath, 0o755);

        if (process.platform === 'win32') {
            // Windows locks running binaries — rename current out of the way first
            const oldPath = targetPath + '.old';
            fs.renameSync(targetPath, oldPath);
            fs.renameSync(tmpPath, targetPath);
            try { fs.unlinkSync(oldPath); } catch { /* will be cleaned up next run */ }
        } else {
            fs.renameSync(tmpPath, targetPath);
        }
    } finally {
        try { fs.unlinkSync(tmpPath); } catch { /* already moved or cleaned */ }
    }
}

// ============================================================================
// SKILL.md update
// ============================================================================

async function updateSkillFile(): Promise<boolean> {
    try {
        const res = await fetch(SKILL_URL, {
            headers: { 'User-Agent': `sherlock/${pkg.version}` },
        });
        if (!res.ok) return false;

        const content = await res.text();
        const skillPath = path.join(getBinaryDir(), 'SKILL.md');
        fs.writeFileSync(skillPath, content);
        return true;
    } catch {
        return false;
    }
}

// ============================================================================
// Main
// ============================================================================

export async function runUpdate(): Promise<void> {
    // 1. Dev mode check
    if (!isCompiledBinary()) {
        p.log.info('Self-update is only available for compiled binaries. Use git pull to update from source.');
        return;
    }

    // 2. Platform check
    const assetName = getAssetName();
    if (!assetName) {
        p.log.error(
            `Unsupported platform (${process.platform}/${process.arch}). Download manually from https://github.com/${REPO}/releases`,
        );
        return;
    }

    // 3. Check for updates
    const spin = p.spinner();
    spin.start('Checking for updates...');

    let release: ReleaseInfo;
    try {
        release = await fetchReleaseInfo();
    } catch (err) {
        spin.stop('');
        if (err instanceof TypeError && err.message.includes('fetch')) {
            p.log.error('Could not check for updates. Check your internet connection.');
        } else {
            p.log.error(err instanceof Error ? err.message : String(err));
        }
        return;
    }

    const latestVersion = release.tag_name.replace(/^v/, '');
    const currentVersion = pkg.version;

    spin.stop('');

    // 4. Already up to date?
    if (compareSemver(currentVersion, latestVersion) >= 0) {
        p.log.success(`You're on the latest version (${currentVersion}).`);
        return;
    }

    // 5. Show version info
    p.log.info(`Current version:  ${currentVersion}`);
    p.log.info(`Latest version:   ${latestVersion}`);

    // 6. Show changelog
    const changelogMd = await fetchChangelog();
    if (changelogMd) {
        const notes = extractChangelog(changelogMd, currentVersion, latestVersion);
        if (notes) {
            p.note(notes, `What's new in v${latestVersion}`);
        }
    }

    // 7. Confirm
    const confirmed = await p.confirm({ message: `Update to v${latestVersion}?` });
    if (p.isCancel(confirmed) || !confirmed) {
        p.log.info('Update cancelled.');
        return;
    }

    // 8. Find asset URL
    const asset = release.assets.find((a) => a.name === assetName);
    if (!asset) {
        p.log.error(
            `No binary found for your platform (${assetName}). Download manually from https://github.com/${REPO}/releases`,
        );
        return;
    }

    // 9. Download and replace
    spin.start('Downloading...');
    try {
        await downloadAndReplace(asset.browser_download_url, process.execPath);
    } catch (err) {
        spin.stop('');
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('EACCES') || msg.includes('permission denied')) {
            p.log.error('Permission denied. Try: sudo sherlock update');
        } else {
            p.log.error(msg);
        }
        return;
    }
    spin.stop('');
    p.log.success('Binary updated');

    // 10. Update SKILL.md in portable mode
    if (isPortableMode()) {
        const skillOk = await updateSkillFile();
        if (skillOk) {
            p.log.success('Skill definition updated');
        } else {
            p.log.warn('Could not update SKILL.md — you can update it manually.');
        }
    }

    // 11. Done
    console.log('');
    p.log.info(`Restart sherlock to use v${latestVersion}.`);
}
