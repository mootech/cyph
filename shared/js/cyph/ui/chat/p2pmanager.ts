import {IChat} from './ichat';
import {IElements} from './ielements';
import {IP2PManager} from './ip2pmanager';
import {BaseButtonManager} from '../basebuttonmanager';
import {IDialogManager} from '../idialogmanager';
import {ISidebar} from '../isidebar';
import {IController} from '../../icontroller';
import {Strings} from '../../strings';
import {UIEvents} from '../../p2p/enums';
import {P2P} from '../../p2p/p2p';
import {IP2P} from '../../p2p/ip2p';
import {Events, Users} from '../../session/enums';


export class P2PManager extends BaseButtonManager implements IP2PManager {
	public isEnabled: boolean	= false;

	public p2p: IP2P;

	public closeButton () : void {
		this.baseButtonClick(() => this.p2p.close());
	}

	public disabledAlert () : void {
		if (this.chat.isConnected && !this.isEnabled) {
			this.dialogManager.alert({
				title: Strings.p2pTitle,
				content: Strings.p2pDisabled,
				ok: Strings.ok
			});
		}
	}

	public enable () : void {
		this.isEnabled	= true;
		this.controller.update();
	}

	public preemptivelyInitiate () : void {
		this.isEnabled	= true;
		this.p2p.accept();
	}

	public toggleSidebar () : void {
		this.baseButtonClick(() =>
			this.elements.p2pContainer.toggleClass('sidebar-open')
		);
	}

	public videoCallButton () : void {
		this.baseButtonClick(() => {
			if (this.isEnabled) {
				if (!this.p2p.isActive) {
					this.p2p.request(P2P.constants.video);
				}
				else {
					this.p2p.toggle(undefined, P2P.constants.video);
				}
			}
		});
	}

	public voiceCallButton () : void {
		this.baseButtonClick(() => {
			if (this.isEnabled) {
				if (!this.p2p.isActive) {
					this.p2p.request(P2P.constants.audio);
				}
				else {
					this.p2p.toggle(undefined, P2P.constants.audio);
				}
			}
		});
	}

	/**
	 * @param chat
	 * @param controller
	 * @param mobileMenu
	 * @param dialogManager
	 */
	public constructor (
		private chat: IChat,
		controller: IController,
		mobileMenu: () => ISidebar,
		private dialogManager: IDialogManager,
		private elements: IElements,
		forceTURN?: boolean
	) {
		super(controller, mobileMenu);

		this.p2p	= new P2P(
			this.chat.session,
			this.controller,
			forceTURN,
			this.elements.p2pMeStream[0],
			this.elements.p2pFriendStream[0]
		);



		this.chat.session.on(
			Events.p2pUI,
			async (e: {
				category: UIEvents.Categories;
				event: UIEvents.Events;
				args: any[];
			}) => {
				switch (e.category) {
					case UIEvents.Categories.base: {
						switch (e.event) {
							case UIEvents.Events.connected: {
								const isConnected: boolean	= e.args[0];

								if (isConnected) {
									this.chat.addMessage(
										Strings.p2pConnect,
										Users.app,
										undefined,
										false
									);
								}
								else {
									this.dialogManager.alert({
										title: Strings.p2pTitle,
										content: Strings.p2pDisconnect,
										ok: Strings.ok
									});

									this.chat.addMessage(
										Strings.p2pDisconnect,
										Users.app,
										undefined,
										false
									);
								}
								break;
							}
							case UIEvents.Events.enable: {
								this.enable();
								break;
							}
						}
						break;
					}
					case UIEvents.Categories.request: {
						switch (e.event) {
							case UIEvents.Events.acceptConfirm: {
								const callType: string		= e.args[0];
								const timeout: number		= e.args[1];
								const isAccepted: boolean	= e.args[2];
								const callback: Function	= e.args[3];

								if (isAccepted) {
									callback(true);
								}
								else {
									callback(await this.dialogManager.confirm({
										title: Strings.p2pTitle,
										content:
											Strings.p2pRequest + ' ' +
											Strings[callType + 'Call'] + '. ' +
											Strings.p2pWarning
										,
										ok: Strings.continueDialogAction,
										cancel: Strings.decline,
										timeout
									}));
								}

								break;
							}
							case UIEvents.Events.requestConfirm: {
								const callType: string		= e.args[0];
								const isAccepted: boolean	= e.args[1];
								const callback: Function	= e.args[2];

								if (isAccepted) {
									callback(true);
								}
								else {
									callback(await this.dialogManager.confirm({
										title: Strings.p2pTitle,
										content:
											Strings.p2pInit + ' ' +
											Strings[callType + 'Call'] + '. ' +
											Strings.p2pWarning
										,
										ok: Strings.continueDialogAction,
										cancel: Strings.cancel
									}));
								}

								break;
							}
							case UIEvents.Events.requestConfirmation: {
								this.chat.addMessage(
									Strings.p2pRequestConfirmation,
									Users.app,
									undefined,
									false
								);
								break;
							}
							case UIEvents.Events.requestRejection: {
								this.dialogManager.alert({
									title: Strings.p2pTitle,
									content: Strings.p2pDeny,
									ok: Strings.ok
								});
								break;
							}
						}
						break;
					}
				}
			}
		);
	}
}
