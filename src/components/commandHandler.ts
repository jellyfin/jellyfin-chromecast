import { getReportingParams } from '../helpers';
import {
    DataMessage,
    DisplayRequest,
    PlayRequest,
    SeekRequest,
    SetIndexRequest,
    SetRepeatModeRequest,
    SupportedCommands
} from '../types/global';
import {
    translateItems,
    shuffle,
    instantMix,
    setAudioStreamIndex,
    setSubtitleStreamIndex,
    seek
} from './maincontroller';

import {
    displayItem,
    reportPlaybackProgress,
    startBackdropInterval
} from './jellyfinActions';

import { PlaybackManager } from './playbackManager';

export abstract class CommandHandler {
    private static playerManager: cast.framework.PlayerManager;
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

    static configure(playerManager: cast.framework.PlayerManager): void {
        this.playerManager = playerManager;
    }

    static playNextHandler(data: DataMessage): void {
        translateItems(data, <PlayRequest>data.options, data.command);
    }

    static playNowHandler(data: DataMessage): void {
        translateItems(data, <PlayRequest>data.options, data.command);
    }

    static playLastHandler(data: DataMessage): void {
        translateItems(data, <PlayRequest>data.options, data.command);
    }

    static shuffleHandler(data: DataMessage): void {
        shuffle(
            data,
            <PlayRequest>data.options,
            (<PlayRequest>data.options).items[0]
        );
    }

    static instantMixHandler(data: DataMessage): void {
        instantMix(
            data,
            <PlayRequest>data.options,
            (<PlayRequest>data.options).items[0]
        );
    }

    static displayContentHandler(data: DataMessage): void {
        if (!PlaybackManager.isPlaying()) {
            displayItem((<DisplayRequest>data.options).ItemId);
        }
    }

    static nextTrackHandler(): void {
        if (PlaybackManager.hasNextItem())
            PlaybackManager.playNextItem({}, true);
    }

    static previousTrackHandler(): void {
        if (PlaybackManager.hasPrevItem()) PlaybackManager.playPreviousItem({});
    }

    static setAudioStreamIndexHandler(data: DataMessage): void {
        setAudioStreamIndex($scope, (<SetIndexRequest>data.options).index);
    }

    static setSubtitleStreamIndexHandler(data: DataMessage): void {
        setSubtitleStreamIndex($scope, (<SetIndexRequest>data.options).index);
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
        if (!PlaybackManager.isPlaying()) {
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
        seek((<SeekRequest>data.options).position * 10000000);
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
        window.repeatMode = (<SetRepeatModeRequest>data.options).RepeatMode;
        window.reportEventType = 'repeatmodechange';
    }

    static UnpauseHandler(): void {
        this.playerManager.play();
    }

    // We should avoid using a defaulthandler that has a purpose other than informing the dev/user
    // Currently all unhandled commands will be treated as play commands.
    static defaultHandler(data: DataMessage): void {
        translateItems(data, <PlayRequest>data.options, 'play');
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
