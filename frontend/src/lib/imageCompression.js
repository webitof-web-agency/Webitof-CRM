// browser-image-compression is ~56 KB and only needed when someone uploads an image, so it is
// fetched on first use instead of being part of the bundle every page downloads.
export async function imageCompression(file, options) {
  const { default: compress } = await import('browser-image-compression');
  return compress(file, options);
}
