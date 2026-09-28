/**
 * Passphrase encryption for connection export files.
 *
 * The key is derived from the passphrase with scrypt and the payload is sealed
 * with AES-256-GCM, both from node:crypto. GCM authenticates the ciphertext and
 * the header, so a wrong passphrase, a corrupted file and a file someone has
 * edited all fail to decrypt instead of producing garbage.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

export const EXPORT_FORMAT = 'sherlock-connections';
export const EXPORT_FORMAT_VERSION = 1;

/** scrypt cost. 2^17 takes well under a second and 128 MiB, per OWASP guidance */
const SCRYPT_N = 2 ** 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
/**
 * Largest N accepted on import. r and p must match what export writes, so the
 * most a file can make import allocate is 128 * N * r = 256 MiB. The file's
 * header is only authenticated after the key has been derived, so these limits
 * are all that stands between a hostile file and an exhausted machine.
 */
const MAX_SCRYPT_N = 2 ** 18;

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export const MIN_PASSPHRASE_LENGTH = 12;

/** The on-disk form. Everything except the ciphertext is authenticated as AAD */
interface EncryptedEnvelope {
    format: typeof EXPORT_FORMAT;
    version: number;
    kdf: { name: 'scrypt'; N: number; r: number; p: number; salt: string };
    cipher: { name: 'aes-256-gcm'; iv: string };
    ciphertext: string;
    tag: string;
}

type EnvelopeHeader = Omit<EncryptedEnvelope, 'ciphertext' | 'tag'>;

/** The file is not a readable export file. Retyping the passphrase will not help */
export class ExportFileError extends Error {}

/**
 * The file is well formed but did not decrypt: either the passphrase is wrong
 * or the encrypted contents were changed. GCM cannot tell the two apart.
 */
export class DecryptionFailedError extends ExportFileError {}

const DECRYPT_FAILED =
    'Could not decrypt the file. Either the passphrase is wrong, or the file has been ' +
    'modified or corrupted since it was exported.';

/** Serialise the header in a fixed field order, so the AAD is the same on both ends */
function headerAad(header: EnvelopeHeader): Buffer {
    const { kdf, cipher } = header;
    return Buffer.from(JSON.stringify([
        header.format, header.version,
        kdf.name, kdf.N, kdf.r, kdf.p, kdf.salt,
        cipher.name, cipher.iv,
    ]), 'utf-8');
}

function deriveKey(passphrase: string, salt: Buffer, N: number, r: number, p: number): Buffer {
    return scryptSync(passphrase.normalize('NFC'), salt, KEY_LENGTH, {
        N, r, p,
        // scrypt needs 128 * N * r bytes; the default cap is lower than that
        maxmem: 256 * N * r,
    });
}

/**
 * Encrypt a plaintext payload under a passphrase and return the file contents.
 * `scryptN` exists so tests can run at a lower cost; decryption reads the cost
 * from the file.
 */
export function encryptPayload(plaintext: Buffer, passphrase: string, scryptN: number = SCRYPT_N): string {
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    const header: EnvelopeHeader = {
        format: EXPORT_FORMAT,
        version: EXPORT_FORMAT_VERSION,
        kdf: { name: 'scrypt', N: scryptN, r: SCRYPT_R, p: SCRYPT_P, salt: salt.toString('base64') },
        cipher: { name: 'aes-256-gcm', iv: iv.toString('base64') },
    };

    const key = deriveKey(passphrase, salt, scryptN, SCRYPT_R, SCRYPT_P);
    try {
        const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: TAG_LENGTH });
        cipher.setAAD(headerAad(header));
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const envelope: EncryptedEnvelope = {
            ...header,
            ciphertext: ciphertext.toString('base64'),
            tag: cipher.getAuthTag().toString('base64'),
        };
        return JSON.stringify(envelope, null, 2) + '\n';
    } finally {
        key.fill(0);
    }
}

/** An export file whose structure has been checked, ready to decrypt */
export interface SealedFile {
    header: EnvelopeHeader;
    salt: Buffer;
    iv: Buffer;
    tag: Buffer;
    ciphertext: Buffer;
}

/**
 * Check an export file's structure without the passphrase. Anything wrong here
 * is a problem with the file, so the caller can report it before asking for a
 * passphrase at all.
 */
export function readSealedFile(fileContents: string): SealedFile {
    let raw: any;
    try {
        raw = JSON.parse(fileContents);
    } catch {
        throw new ExportFileError('This is not a sherlock export file, or it is incomplete: it is not valid JSON.');
    }

    if (raw?.format !== EXPORT_FORMAT) {
        throw new ExportFileError('This is not a sherlock export file.');
    }
    if (raw.version !== EXPORT_FORMAT_VERSION) {
        throw new ExportFileError(
            `This export file is format version ${raw.version}, which this version of sherlock ` +
            `cannot read. Run 'sherlock update' and try again.`
        );
    }

    const { kdf, cipher } = raw;
    const kdfValid = kdf?.name === 'scrypt'
        && Number.isInteger(kdf.N) && kdf.N > 1 && kdf.N <= MAX_SCRYPT_N && (kdf.N & (kdf.N - 1)) === 0
        && kdf.r === SCRYPT_R && kdf.p === SCRYPT_P
        && typeof kdf.salt === 'string';
    const cipherValid = cipher?.name === 'aes-256-gcm' && typeof cipher.iv === 'string';

    if (!kdfValid || !cipherValid || typeof raw.ciphertext !== 'string' || typeof raw.tag !== 'string') {
        throw new ExportFileError('The export file is corrupted: its header is missing or invalid.');
    }

    const sealed: SealedFile = {
        header: { format: raw.format, version: raw.version, kdf, cipher },
        salt: decodeBase64(kdf.salt, 'salt'),
        iv: decodeBase64(cipher.iv, 'iv'),
        tag: decodeBase64(raw.tag, 'tag'),
        ciphertext: decodeBase64(raw.ciphertext, 'ciphertext'),
    };
    if (sealed.salt.length < SALT_LENGTH || sealed.iv.length !== IV_LENGTH
        || sealed.tag.length !== TAG_LENGTH || sealed.ciphertext.length === 0) {
        throw new ExportFileError('The export file is corrupted: a field has the wrong length.');
    }
    return sealed;
}

/**
 * Decrypt an export file. Throws `DecryptionFailedError` when the passphrase is
 * wrong or the contents were modified, and `ExportFileError` for a malformed file.
 */
export function decryptPayload(file: string | SealedFile, passphrase: string): Buffer {
    const sealed = typeof file === 'string' ? readSealedFile(file) : file;
    const { kdf } = sealed.header;

    const key = deriveKey(passphrase, sealed.salt, kdf.N, kdf.r, kdf.p);
    try {
        const decipher = createDecipheriv('aes-256-gcm', key, sealed.iv, { authTagLength: TAG_LENGTH });
        decipher.setAAD(headerAad(sealed.header));
        decipher.setAuthTag(sealed.tag);
        return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]);
    } catch {
        throw new DecryptionFailedError(DECRYPT_FAILED);
    } finally {
        key.fill(0);
    }
}

function decodeBase64(value: string, field: string): Buffer {
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
        throw new ExportFileError(`The export file is corrupted: "${field}" is not valid base64.`);
    }
    return Buffer.from(value, 'base64');
}
