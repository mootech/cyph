import {Component, ElementRef, Input, OnChanges, SimpleChanges} from '@angular/core';
import {config} from '../../config';
import {Env, env} from '../../env';
import {ITimer} from '../../itimer';
import {events} from '../../session/enums';
import {strings} from '../../strings';
import {Timer} from '../../timer';
import {util} from '../../util';
import {IChat} from '../chat/ichat';
import {Elements} from '../elements';
import {IDialogManager} from '../idialogmanager';


/**
 * Angular component for a link-based initial connection screen
 * (e.g. for starting a new cyph).
 */
@Component({
	selector: 'cyph-link-connection',
	templateUrl: '../../../../templates/linkconnection.html'
})
export class LinkConnection implements OnChanges {
	/** @ignore */
	private isInitiated: boolean;

	/** @ignore */
	private linkConstant: string;

	/** @ignore */
	private readonly addTimeLock: {}	= {};

	/** @ignore */
	private readonly copyLock: {}		= {};

	/** @ignore */
	@Input() public baseUrl: string;

	/** @ignore */
	@Input() public chat: IChat;

	/** @ignore */
	@Input() public dialogManager: IDialogManager;

	/** @ignore */
	@Input() public enableAdvancedFeatures: boolean;

	/** Indicates whether the advanced features menu is open. */
	public advancedFeatures: boolean;

	/** Indicates whether this link connection was initiated passively via API integration. */
	public isPassive: boolean;

	/** The link to join this connection. */
	public link: string;

	/** URL-encoded version of this link (for sms and mailto links). */
	public linkEncoded: string;

	/** @see Env */
	public env: Env	= env;

	/** Draft of queued message. */
	public queuedMessageDraft: string	= '';

	/** Counts down until link expires. */
	public timer: ITimer				= new Timer(config.cyphCountdown);

	/**
	 * Extends the countdown duration.
	 * @param milliseconds
	 */
	public async addTime (milliseconds: number) : Promise<void> {
		this.timer.addTime(milliseconds);

		return util.lock(
			this.addTimeLock,
			async () => {
				await this.dialogManager.toast({
					content: strings.timeExtended,
					delay: 2500
				});
			},
			true,
			true
		);
	}

	/** Copies link to clipboard. */
	public async copyToClipboard () : Promise<void> {
		return util.lock(
			this.copyLock,
			async () => {
				await clipboard.copy(this.linkConstant);
				await this.dialogManager.toast({
					content: strings.linkCopied,
					delay: 2500
				});
			},
			true,
			true
		);
	}

	/** @inheritDoc */
	public async ngOnChanges (changes: SimpleChanges) : Promise<void> {
		if (this.isInitiated || !this.baseUrl) {
			return;
		}

		this.isInitiated	= true;
		let isWaiting		= true;

		this.linkConstant	=
			this.baseUrl +
			(this.baseUrl.indexOf('#') > -1 ? '' : '#') +
			this.chat.session.state.sharedSecret
		;

		this.linkEncoded	= encodeURIComponent(this.linkConstant);
		this.link			= this.linkConstant;
		this.isPassive		= this.chat.session.state.wasInitiatedByAPI;

		const $element		= $(this.elementRef.nativeElement);

		if (env.isMobile) {
			const $connectLinkLink	= await Elements.waitForElement(
				() => $element.find('.connect-link-link')
			);

			/* Only allow right-clicking (for copying the link) */
			$connectLinkLink.click(e => e.preventDefault());
		}
		else {
			const $connectLinkInput	= await Elements.waitForElement(
				() => $element.find('.connect-link-input input')
			);

			const connectLinkInput	= <HTMLInputElement> $connectLinkInput[0];

			const linkInterval	= setInterval(
				() => {
					if (!isWaiting) {
						clearInterval(linkInterval);
						return;
					}
					else if (this.advancedFeatures) {
						return;
					}

					if (this.link !== this.linkConstant) {
						this.link	= this.linkConstant;
					}

					$connectLinkInput.focus();
					connectLinkInput.setSelectionRange(0, this.linkConstant.length);
				},
				1000
			);
		}

		this.chat.session.one(events.connect).then(() => {
			isWaiting			= false;
			this.link			= '';
			this.linkConstant	= '';
			this.linkEncoded	= '';

			this.timer.stop();
		});

		await this.timer.start();

		if (isWaiting) {
			this.chat.abortSetup();
		}
	}

	constructor (
		/** @ignore */
		private readonly elementRef: ElementRef
	) {}
}
