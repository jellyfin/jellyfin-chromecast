import { RepeatMode } from './api/generated/models/repeat-mode';
import './components/maincontroller';
import './css/glyphicons.css';
import './css/jellyfin.css';

window.mediaElement = document.getElementById('video-player');

window.repeatMode = RepeatMode.RepeatNone;
