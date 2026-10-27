// External station endpoints (all on one CDN host with open CORS).
export const CDN_BASE = 'https://d3d4yli4hf5bmh.cloudfront.net';
export const STREAM_URL = `${CDN_BASE}/hls/live.m3u8`;
export const METADATA_URL = `${CDN_BASE}/metadatav2.json`;
export const COVER_URL = `${CDN_BASE}/cover.jpg`;
