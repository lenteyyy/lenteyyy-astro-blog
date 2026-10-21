type ImageBox = { left: number; top: number; width: number; height: number };

export function containedImageBox(box: ImageBox, naturalWidth: number, naturalHeight: number): ImageBox {
	if (naturalWidth <= 0 || naturalHeight <= 0) return box;
	const scale = Math.min(box.width / naturalWidth, box.height / naturalHeight);
	const width = naturalWidth * scale, height = naturalHeight * scale;
	return { left: box.left + (box.width - width) / 2, top: box.top + (box.height - height) / 2, width, height };
}

// FLIP only changes a temporary overlay's transform; the article never reflows.
export function imageMorphTransform(from: ImageBox, to: ImageBox): string | undefined {
	if (![from.left, from.top, from.width, from.height, to.left, to.top, to.width, to.height].every(Number.isFinite)
		|| from.width <= 0 || from.height <= 0 || to.width <= 0 || to.height <= 0) return;
	return `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
}
