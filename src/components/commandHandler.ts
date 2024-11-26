import { getReportingParams, TicksPerSecond } from '../helpers';
import type {
    DataMessage,
    DisplayRequest,
    PlayRequest,
    SeekRequest,
    SetIndexRequest,
    SetRepeatModeRequest,
    SupportedCommands
} from '../types/global';
import { AppStatus } from '../types/appStatus';
import {
    translateItems,
    shuffle,
    instantMix,
    setAudioStreamIndex,
    setSubtitleStreamIndex,
    seek
} from './maincontroller';
import { reportPlaybackProgress } from './jellyfinActions';
import { PlaybackManager } from './playbackManager';
import { DocumentManager } from './documentManager';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class CommandHandler {
    private static playerManager: framework.PlayerManager;
    private static supportedCommands: SupportedCommands = {
        DisplayContent: CommandHandler.displayContentHandler,
        Identify: CommandHandler.IdentifyHandler,
        InstantMix: CommandHandler.instantMixHandler,
        Mute: CommandHandler.MuteHandler,
        NextTrack: CommandHandler.nextTrackHandler,
        Pause: CommandHandler.PauseHandler,
        PlayLast: CommandHandler.playLastHandler,
        PlayNext: CommandHandler.playNextHandler,
        PlayNow: CommandHandler.playNowHandler,
        PlayPause: CommandHandler.PlayPauseHandler,
        PreviousTrack: CommandHandler.previousTrackHandler,
        Seek: CommandHandler.SeekHandler,
        SetAudioStreamIndex: CommandHandler.setAudioStreamIndexHandler,
        SetRepeatMode: CommandHandler.SetRepeatModeHandler,
        SetSubtitleStreamIndex: CommandHandler.setSubtitleStreamIndexHandler,
        SetVolume: CommandHandler.SetVolumeHandler,
        Shuffle: CommandHandler.shuffleHandler,
        Stop: CommandHandler.StopHandler,
        ToggleMute: CommandHandler.ToggleMuteHandler,
        Unmute: CommandHandler.MuteHandler,
        Unpause: CommandHandler.UnpauseHandler,
        VolumeDown: CommandHandler.VolumeDownHandler,
        VolumeUp: CommandHandler.VolumeUpHandler
    };

    static configure(playerManager: framework.PlayerManager): void {
        this.playerManager = playerManager;
    }

    static playNextHandler(data: DataMessage): void {
        translateItems(data, data.options as PlayRequest, data.command);
    }

    static playNowHandler(data: DataMessage): void {
        translateItems(data, data.options as PlayRequest, data.command);
    }

    static playLastHandler(data: DataMessage): void {
        translateItems(data, data.options as PlayRequest, data.command);
    }

    static shuffleHandler(data: DataMessage): void {
        shuffle(
            data,
            data.options as PlayRequest,
            (data.options as PlayRequest).items[0]
        );
    }

    static instantMixHandler(data: DataMessage): void {
        instantMix(
            data,
            data.options as PlayRequest,
            (data.options as PlayRequest).items[0]
        );
    }

    static displayContentHandler(data: DataMessage): void {
        if (PlaybackManager.isIdle()) {
            DocumentManager.showItemId((data.options as DisplayRequest).ItemId);
        }
    }

    static nextTrackHandler(): void {
        if (PlaybackManager.hasNextItem()) {
            PlaybackManager.playNextItem(true);
        }
    }

    static previousTrackHandler(): void {
        if (PlaybackManager.hasPrevItem()) {
            PlaybackManager.playPreviousItem();
        }
    }

    static setAudioStreamIndexHandler(data: DataMessage): void {
        setAudioStreamIndex(
            PlaybackManager.playbackState,
            (data.options as SetIndexRequest).index
        );
    }

    static setSubtitleStreamIndexHandler(data: DataMessage): void {
        setSubtitleStreamIndex(
            PlaybackManager.playbackState,
            (data.options as SetIndexRequest).index
        );
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
            if (!PlaybackManager.isBuffering()) {
                DocumentManager.setAppStatus(AppStatus.Waiting);
            }

            DocumentManager.startBackdropInterval();
        } else {
            // When a client connects send back the initial device state (volume etc) via a playbackstop message
            reportPlaybackProgress(
                PlaybackManager.playbackState,
                getReportingParams(PlaybackManager.playbackState),
                true,
                'playbackstop'
            );
        }
    }

    static SeekHandler(data: DataMessage): void {
        seek(
            PlaybackManager.playbackState,
            (data.options as SeekRequest).position * TicksPerSecond
        );
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
        window.repeatMode = (data.options as SetRepeatModeRequest).RepeatMode;
        window.reportEventType = 'repeatmodechange';
    }

    static UnpauseHandler(): void {
        this.playerManager.play();
    }

    // We should avoid using a defaulthandler that has a purpose other than informing the dev/user
    // Currently all unhandled commands will be treated as play commands.
    static defaultHandler(data: DataMessage): void {
        translateItems(data, data.options as PlayRequest, 'play');
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
