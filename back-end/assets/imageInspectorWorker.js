'use strict';
// Standalone decoder process: no application imports, URLs, credentials or provider access.
async function decodeImage(bytes) {
  let sharp;
  try { sharp = require('sharp'); } catch { process.exitCode = 2; throw Error('decoder unavailable'); }
  sharp.cache(false); sharp.concurrency(1);
  sharp.block({ operation: ['VipsForeignLoad'] });
  sharp.unblock({ operation: ['VipsForeignLoadJpegBuffer','VipsForeignLoadPngBuffer','VipsForeignLoadWebpBuffer'] });
  // libvips decodes only APNG's default frame and does not expose its frame count.
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    let offset = 8, ended = false;
    while (offset + 12 <= bytes.length) {
      const size = bytes.readUInt32BE(offset);
      const type = bytes.toString('ascii',offset+4,offset+8);
      if (size > bytes.length-offset-12 || ['acTL','fcTL','fdAT'].includes(type)) throw Error('PNG content');
      offset += size+12;
      if (type === 'IEND') { ended = true; break; }
    }
    if (!ended || offset !== bytes.length) throw Error('PNG boundary');
  }
  const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 16_000_000, limitInputChannels: 4 });
  const metadata = await image.metadata();
  if (!['jpeg','png','webp'].includes(metadata.format) || (metadata.pages || 1) !== 1) throw Error('format');
  // stats decodes every pixel; metadata alone would accept truncated image content.
  await image.timeout({ seconds: 4 }).stats();
  return metadata.format === 'jpeg' ? 'jpg' : metadata.format;
}
async function main() {
  let length = 0; const chunks = [];
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > 5_000_000) throw Error('limit');
    chunks.push(chunk);
  }
  process.stdout.write(await decodeImage(Buffer.concat(chunks)));
}
module.exports = { decodeImage };
if (require.main === module) main().catch(() => { process.exitCode ||= 1; });
