import {CastleEvents, events, users} from '../../session/enums';
import {ISession} from '../../session/isession';
import {potassium} from '../potassium';


/**
 * Handles transport layer logic.
 * Note that each PairwiseSession must have a unique Transport instance.
 */
export class Transport {
	/** @ignore */
	private static readonly cyphertextLimit: number	= 200000;

	/** @ignore */
	public static readonly chunkLength: number		= 5000000;


	/** @ignore */
	private lastIncomingMessageTimestamp: number	= 0;

	/** @ignore */
	private readonly receivedMessages: Map<number, {data: Uint8Array; totalChunks: number}>	=
		new Map<number, {data: Uint8Array; totalChunks: number}>()
	;

	/** Queue of cyphertext interception handlers. */
	public readonly cyphertextIntercepters: ((cyphertext: Uint8Array) => void)[]	= [];

	/** Trigger abortion event. */
	public abort () : void {
		this.session.trigger(events.castle, {event: CastleEvents.abort});
	}

	/** Trigger connection event. */
	public connect () : void {
		this.session.trigger(events.castle, {event: CastleEvents.connect});
	}

	/**
	 * Intercept raw data of next incoming message before
	 * it ever hits the core Castle protocol logic.
	 */
	public async interceptIncomingCyphertext (
		timeout: number = 45000
	) : Promise<Uint8Array> {
		return new Promise<Uint8Array>((resolve, reject) => {
			this.cyphertextIntercepters.push(resolve);

			if (timeout) {
				setTimeout(
					() => reject('Cyphertext interception timeout.'),
					timeout
				);
			}
		});
	}

	/**
	 * Trigger event for logging cyphertext.
	 * @param cyphertext
	 * @param author
	 */
	public logCyphertext (cyphertext: string, author: string) : void {
		if (cyphertext.length >= Transport.cyphertextLimit) {
			return;
		}

		this.session.trigger(events.cyphertext, {author, cyphertext});
	}

	/**
	 * Handle decrypted incoming message.
	 * @param cyphertext
	 * @param plaintext
	 * @param author
	 */
	public receive (
		cyphertext: Uint8Array,
		plaintext: DataView,
		author: string
	) : void {
		this.logCyphertext(potassium.toBase64(cyphertext), author);

		const id: number		= plaintext.getFloat64(0, true);
		const timestamp: number	= plaintext.getFloat64(8, true);
		const numBytes: number	= plaintext.getFloat64(16, true);
		const numChunks: number	= plaintext.getFloat64(24, true);
		const index: number		= plaintext.getFloat64(32, true);

		const chunk: Uint8Array	= new Uint8Array(
			plaintext.buffer,
			plaintext.byteOffset + 40
		);

		if (!this.receivedMessages.has(id)) {
			this.receivedMessages.set(id, {
				data: new Uint8Array(numBytes),
				totalChunks: 0
			});
		}

		const message	= this.receivedMessages.get(id);

		message.data.set(chunk, index);
		potassium.clearMemory(plaintext);

		if (++message.totalChunks !== numChunks) {
			return;
		}

		if (timestamp > this.lastIncomingMessageTimestamp) {
			this.lastIncomingMessageTimestamp	= timestamp;

			const messageData	= potassium.toString(message.data);

			if (messageData) {
				this.session.trigger(events.castle, {
					data: {author, timestamp, plaintext: messageData},
					event: CastleEvents.receive
				});
			}
		}

		potassium.clearMemory(message.data);
		this.receivedMessages.delete(id);
	}

	/**
	 * Send outgoing encrypted message.
	 * @param cyphertext
	 * @param messageId
	 */
	public send (
		cyphertext: string|ArrayBufferView,
		messageId?: ArrayBufferView
	) : void {
		const fullCyphertext: string	= potassium.toBase64(
			!messageId ? cyphertext : potassium.concatMemory(
				true,
				messageId,
				potassium.fromBase64(cyphertext)
			)
		);

		if (!messageId && typeof cyphertext !== 'string') {
			potassium.clearMemory(cyphertext);
		}

		this.session.trigger(events.castle, {
			data: fullCyphertext,
			event: CastleEvents.send
		});

		this.logCyphertext(fullCyphertext, users.me);
	}

	constructor (
		/** @ignore */
		private readonly session: ISession
	) {}
}
