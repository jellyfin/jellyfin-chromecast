import {
    translateItems,
    shuffle,
    instantMix,
    setAudioStreamIndex,
    setSubtitleStreamIndex,
    seek
} from './maincontroller';

import { getReportingParams } from '../helpers';

import {
    displayItem,
    displayUserInfo,
    reportPlaybackProgress
} from './jellyfinActions';

import {
    CastReceiverContext,
    PlayerManager
} from 'chromecast-caf-receiver/cast.framework';
import { playbackManager } from './playbackManager';

export interface DataMessage {
    //TODO: figure out a better type for data
    [any: string]: any;
}

interface SupportedCommands {
    [command: string]: (data: DataMessage) => any;
}

export class commandHandler {
    private castContext: CastReceiverContext;
    private playerManager: PlayerManager;
    private playbackManager: playbackManager;
    private supportedCommands: SupportedCommands = {
        PlayNext: this.playNextHandler,
        PlayNow: this.playNowHandler,
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

    constructor(
        castContext: CastReceiverContext,
        playerManager: PlayerManager,
        playbackManager: playbackManager
    ) {
        this.castContext = castContext;
        this.playerManager = playerManager;
        this.playbackManager = playbackManager;
    }

    playNextHandler(data: DataMessage): void {
        translateItems(data, data.options, data.options.items, data.command);
    }

    playNowHandler(data: DataMessage): void {
        translateItems(data, data.options, data.options.items, data.command);
    }

    playLastHandler(data: DataMessage): void {
        translateItems(data, data.options, data.options.items, data.command);
    }

    shuffleHandler(data: DataMessage): void {
        shuffle(data, data.options, data.options.items[0]);
    }

    instantMixHandler(data: DataMessage): void {
        instantMix(data, data.options, data.options.items[0]);
    }

    displayContentHandler(data: DataMessage): void {
        if (!this.playbackManager.isPlaying()) {
            displayItem(
                $scope,
                data.serverAddress,
                data.accessToken,
                data.userId,
                data.options.ItemId
            );
        }
    }

    nextTrackHandler(): void {
        if (
            window.playlist &&
            window.currentPlaylistIndex < window.playlist.length - 1
        ) {
            this.playbackManager.playNextItem({}, true);
        }
    }

    previousTrackHandler(): void {
        if (window.playlist && window.currentPlaylistIndex > 0) {
            this.playbackManager.playPreviousItem({});
        }
    }

    setAudioStreamIndexHandler(data: DataMessage): void {
        setAudioStreamIndex($scope, data.options.index);
    }

    setSubtitleStreamIndexHandler(data: DataMessage): void {
        setSubtitleStreamIndex($scope, data.options.index, data.serverAddress);
    }

    // VolumeUp, VolumeDown and ToggleMute commands seem to be handled on the sender in the current implementation.
    // From what I can tell there's no convenient way for the receiver to get its own volume.
    // We should probably remove these commands in the future.
    VolumeUpHandler(): void {
        console.log('VolumeUp handler not implemented');
    }

    VolumeDownHandler(): void {
        console.log('VolumeDown handler not implemented');
    }

    ToggleMuteHandler(): void {
        console.log('ToggleMute handler not implemented');
    }

    SetVolumeHandler(data: DataMessage): void {
        // This is now implemented on the sender
        console.log('SetVolume handler not implemented');
    }

    IdentifyHandler(data: DataMessage): void {
        if (!this.playbackManager.isPlaying()) {
            displayUserInfo(
                $scope,
                data.serverAddress,
                data.accessToken,
                data.userId
            );
        } else {
            // When a client connects send back the initial device state (volume etc) via a playbackstop message
            reportPlaybackProgress(
                $scope,
                getReportingParams($scope),
                true,
                'playbackstop'
            );
        }
    }

    SeekHandler(data: DataMessage): void {
        seek(data.options.position * 10000000);
    }

    MuteHandler(): void {
        // This is now implemented on the sender
        console.log('Mute handler not implemented');
    }

    UnmuteHandler(): void {
        // This is now implemented on the sender
        console.log('Unmute handler not implemented');
    }

    StopHandler(): void {
        this.playerManager.stop();
    }

    PlayPauseHandler(): void {
        if (
            this.playerManager.getPlayerState() ===
            cast.framework.messages.PlayerState.PAUSED
        ) {
            this.playerManager.play();
        } else {
            this.playerManager.pause();
        }
    }

    PauseHandler(): void {
        this.playerManager.pause();
    }

    SetRepeatModeHandler(data: DataMessage): void {
        window.repeatMode = data.options.RepeatMode;
        window.reportEventType = 'repeatmodechange';
    }

    UnpauseHandler(): void {
        this.playerManager.play();
    }

    // We should avoid using a defaulthandler that has a purpose other than informing the dev/user
    // Currently all unhandled commands will be treated as play commands.
    defaultHandler(data: DataMessage): void {
        translateItems(data, data.options, data.options.items, 'play');
    }

    processMessage(data: DataMessage, command: string) {
        const commandHandler = this.supportedCommands[command];
        if (typeof commandHandler === 'function') {
            console.debug(
                `Command "${command}" received. Identified handler, calling identified handler.`
            );
            commandHandler.bind(this)(data);
        } else {
            console.log(
                `Command "${command}" received. Could not identify handler, calling default handler.`
            );
            this.defaultHandler(data);
        }
    }
}
