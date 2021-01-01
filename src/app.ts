import { RepeatMode } from './api/generated/models/repeat-mode';
import i18n from './i18n';
import './components/maincontroller';
import './css/jellyfin.css';

const senders = cast.framework.CastReceiverContext.getInstance().getSenders();
const id =
    senders.length !== 0 && senders[0].id
        ? senders[0].id
        : new Date().getTime();

window.deviceInfo = {
    deviceId: id,
    deviceName: 'Google Cast',
    versionNumber: RECEIVERVERSION
};

window.mediaElement = document.getElementById('video-player');

window.playlist = [];
window.currentPlaylistIndex = -1;
window.repeatMode = RepeatMode.RepeatNone;

window.i18n = i18n;

(document.getElementById(
    'readyToCast'
) as HTMLElement).innerText = window.i18n.t('welcome.readyToCast');

(document.getElementById(
    'selectMedia'
) as HTMLElement).innerText = window.i18n.t('welcome.selectMedia');
