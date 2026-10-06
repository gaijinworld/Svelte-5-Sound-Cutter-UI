// Generates desktop/assets/icon.png — 512×512 blue rounded square with a
// white waveform glyph. Pure Node (zlib + CRC32), no image deps.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const S = 512;
const R = 112; // corner radius
const BG = [37, 99, 235]; // #2563eb
const BG2 = [29, 78, 216]; // subtle vertical gradient → #1d4ed8
const FG = [255, 255, 255];

function crc32(buf) {
	let table = crc32.t;
	if (!table) {
		table = crc32.t = new Int32Array(256);
		for (let n = 0; n < 256; n++) {
			let c = n;
			for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			table[n] = c;
		}
	}
	let c = -1;
	for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ -1) >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
}

const pixels = Buffer.alloc(S * (S * 4 + 1));
// Waveform bars: [x-center offset from mid, half-height fraction]
const bars = [-3, -2, -1, 0, 1, 2, 3].map((i) => ({
	x: S / 2 + i * 56,
	w: 30,
	h: [0.28, 0.55, 0.82, 1.0, 0.82, 0.55, 0.28][i + 3] * 0.30 * S
}));

for (let y = 0; y < S; y++) {
	const row = y * (S * 4 + 1);
	pixels[row] = 0; // filter: none
	for (let x = 0; x < S; x++) {
		const off = row + 1 + x * 4;
		const inRect =
			(x >= R && x < S - R && y >= 0 && y < S) ||
			(y >= R && y < S - R) ||
			[0, 1].some((cx) =>
				[0, 1].some(
					(cy) =>
						Math.hypot(
							x - (cx ? S - R - 1 : R),
							y - (cy ? S - R - 1 : R)
						) <= R &&
						x >= (cx ? S - R - 1 : 0) &&
						x < (cx ? S : R) &&
						y >= (cy ? S - R - 1 : 0) &&
						y < (cy ? S : R)
				)
			);
		let px = inRect ? [...BG] : [0, 0, 0];
		let a = inRect ? 255 : 0;
		if (inRect) {
			const t = y / S;
			px = BG.map((c, i) => Math.round(c + (BG2[i] - c) * t));
			for (const b of bars) {
				if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(y - S / 2) <= b.h / 2) {
					px = FG;
					break;
				}
			}
		}
		pixels[off] = px[0];
		pixels[off + 1] = px[1];
		pixels[off + 2] = px[2];
		pixels[off + 3] = a;
	}
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0);
ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

const png = Buffer.concat([
	Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
	chunk('IHDR', ihdr),
	chunk('IDAT', zlib.deflateSync(pixels, { level: 9 })),
	chunk('IEND', Buffer.alloc(0))
]);

const out = path.resolve(__dirname, '../assets/icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log(`✅ ${out} (${png.length} bytes)`);
