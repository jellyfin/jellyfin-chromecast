import {
    translateItems,
    shuffle,
    instantMix,
    setAudioStreamIndex,
    setSubtitleStreamIndex,
    seek,
    $scope,
    window
} from "./maincontroller";

import { getReportingParams } from "../helpers";

import { factory as jellyfinActions } from "./jellyfinactions";
import { CastReceiverContext, PlayerManager } from "chromecast-caf-receiver/cast.framework";
import { playbackManager } from "./playbackManager";
import { VolumeRequestData } from "chromecast-caf-receiver/cast.framework.messages";

export class commandHandler {
    castContext: CastReceiverContext;
    playerManager: PlayerManager;
    playbackManager: playbackManager;
    supportedCommands: {};

    constructor(castContext : CastReceiverContext, playerManager : PlayerManager, playbackManager : playbackManager) {
        this.castContext = castContext;
        this.playerManager = playerManager;
        this.playbackManager = playbackManager;

        this.supportedCommands = {
            PlayNext: this.playNextHandler,
            PlayLast: this.playLastHandler,
            Shuffle: this.shuffleHandler,
            InstantMix: this.instantMixHandler,
            DisplayContent: this.displayContentHandler,
            NextTrack: this.nextTrackHandler,
            PreviousTrack: this.previousTrackHandler,
            SetAudioStreamIndex: this.setAudioStreamIndexHandler,
            SetSubtitleStreamIndex: this.setSubtitleStreamIndexHandler,
            VolumeUp: this.VolumeUpHandler,
            VolumeDown: this.VolumeDownHandler,
            ToggleMute: this.ToggleMuteHandler,
            Identify: this.IdentifyHandler,
            SetVolume: this.SetVolumeHandler,
            Seek: this.SeekHandler,
            Mute: this.MuteHandler,
            Unmute: this.MuteHandler,
            Stop: this.StopHandler,
            PlayPause: this.PlayPauseHandler,
            Pause: this.PauseHandler,
            SetRepeatMode: this.SetRepeatModeHandler,
            Unpause: this.UnpauseHandler
        };
    }

    playNextHandler(data) {
        translateItems(data, data.options, data.options.items, data.command);
    }

    playLastHandler(data) {
        translateItems(data, data.options, data.options.items, data.command);
    }

    shuffleHandler(data) {
        shuffle(data, data.options, data.options.items[0]);
    }

    instantMixHandler(data) {
        instantMix(data, data.options, data.options.items[0]);
    }

    displayContentHandler(data) {
        if (!this.playbackManager.isPlaying()) {
            jellyfinActions.displayItem($scope, data.serverAddress, data.accessToken, data.userId, data.options.ItemId);
        }
    }

    nextTrackHandler() {
        if (window.playlist && window.currentPlaylistIndex < window.playlist.length - 1) {
            this.playbackManager.playNextItem({}, true);
        }
    }

    previousTrackHandler() {
        if (window.playlist && window.currentPlaylistIndex > 0) {
            this.playbackManager.playPreviousItem({});
        }
    }

    setAudioStreamIndexHandler(data) {
        setAudioStreamIndex($scope, data.options.index);
    }

    setSubtitleStreamIndexHandler(data) {
        setSubtitleStreamIndex($scope, data.options.index, data.serverAddress);
    }

    // VolumeUp, VolumeDown and ToggleMute commands seem to be handled on the sender in the current implementation.
    // From what I can tell there's no convenient way for the receiver to get its own volume.
    // We should probably remove these commands in the future.
    VolumeUpHandler() {
        console.log("VolumeUp handler not implemented");
    }

    VolumeDownHandler() {
        console.log("VolumeDown handler not implemented");
    }

    ToggleMuteHandler() {
        console.log("ToggleMute handler not implemented");
    }

    SetVolumeHandler(data) {
        // Scale 0-100
        let request = new VolumeRequestData();
        request.volume = { level: data.options.volume / 100 };
        this.playerManager.sendLocalMediaRequest(request);
    }

    IdentifyHandler(data) {
        if (!this.playbackManager.isPlaying()) {
            jellyfinActions.displayUserInfo($scope, data.serverAddress, data.accessToken, data.userId);
        } else {
            // When a client connects send back the initial device state (volume etc) via a playbackstop message
            jellyfinActions.reportPlaybackProgress($scope, getReportingParams($scope), true, "playbackstop");
        }
    }

    SeekHandler(data) {
        seek(data.options.position * 10000000);
    }

    MuteHandler() {
        let request = new VolumeRequestData();
        request.volume = { muted: true };
        this.playerManager.sendLocalMediaRequest(request);
    }

    UnmuteHandler() {
        let request = new VolumeRequestData();
        request.volume = { muted: false };
        this.playerManager.sendLocalMediaRequest(request);
    }

    StopHandler() {
        this.playerManager.stop();
    }

    PlayPauseHandler() {
        if (this.playerManager.getPlayerState() === cast.framework.messages.PlayerState.PAUSED) {
            this.playerManager.play();
        } else {
            this.playerManager.pause();
        }
    }

    PauseHandler() {
        this.playerManager.pause();
    }

    SetRepeatModeHandler(data) {
        window.repeatMode = data.options.RepeatMode;
        window.reportEventType = 'repeatmodechange';
    }

    UnpauseHandler() {
        this.playerManager.play();
    }

    // We should avoid using a defaulthandler that has a purpose other than informing the dev/user
    // Currently all unhandled commands will be treated as play commands.
    defaultHandler(data) {
        translateItems(data, data.options, data.options.items, 'play');
    }

    processMessage(data, command) {
        const commandHandler = this.supportedCommands[command];
        if (typeof commandHandler === "function") {
            console.debug(`Command "${command}" received. Calling identified handler.`);
            (commandHandler.bind(this))(data);
        } else {
            console.debug(`Command "${command}" received. Calling default handler.`);
            this.defaultHandler(data);
        }
    }
}
