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
    reportPlaybackProgress,
    startBackdropInterval
} from './jellyfinActions';

import { playbackManager } from './playbackManager';

export interface DataMessage {
    //TODO: figure out a better type for data
    [any: string]: any;
}

interface SupportedCommands {
    [command: string]: (data: DataMessage) => any;
}

export abstract class CommandHandler {
    private static playerManager: cast.framework.PlayerManager;
    private static playbackManager: playbackManager;
    private static supportedCommands: SupportedCommands = {
        PlayNext: CommandHandler.playNextHandler,
        PlayNow: CommandHandler.playNowHandler,
        PlayLast: CommandHandler.playLastHandler,
        Shuffle: CommandHandler.shuffleHandler,
        InstantMix: CommandHandler.instantMixHandler,
        DisplayContent: CommandHandler.displayContentHandler,
        NextTrack: CommandHandler.nextTrackHandler,
        PreviousTrack: CommandHandler.previousTrackHandler,
        SetAudioStreamIndex: CommandHandler.setAudioStreamIndexHandler,
        SetSubtitleStreamIndex: CommandHandler.setSubtitleStreamIndexHandler,
        VolumeUp: CommandHandler.VolumeUpHandler,
        VolumeDown: CommandHandler.VolumeDownHandler,
        ToggleMute: CommandHandler.ToggleMuteHandler,
        Identify: CommandHandler.IdentifyHandler,
        SetVolume: CommandHandler.SetVolumeHandler,
        Seek: CommandHandler.SeekHandler,
        Mute: CommandHandler.MuteHandler,
        Unmute: CommandHandler.MuteHandler,
        Stop: CommandHandler.StopHandler,
        PlayPause: CommandHandler.PlayPauseHandler,
        Pause: CommandHandler.PauseHandler,
        SetRepeatMode: CommandHandler.SetRepeatModeHandler,
        Unpause: CommandHandler.UnpauseHandler
    };

    static configure(
        playerManager: cast.framework.PlayerManager,
        playbackManager: playbackManager
    ): void {
        this.playerManager = playerManager;
        this.playbackManager = playbackManager;
    }

    static playNextHandler(data: DataMessage): void {
        translateItems(data, data.options, data.options.items, data.command);
    }

    static playNowHandler(data: DataMessage): void {
        translateItems(data, data.options, data.options.items, data.command);
    }

    static playLastHandler(data: DataMessage): void {
        translateItems(data, data.options, data.options.items, data.command);
    }

    static shuffleHandler(data: DataMessage): void {
        shuffle(data, data.options, data.options.items[0]);
    }

    static instantMixHandler(data: DataMessage): void {
        instantMix(data, data.options, data.options.items[0]);
    }

    static displayContentHandler(data: DataMessage): void {
        if (!this.playbackManager.isPlaying()) {
            displayItem(data.options.ItemId);
        }
    }

    static nextTrackHandler(): void {
        if (
            window.playlist &&
            window.currentPlaylistIndex < window.playlist.length - 1
        ) {
            this.playbackManager.playNextItem({}, true);
        }
    }

    static previousTrackHandler(): void {
        if (window.playlist && window.currentPlaylistIndex > 0) {
            this.playbackManager.playPreviousItem({});
        }
    }

    static setAudioStreamIndexHandler(data: DataMessage): void {
        setAudioStreamIndex($scope, data.options.index);
    }

    static setSubtitleStreamIndexHandler(data: DataMessage): void {
        setSubtitleStreamIndex($scope, data.options.index);
    }

    // VolumeUp, VolumeDown and ToggleMute commands seem to be handled on the sender in the current implementation.
    // From what I can tell there's no convenient way for the receiver to get its own volume.
    // We should probably remove these commands in the future.
    static VolumeUpHandler(): void {
        console.log('VolumeUp handler not implemented');
    }

    static VolumeDownHandler(): void {
        console.log('VolumeDown handler not implemented');
    }

    static ToggleMuteHandler(): void {
        console.log('ToggleMute handler not implemented');
    }

    static SetVolumeHandler(): void {
        // This is now implemented on the sender
        console.log('SetVolume handler not implemented');
    }

    static IdentifyHandler(): void {
        if (!this.playbackManager.isPlaying()) {
            startBackdropInterval();
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

    static SeekHandler(data: DataMessage): void {
        seek(data.options.position * 10000000);
    }

    static MuteHandler(): void {
        // CommandHandler is now implemented on the sender
        console.log('Mute handler not implemented');
    }

    static UnmuteHandler(): void {
        // CommandHandler is now implemented on the sender
        console.log('Unmute handler not implemented');
    }

    static StopHandler(): void {
        this.playerManager.stop();
    }

    static PlayPauseHandler(): void {
        if (
            this.playerManager.getPlayerState() ===
            cast.framework.messages.PlayerState.PAUSED
        ) {
            this.playerManager.play();
        } else {
            this.playerManager.pause();
        }
    }

    static PauseHandler(): void {
        this.playerManager.pause();
    }

    static SetRepeatModeHandler(data: DataMessage): void {
        window.repeatMode = data.options.RepeatMode;
        window.reportEventType = 'repeatmodechange';
    }

    static UnpauseHandler(): void {
        this.playerManager.play();
    }

    // We should avoid using a defaulthandler that has a purpose other than informing the dev/user
    // Currently all unhandled commands will be treated as play commands.
    static defaultHandler(data: DataMessage): void {
        translateItems(data, data.options, data.options.items, 'play');
    }

    static processMessage(data: DataMessage, command: string): void {
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
