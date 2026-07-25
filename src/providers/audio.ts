export function downsampleToPcm16(input: Float32Array, inputRate: number, outputRate = 16000) {
  if (outputRate > inputRate) {
    throw new Error("Output sample rate must not exceed the microphone sample rate.");
  }

  const ratio = inputRate / outputRate;
  const length = Math.round(input.length / ratio);
  const output = new Int16Array(length);
  let sourceOffset = 0;

  for (let index = 0; index < length; index += 1) {
    const nextOffset = Math.round((index + 1) * ratio);
    let sum = 0;
    let count = 0;
    for (; sourceOffset < nextOffset && sourceOffset < input.length; sourceOffset += 1) {
      sum += input[sourceOffset];
      count += 1;
    }
    const sample = Math.max(-1, Math.min(1, count ? sum / count : 0));
    output[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return output;
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function base64ToPcm16(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Int16Array(bytes.buffer);
}

export async function fileToOptimizedDataUrl(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Could not read that image."));
      element.src = objectUrl;
    });

    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.84);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
