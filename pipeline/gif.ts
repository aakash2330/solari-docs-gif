// PNG screenshots in, animated GIF bytes out. No ffmpeg, no native deps.
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { PNG } from "pngjs";

export function toGif(frames: Uint8Array[], delayMs = 1000) {
  const gif = GIFEncoder();
  frames.forEach((png, i) => {
    const { data, width, height } = PNG.sync.read(Buffer.from(png));
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), width, height, {
      palette,
      // Hold the final frame longer so the end state is readable.
      delay: i === frames.length - 1 ? delayMs * 3 : delayMs,
    });
  });
  gif.finish();
  return gif.bytes();
}
