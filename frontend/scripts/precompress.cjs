const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const distDir = path.resolve(__dirname, "..", "dist");

function compressDirectory(dir) {
	if (!fs.existsSync(dir)) return;
	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			compressDirectory(fullPath);
		} else if (entry.isFile()) {
			const ext = path.extname(entry.name).toLowerCase();
			if ([".js", ".css", ".html", ".svg", ".json"].includes(ext) && !entry.name.endsWith(".gz")) {
				const content = fs.readFileSync(fullPath);
				const gzipped = zlib.gzipSync(content, { level: 9 });
				fs.writeFileSync(`${fullPath}.gz`, gzipped);
			}
		}
	}
}

console.log("Generando archivos .gz pre-comprimidos (gzip_static)...");
compressDirectory(distDir);
console.log("Pre-compresión finalizada con éxito.");
