// Clipboard permission denial must not become an unhandled page error.
export async function copyText(value: string): Promise<boolean> {
	try {
		if (!navigator.clipboard?.writeText) return false;
		await navigator.clipboard.writeText(value);
		return true;
	} catch {
		return false;
	}
}
