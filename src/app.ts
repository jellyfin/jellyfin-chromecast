import { RepeatMode } from './api/generated/models/repeat-mode';
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

window.repeatMode = RepeatMode.RepeatNone;
