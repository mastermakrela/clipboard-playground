/**
 * Writes arbitrary types through a trusted copy event: execCommand('copy') dispatches one with
 * isTrusted=true, and clipboardData.setData accepts any type string there (unlike clipboard.write).
 */
export function copyViaEvent(data: [type: string, value: string][]) {
	let trusted = false;
	const onCopy = (e: ClipboardEvent) => {
		e.preventDefault();
		trusted = e.isTrusted;
		for (const [type, value] of data) e.clipboardData?.setData(type, value);
	};
	// Safari: execCommand('copy') returns false without a selection, so select a throwaway input
	const sink = Object.assign(document.createElement('input'), { value: ' ' });
	sink.style.cssText = 'position: fixed; top: 0; opacity: 0';
	document.body.append(sink);
	sink.select();
	document.addEventListener('copy', onCopy, { once: true });
	const ok = document.execCommand('copy');
	document.removeEventListener('copy', onCopy);
	sink.remove();
	return { ok, trusted };
}
