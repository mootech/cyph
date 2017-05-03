/**
 * If not available natively, uses a separate CSPRNG to polyfill the Web Crypto API.
 * Used in native apps and worker threads in some browsers.
 * @param seed Securely generated 32-byte key.
 */
export const webCryptoPolyfill	= (seed: Uint8Array) => {
	try {
		crypto.getRandomValues(new Uint8Array(1));
		return;
	}
	catch (_) {}

	const nonce		= new Uint32Array(2);
	let isActive	= false;

	crypto	= {
		getRandomValues: (array: ArrayBufferView) => {
			if (
				typeof (<any> self).sodium !== 'undefined' &&
				(<any> self).sodium.crypto_stream_chacha20
			) {
				isActive	= true;
			}
			else if (!isActive) {
				return array;
			}
			else {
				throw new Error('No CSPRNG found.');
			}

			++nonce[nonce[0] === 4294967295 ? 0 : 1];

			const newBytes: Uint8Array	= (<any> self).sodium.crypto_stream_chacha20(
				array.byteLength,
				seed,
				new Uint8Array(nonce.buffer)
			);

			new Uint8Array(array.buffer).set(newBytes);
			(<any> self).sodium.memzero(newBytes);

			return array;
		},

		subtle: <SubtleCrypto> {}
	};

	(<any> self).crypto	= crypto;
};
