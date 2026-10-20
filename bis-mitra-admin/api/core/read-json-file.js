import fs from 'fs';

const LFS_PREFIX = 'version https://git-lfs.github.com';

export function isLfsPointer(content) {
  return String(content || '').startsWith(LFS_PREFIX);
}

export function readJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (isLfsPointer(raw)) {
    const err = new Error(
      'Git LFS pointer on disk — redeploy admin API with git lfs pull in Railway build',
    );
    err.code = 'LFS_POINTER';
    throw err;
  }
  return JSON.parse(raw);
}

export function readJsonFileSafe(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    return readJsonFile(filePath);
  } catch (err) {
    if (err.code === 'LFS_POINTER') {
      return { __lfsPointer: true, message: err.message };
    }
    throw err;
  }
}
