import fs from 'node:fs';
import sharp from 'sharp';

for (const file of process.argv.slice(2)) {
	const original = fs.readFileSync(file);
	const candidate = await sharp(original).keepIccProfile().png({ compressionLevel: 9 }).toBuffer();
	const a = await sharp(original).raw().toBuffer({ resolveWithObject: true });
	const b = await sharp(candidate).raw().toBuffer({ resolveWithObject: true });
	if (a.info.width !== b.info.width || a.info.height !== b.info.height || a.info.channels !== b.info.channels || !a.data.equals(b.data)) {
		throw Error('Decoded pixels changed: ' + file);
	}
	const metadata = await sharp(candidate).metadata();
	if (metadata.exif || metadata.xmp || metadata.iptc) throw Error('Private metadata remains: ' + file);
	fs.writeFileSync(file, candidate);
	console.log('Removed private metadata; decoded pixels unchanged: ' + file);
}
