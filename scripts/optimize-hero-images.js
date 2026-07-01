// One-off optimizer for the homepage hero images.
// Resizes (max 1500px, no upscaling) + compresses each JPEG in place so they're
// web-weight instead of multi-MB camera originals. Reads each file fully into a
// buffer before writing, so overwriting in place is safe. Re-run after adding
// new images to src/assets/homepage/hero-images/.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '..', 'src', 'assets', 'homepage', 'hero-images');
const files = fs.readdirSync(DIR).filter(f => /\.(jpe?g|png)$/i.test(f));

(async () => {
  for (const f of files) {
    const p = path.join(DIR, f);
    const before = Math.round(fs.statSync(p).size / 1024);
    const buf = fs.readFileSync(p);
    const out = await sharp(buf)
      .rotate()                                   // bake in EXIF orientation
      .resize({ width: 1500, height: 1500, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 72, mozjpeg: true, progressive: true })
      .toBuffer();
    fs.writeFileSync(p, out);
    console.log(`${f}: ${before} KB -> ${Math.round(out.length / 1024)} KB`);
  }
  console.log('Done.');
})().catch(e => { console.error(e); process.exit(1); });
