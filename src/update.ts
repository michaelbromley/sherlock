/**
 * Self-update command — checks GitHub for a newer release and replaces the binary in-place.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as p from '@clack/prompts';
import pkg from '../package.json';

const REPO = 'michaelbromley/sherlock';
const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;
const CHANGELOG_URL = `https://raw.githubusercontent.com/${REPO}/main/CHANGELOG.md`;
const INSTALL_COMMAND = `curl -fsSL https://raw.githubusercontent.com/${REPO}/main/install.sh | bash`;

// ============================================================================
// Platform helpers
// ============================================================================

/**
 * Map process.platform + process.arch to the GitHub release asset name. Only
 * platforms the release workflow builds are listed; keep the two in step.
 */
function getAssetName(): string | null {
    const { platform, arch } = process;
    const map: Record<string, Record<string, string>> = {
        darwin: { arm64: 'sherlock-darwin-arm64' },
        linux: { x64: 'sherlock-linux-x64', arm64: 'sherlock-linux-arm64' },
    };
    return map[platform]?.[arch] ?? null;
}

/**
 * Whether this binary sits in ~/.claude/skills/sherlock, where installers up to
 * 1.7.0 put it together with the skill and the config. Updating the binary in
 * place keeps that layout; the installer moves out of it.
 */
function isOldLayout(): boolean {
    // Compare resolved paths: either side may reach the same directory through
    // a symlink, such as /tmp -> /private/tmp on macOS.
    const resolve = (dir: string) => {
        try {
            return fs.realpathSync(dir);
        } catch {
            return dir;
        }
    };
    return resolve(path.dirname(process.execPath)) === resolve(path.join(os.homedir(), '.claude', 'skills', 'sherlock'));
}

/** Tell the user how to leave the old layout */
function warnOldLayout(): void {
    p.log.warn(
        `This sherlock is installed in ${path.dirname(process.execPath)}, the layout used up to 1.7.0. ` +
        `Run the installer to move to the current layout. It keeps your connections, puts sherlock ` +
        `on PATH, and removes the old copy:\n  ${INSTALL_COMMAND}`
    );
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
            `No prebuilt binary for ${process.platform}/${process.arch}, so sherlock cannot update itself here. ` +
                `Pull and rebuild from source: https://github.com/${REPO}#from-source`,
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
        if (isOldLayout()) warnOldLayout();
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

    // 10. Done. The skill is installed and updated by the skills CLI (or
    // whichever skill manager the user chose), not by the binary.
    console.log('');
    p.log.info(`Restart sherlock to use v${latestVersion}.`);
    if (isOldLayout()) {
        warnOldLayout();
    } else {
        p.log.info('To update the agent skill as well, run: npx skills update sherlock -g');
    }
}
