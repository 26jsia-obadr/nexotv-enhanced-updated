import packageJson from '../../package.json';

const shortCommit = process.env.RENDER_GIT_COMMIT?.slice(0, 7);

export const APP_VERSION = `v${packageJson.version}-${shortCommit || 'dev'}`;
export const PACKAGE_VERSION = packageJson.version;