import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getJobOutput, getSourceByToken } from './ffmpeg';

export interface ApiContext {
	port(): number;
}

export function isMp3sApiPath(pathname: string): boolean {
	return pathname.startsWith('/api/mp3s');
}

const MIME_TYPES: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'application/javascript; charset=utf-8',
	'.mjs': 'application/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.mp3': 'audio/mpeg',
	'.wav': 'audio/wav',
	'.wave': 'audio/wav',
	'.m4a': 'audio/mp4',
	'.aac': 'audio/aac',
	'.ogg': 'audio/ogg',
	'.oga': 'audio/ogg',
	'.opus': 'audio/ogg',
	'.flac': 'audio/flac',
	'.wma': 'audio/x-ms-wma'
};

/** Only this app's loopback page may call the local file APIs. */
function guardLocalApi(req: http.IncomingMessage, port: number): boolean {
	const allowedHosts = [`localhost:${port}`, `127.0.0.1:${port}`];
	if (!allowedHosts.includes(String(req.headers.host || ''))) return false;
	const origin = req.headers.origin;
	if (origin && !allowedHosts.some((h) => origin === `http://${h}`)) return false;
	if (req.headers['sec-fetch-site'] === 'cross-site') return false;
	return true;
}

function streamFile(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	filePath: string,
	name: string
): void {
	const stat = fs.statSync(filePath);
	const ext = path.extname(name).toLowerCase();
	const type = MIME_TYPES[ext] || 'application/octet-stream';
	const range = req.headers.range;
	if (range) {
		const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
		if (m) {
			const start = m[1] === '' ? Math.max(0, stat.size - Number(m[2])) : Number(m[1]);
			const end = m[2] === '' || m[1] === '' ? stat.size - 1 : Math.min(Number(m[2]), stat.size - 1);
			if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < stat.size) {
				res.writeHead(206, {
					'Content-Type': type,
					'Content-Length': end - start + 1,
					'Content-Range': `bytes ${start}-${end}/${stat.size}`,
					'Accept-Ranges': 'bytes',
					'Cache-Control': 'no-store'
				});
				fs.createReadStream(filePath, { start, end }).pipe(res);
				return;
			}
		}
		res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
		res.end();
		return;
	}
	res.writeHead(200, {
		'Content-Type': type,
		'Content-Length': stat.size,
		'Accept-Ranges': 'bytes',
		'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(name)}`,
		'Cache-Control': 'no-store'
	});
	fs.createReadStream(filePath).pipe(res);
}

function serveApi(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	url: URL,
	port: number
): void {
	const deny = (status: number, message: string) => {
		const payload = JSON.stringify({ message });
		res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
		res.end(payload);
	};

	if (!guardLocalApi(req, port)) {
		deny(403, 'Local API accepts only this desktop app.');
		return;
	}

	const sourceMatch = /^\/api\/mp3s\/source\/([0-9a-f-]{36})$/i.exec(url.pathname);
	if (sourceMatch && req.method === 'GET') {
		const source = getSourceByToken(sourceMatch[1]);
		if (!source) {
			deny(404, 'Unknown source.');
			return;
		}
		try {
			streamFile(req, res, source.path, source.name);
		} catch {
			deny(404, 'Source file no longer exists.');
		}
		return;
	}

	const outMatch = /^\/api\/mp3s\/output\/([^/]+)\/([^/]+)$/.exec(url.pathname);
	if (outMatch && req.method === 'GET') {
		const filePath = getJobOutput(
			decodeURIComponent(outMatch[1]),
			decodeURIComponent(outMatch[2])
		);
		if (!filePath) {
			deny(404, 'Unknown output.');
			return;
		}
		streamFile(req, res, filePath, path.basename(filePath));
		return;
	}

	// API-like paths must never fall through to the SPA shell.
	deny(404, 'Unknown desktop API path.');
}

/** Starts the loopback static server; returns the bound port. */
export function startLocalRendererServer(rendererDir: string): Promise<{
	server: http.Server;
	port: number;
}> {
	return new Promise((resolve, reject) => {
		const server = http.createServer((req, res) => {
			const parsedUrl = new URL(req.url || '/', 'http://localhost');
			const port = (server.address() as { port: number })?.port ?? 0;

			if (isMp3sApiPath(parsedUrl.pathname)) {
				if (parsedUrl.pathname === '/api/mp3s/health' && req.method === 'GET') {
					if (!guardLocalApi(req, port)) {
						const payload = JSON.stringify({ message: 'Local API accepts only this desktop app.' });
						res.writeHead(403, { 'Content-Type': 'application/json' });
						res.end(payload);
						return;
					}
					const payload = JSON.stringify({ ok: true, name: 'audio-splitter-desktop' });
					res.writeHead(200, {
						'Content-Type': 'application/json; charset=utf-8',
						'Cache-Control': 'no-store'
					});
					res.end(payload);
					return;
				}
				serveApi(req, res, parsedUrl, port);
				return;
			}

			let pathname: string;
			try {
				pathname = decodeURIComponent(parsedUrl.pathname);
			} catch {
				res.writeHead(400);
				res.end('Bad request');
				return;
			}
			if (pathname === '/' || pathname === '') pathname = '/index.html';

			const filePath = path.normalize(path.join(rendererDir, pathname));
			if (!filePath.startsWith(path.normalize(rendererDir))) {
				res.writeHead(403);
				res.end('Forbidden');
				return;
			}

			fs.readFile(filePath, (err, data) => {
				if (err) {
					// SPA fallback — same as the reference implementation.
					fs.readFile(path.join(rendererDir, 'index.html'), (spaErr, spaData) => {
						if (spaErr) {
							res.writeHead(404);
							res.end('Not found');
						} else {
							res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
							res.end(spaData);
						}
					});
					return;
				}
				const ext = path.extname(filePath).toLowerCase();
				res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
				res.end(data);
			});
		});

		server.on('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (typeof address === 'object' && address !== null) {
				resolve({ server, port: address.port });
			} else {
				reject(new Error('Unable to obtain loopback port'));
			}
		});
	});
}
