import { parseISO8601Date } from '../helpers';
import { JellyfinApi } from './jellyfinApi';
import { deviceIds, getActiveDeviceId } from './castDevices';
import { BaseItemDto } from '~/api/generated/models/base-item-dto';
import { AppStatus } from '~/types/global';

export abstract class DocumentManager {
    // Duration between each backdrop switch in ms
    private static backdropPeriodMs: number | null = 30000;
    // Timer state - so that we don't start the interval more than necessary
    private static backdropTimer = 0;

    // TODO make enum
    private static status = AppStatus.Unset;

    /**
     * Hide the document body on chromecast audio to save resources
     */
    public static initialize(): void {
        if (getActiveDeviceId() === deviceIds.AUDIO) {
            document.body.style.display = 'none';
        }
    }

    /**
     * Set the background image for a html element, without preload.
     * You should do the preloading first with preloadImage.
     *
     * @param element - HTML Element
     * @param src - URL to the image or null to remove the active one
     */
    private static setBackgroundImage(
        element: HTMLElement,
        src: string | null
    ): void {
        if (src) {
            element.style.backgroundImage = `url(${src})`;
        } else {
            element.style.backgroundImage = '';
        }
    }

    /**
     * Preload an image
     *
     * @param src - URL to the image or null
     * @returns wait for the preload and return the url to use. Might be nulled after loading error.
     */
    private static preloadImage(src: string | null): Promise<string | null> {
        if (src) {
            return new Promise((resolve, reject) => {
                const preload = new Image();

                preload.src = src;
                preload.addEventListener('load', () => {
                    resolve(src);
                });
                preload.addEventListener('error', () => {
                    // might also resolve and return null here, to have the caller take away the background.
                    reject();
                });
            });
        } else {
            return Promise.resolve(null);
        }
    }

    /**
     * Get url for primary image for a given item
     *
     * @param item - to look up
     * @returns url to image after preload
     */
    private static getPrimaryImageUrl(
        item: BaseItemDto
    ): Promise<string | null> {
        let src: string | null = null;

        if (item.AlbumPrimaryImageTag && item.AlbumId) {
            src = JellyfinApi.createImageUrl(
                item.AlbumId,
                'Primary',
                item.AlbumPrimaryImageTag
            );
        } else if (item.ImageTags?.Primary && item.Id) {
            src = JellyfinApi.createImageUrl(
                item.Id,
                'Primary',
                item.ImageTags.Primary
            );
        }

        if (
            item?.UserData?.PlayedPercentage &&
            item?.UserData?.PlayedPercentage < 100 &&
            !item.IsFolder &&
            src != null
        ) {
            src += `&PercentPlayed=${item.UserData.PlayedPercentage}`;
        }

        return this.preloadImage(src);
    }

    /**
     * Get url for logo image for a given item
     *
     * @param item - to look up
     * @returns url to logo image after preload
     */
    private static getLogoUrl(item: BaseItemDto): Promise<string | null> {
        let src: string | null = null;

        if (item.ImageTags?.Logo && item.Id) {
            src = JellyfinApi.createImageUrl(
                item.Id,
                'Logo',
                item.ImageTags.Logo
            );
        } else if (item.ParentLogoItemId && item.ParentLogoImageTag) {
            src = JellyfinApi.createImageUrl(
                item.ParentLogoItemId,
                'Logo',
                item.ParentLogoImageTag
            );
        }

        return this.preloadImage(src);
    }

    /**
     * This fucntion takes an item and shows details about it
     * on the details page. This happens when no media is playing,
     * and the connected client is browsing the library.
     *
     * @param item - to show information about
     * @returns for the page to load
     */
    public static async showItem(item: BaseItemDto): Promise<void> {
        // no showItem for cc audio
        if (getActiveDeviceId() === deviceIds.AUDIO) {
            return;
        }

        // stop cycling backdrops
        this.clearBackdropInterval();

        const promises = [
            this.getWaitingBackdropUrl(item),
            this.getPrimaryImageUrl(item),
            this.getLogoUrl(item)
        ];

        const urls = await Promise.all(promises);

        requestAnimationFrame(() => {
            this.setWaitingBackdrop(urls[0], item);
            this.setDetailImage(urls[1]);
            this.setLogo(urls[2]);

            this.setOverview(item.Overview ?? null);
            this.setGenres(item?.Genres?.join(' / ') ?? null);
            this.setDisplayName(item);
            this.setMiscInfo(item);

            this.setRating(item);

            if (item?.UserData?.Played) {
                this.setPlayedIndicator(true);
            } else if (item?.UserData?.UnplayedItemCount) {
                this.setPlayedIndicator(item?.UserData?.UnplayedItemCount);
            } else {
                this.setPlayedIndicator(false);
            }

            if (
                item?.UserData?.PlayedPercentage &&
                item?.UserData?.PlayedPercentage < 100 &&
                !item.IsFolder
            ) {
                this.setHasPlayedPercentage(false);
                this.setPlayedPercentage(item.UserData.PlayedPercentage);
            } else {
                this.setHasPlayedPercentage(false);
                this.setPlayedPercentage(0);
            }

            // Switch visible view!
            this.setAppStatus(AppStatus.Details);
        });
    }

    /**
     * Set value of played indicator
     *
     * @param value - True = played, false = not visible, number = number of unplayed items
     */
    private static setPlayedIndicator(value: boolean | number): void {
        const playedIndicatorOk = this.getElementById('played-indicator-ok');
        const playedIndicatorValue = this.getElementById(
            'played-indicator-value'
        );

        if (value === true) {
            // All items played
            this.setVisibility(playedIndicatorValue, false);
            this.setVisibility(playedIndicatorOk, true);
        } else if (value === false) {
            // No indicator
            this.setVisibility(playedIndicatorValue, false);
            this.setVisibility(playedIndicatorOk, false);
        } else {
            // number
            playedIndicatorValue.innerHTML = value.toString();
            this.setVisibility(playedIndicatorValue, true);
            this.setVisibility(playedIndicatorOk, false);
        }
    }

    /**
     * Show item, but from just the id number, not an actual item.
     * Looks up the item and then calls showItem
     *
     * @param itemId - id of item to look up
     * @returns promise that resolves when the item is shown
     */
    public static async showItemId(itemId: string): Promise<void> {
        // no showItemId for cc audio
        if (getActiveDeviceId() === deviceIds.AUDIO) {
            return;
        }

        const item: BaseItemDto = await JellyfinApi.authAjaxUser(
            `Items/${itemId}`,
            {
                dataType: 'json',
                type: 'GET'
            }
        );

        DocumentManager.showItem(item);
    }

    /**
     * Update item rating elements
     *
     * @param item - to look up
     */
    private static setRating(item: BaseItemDto): void {
        const starRating = this.getElementById('star-rating');
        const starRatingValue = this.getElementById('star-rating-value');

        if (item.CommunityRating != null) {
            starRatingValue.innerHTML = item.CommunityRating.toFixed(1);
            this.setVisibility(starRating, true);
            this.setVisibility(starRatingValue, true);
        } else {
            this.setVisibility(starRating, false);
            this.setVisibility(starRatingValue, false);
        }

        const criticRating = this.getElementById('critic-rating');
        const criticRatingValue = this.getElementById('critic-rating-value');

        if (item.CriticRating != null) {
            const verdict = item.CriticRating >= 60 ? 'fresh' : 'rotten';

            criticRating.classList.add(verdict);
            criticRating.classList.remove(
                verdict == 'fresh' ? 'rotten' : 'fresh'
            );

            criticRatingValue.innerHTML = item.CriticRating.toString();

            this.setVisibility(criticRating, true);
            this.setVisibility(criticRatingValue, true);
        } else {
            this.setVisibility(criticRating, false);
            this.setVisibility(criticRatingValue, false);
        }
    }

    /**
     * Set the status of the app, and switch the visible view
     * to the corresponding one.
     *
     * @param status - to set
     */
    public static setAppStatus(status: AppStatus): void {
        this.status = status;
        document.body.className = status;
    }

    /**
     * Get the status of the app
     *
     * @returns app status
     */
    public static getAppStatus(): AppStatus {
        return this.status;
    }

    // BACKDROP LOGIC

    /**
     * Get url to the backdrop image, and return a preload promise.
     *
     * @param item - Item to use for waiting backdrop, null to remove it.
     * @returns promise for the preload to complete
     */
    public static getWaitingBackdropUrl(
        item: BaseItemDto | null
    ): Promise<string | null> {
        // no backdrop as a fallback
        let src: string | null = null;

        if (item != null) {
            if (
                item.BackdropImageTags &&
                item.BackdropImageTags.length &&
                item.Id
            ) {
                // get first backdrop of image if applicable
                src = JellyfinApi.createImageUrl(
                    item.Id,
                    'Backdrop',
                    item.BackdropImageTags[0]
                );
            } else if (
                item.ParentBackdropItemId &&
                item.ParentBackdropImageTags &&
                item.ParentBackdropImageTags.length
            ) {
                // otherwise get first backdrop from parent
                src = JellyfinApi.createImageUrl(
                    item.ParentBackdropItemId,
                    'Backdrop',
                    item.ParentBackdropImageTags[0]
                );
            }
        }

        return this.preloadImage(src);
    }

    /**
     * Backdrops are set on the waiting container.
     * They are switched around every 30 seconds by default
     * (governed by startBackdropInterval)
     *
     * @param src - Url to image
     * @param item - Item to use for waiting backdrop, null to remove it.
     */
    public static async setWaitingBackdrop(
        src: string | null,
        item: BaseItemDto | null
    ): Promise<void> {
        let element: HTMLElement = this.querySelector(
            '#waiting-container-backdrop'
        );

        this.setBackgroundImage(element, src);

        element = this.getElementById('waiting-description');
        element.innerHTML = item?.Name ?? '';
    }

    /**
     * Set a random backdrop on the waiting container
     *
     * @returns promise waiting for the backdrop to be set
     */
    private static async setRandomUserBackdrop(): Promise<void> {
        const result = await JellyfinApi.authAjaxUser('Items', {
            dataType: 'json',
            query: {
                ImageTypes: 'Backdrop',
                IncludeItemTypes: 'Movie,Series',
                Limit: 1,
                MaxOfficialRating: 'PG-13',
                Recursive: true,
                SortBy: 'Random'
                // Although we're limiting to what the user has access to,
                // not everyone will want to see adult backdrops rotating on their TV.
            },
            type: 'GET'
        });

        let src: string | null = null;
        let item: BaseItemDto | null = null;

        if (result.Items && result.Items[0]) {
            item = result.Items[0];
            src = await DocumentManager.getWaitingBackdropUrl(item);
        }

        requestAnimationFrame(() => {
            DocumentManager.setWaitingBackdrop(src, item);
        });
    }

    /**
     * Stop the backdrop rotation
     */
    public static clearBackdropInterval(): void {
        if (this.backdropTimer !== 0) {
            clearInterval(this.backdropTimer);
            this.backdropTimer = 0;
        }
    }

    /**
     * Start the backdrop rotation, restart if running, stop if disabled
     *
     * @returns promise for the first backdrop to be set
     */
    public static async startBackdropInterval(): Promise<void> {
        // no backdrop rotation for cc audio
        if (getActiveDeviceId() === deviceIds.AUDIO) {
            return;
        }

        // avoid running it multiple times
        this.clearBackdropInterval();

        // skip out if it's disabled
        if (!this.backdropPeriodMs) {
            this.setWaitingBackdrop(null, null);

            return;
        }

        this.backdropTimer = <any>(
            setInterval(
                () => DocumentManager.setRandomUserBackdrop(),
                this.backdropPeriodMs
            )
        );

        await this.setRandomUserBackdrop();
    }

    /**
     * Set interval between backdrop changes, null to disable
     *
     * @param period - in milliseconds or null
     */
    public static setBackdropPeriodMs(period: number | null): void {
        if (period !== this.backdropPeriodMs) {
            this.backdropPeriodMs = period;

            // If the timer was running, restart it
            if (this.backdropTimer !== 0) {
                // startBackdropInterval will also clear the previous one
                this.startBackdropInterval();
            }

            if (period === null) {
                // No backdrop is wanted, and the timer has been cleared.
                // This call will remove any present backdrop.
                this.setWaitingBackdrop(null, null);
            }
        }
    }

    /**
     * Set background behind the media player,
     * this is shown while the media is loading.
     *
     * @param item - to get backdrop from
     */
    public static setPlayerBackdrop(item: BaseItemDto): void {
        // no backdrop rotation for cc audio
        if (getActiveDeviceId() === deviceIds.AUDIO) {
            return;
        }

        let backdropUrl: string | null = null;

        if (
            item.BackdropImageTags &&
            item.BackdropImageTags.length &&
            item.Id
        ) {
            backdropUrl = JellyfinApi.createImageUrl(
                item.Id,
                'Backdrop',
                item.BackdropImageTags[0]
            );
        } else if (
            item.ParentBackdropItemId &&
            item.ParentBackdropImageTags &&
            item.ParentBackdropImageTags.length
        ) {
            backdropUrl = JellyfinApi.createImageUrl(
                item.ParentBackdropItemId,
                'Backdrop',
                item.ParentBackdropImageTags[0]
            );
        }

        if (backdropUrl != null) {
            window.mediaElement?.style.setProperty(
                '--background-image',
                `url("${backdropUrl}")`
            );
        } else {
            window.mediaElement?.style.removeProperty('--background-image');
        }
    }
    /* /BACKDROP LOGIC */

    /**
     * Set the URL to the item logo, or null to remove it
     *
     * @param src - Source url or null
     */
    public static setLogo(src: string | null): void {
        const element: HTMLElement = this.querySelector('.detailLogo');

        this.setBackgroundImage(element, src);
    }

    /**
     * Set the URL to the item banner image (I think?),
     * or null to remove it
     *
     * @param src - Source url or null
     */
    public static setDetailImage(src: string | null): void {
        const element: HTMLElement = this.querySelector('.detailImage');

        this.setBackgroundImage(element, src);
    }

    /**
     * Set the human readable name for an item
     *
     * This combines the old statement setDisplayName(getDisplayName(item))
     * into setDisplayName(item).
     *
     * @param item - source for the displayed name
     */
    private static setDisplayName(item: BaseItemDto): void {
        const name: string = item.EpisodeTitle ?? <string>item.Name;

        let displayName: string = name;

        if (item.Type == 'TvChannel') {
            if (item.Number) {
                displayName = `${item.Number} ${name}`;
            }
        } else if (
            item.Type == 'Episode' &&
            item.IndexNumber != null &&
            item.ParentIndexNumber != null
        ) {
            let episode = `S${item.ParentIndexNumber}, E${item.IndexNumber}`;

            if (item.IndexNumberEnd) {
                episode += `-${item.IndexNumberEnd}`;
            }

            displayName = `${episode} - ${name}`;
        }

        const element = this.querySelector('.displayName');

        element.innerHTML = displayName || '';
    }

    /**
     * Set the html of the genres container
     *
     * @param name - String/html for genres box, null to empty
     */
    private static setGenres(name: string | null): void {
        const element = this.querySelector('.genres');

        element.innerHTML = name || '';
    }

    /**
     * Set the html of the overview container
     *
     * @param name - string or html to insert
     */
    private static setOverview(name: string | null): void {
        const element = this.querySelector('.overview');

        element.innerHTML = name || '';
    }

    /**
     * Set the progress of the progress bar in the
     * item details page. (Not the same as the playback ui)
     *
     * @param value - Percentage to set
     */
    private static setPlayedPercentage(value = 0): void {
        const element = <HTMLInputElement>(
            this.querySelector('.itemProgressBar')
        );

        element.value = value.toString();
    }

    /**
     * Set the visibility of the item progress bar in the
     * item details page
     *
     * @param value - If true, show progress on details page
     */
    private static setHasPlayedPercentage(value: boolean): void {
        const element = this.querySelector('.detailImageProgressContainer');

        if (value) {
            (<HTMLElement>element).classList.remove('d-none');
        } else {
            (<HTMLElement>element).classList.add('d-none');
        }
    }

    /**
     * Get a human readable representation of the current position
     * in ticks
     *
     * @param ticks - tick position
     * @returns human readable position
     */
    private static formatRunningTime(ticks: number): string {
        const ticksPerHour = 36000000000;
        const ticksPerMinute = 600000000;
        const ticksPerSecond = 10000000;

        const parts: string[] = [];

        const hours: number = Math.floor(ticks / ticksPerHour);

        if (hours) {
            parts.push(hours.toString());
        }

        ticks -= hours * ticksPerHour;

        const minutes: number = Math.floor(ticks / ticksPerMinute);

        ticks -= minutes * ticksPerMinute;

        if (minutes < 10 && hours) {
            parts.push(`0${minutes.toString()}`);
        } else {
            parts.push(minutes.toString());
        }

        const seconds: number = Math.floor(ticks / ticksPerSecond);

        if (seconds < 10) {
            parts.push(`0${seconds.toString()}`);
        } else {
            parts.push(seconds.toString());
        }

        return parts.join(':');
    }

    /**
     * Set information about mostly episodes or series
     * on the item details page
     *
     * @param item - to look up
     */
    private static setMiscInfo(item: BaseItemDto): void {
        const info: Array<string> = [];

        if (item.Type == 'Episode') {
            if (item.PremiereDate) {
                try {
                    info.push(
                        parseISO8601Date(item.PremiereDate).toLocaleDateString()
                    );
                } catch (e) {
                    console.log(`Error parsing date: ${item.PremiereDate}`);
                }
            }
        }

        if (item.StartDate) {
            try {
                info.push(
                    parseISO8601Date(item.StartDate).toLocaleDateString()
                );
            } catch (e) {
                console.log(`Error parsing date: ${item.PremiereDate}`);
            }
        }

        if (item.ProductionYear && item.Type == 'Series') {
            if (item.Status == 'Continuing') {
                info.push(`${item.ProductionYear}-Present`);
            } else if (item.ProductionYear) {
                let text: string = item.ProductionYear.toString();

                if (item.EndDate) {
                    try {
                        const endYear = parseISO8601Date(
                            item.EndDate
                        ).getFullYear();

                        if (endYear != item.ProductionYear) {
                            text += `-${parseISO8601Date(
                                item.EndDate
                            ).getFullYear()}`;
                        }
                    } catch (e) {
                        console.log(`Error parsing date: ${item.EndDate}`);
                    }
                }

                info.push(text);
            }
        }

        if (item.Type != 'Series' && item.Type != 'Episode') {
            if (item.ProductionYear) {
                info.push(item.ProductionYear.toString());
            } else if (item.PremiereDate) {
                try {
                    info.push(
                        parseISO8601Date(item.PremiereDate)
                            .getFullYear()
                            .toString()
                    );
                } catch (e) {
                    console.log(`Error parsing date: ${item.PremiereDate}`);
                }
            }
        }

        let minutes;

        if (item.RunTimeTicks && item.Type != 'Series') {
            if (item.Type == 'Audio') {
                info.push(this.formatRunningTime(item.RunTimeTicks));
            } else {
                minutes = item.RunTimeTicks / 600000000;
                minutes = minutes || 1;
                info.push(`${Math.round(minutes)}min`);
            }
        }

        if (
            item.OfficialRating &&
            item.Type !== 'Season' &&
            item.Type !== 'Episode'
        ) {
            info.push(item.OfficialRating);
        }

        if (item.Video3DFormat) {
            info.push('3D');
        }

        const element = this.getElementById('miscInfo');

        element.innerHTML = info.join('&nbsp;&nbsp;&nbsp;&nbsp;');
    }

    // Generic / Helper functions
    /**
     * Set the visibility of an element
     *
     * @param element - Element to set visibility on
     * @param visible - True if the element should be visible.
     */
    private static setVisibility(element: HTMLElement, visible: boolean): void {
        if (visible) {
            element.classList.remove('d-none');
        } else {
            element.classList.add('d-none');
        }
    }

    /**
     * Get a HTMLElement from id or throw an error
     *
     * @param id - ID to look up
     * @returns HTML Element
     */
    private static getElementById(id: string): HTMLElement {
        const element = document.getElementById(id);

        if (!element) {
            throw new ReferenceError(`Cannot find element ${id} by id`);
        }

        return element;
    }

    /**
     * Get a HTMLElement by class
     *
     * @param cls - Class to look up
     * @returns HTML Element
     */
    private static querySelector(cls: string): HTMLElement {
        const element: HTMLElement | null = document.querySelector(cls);

        if (!element) {
            throw new ReferenceError(`Cannot find element ${cls} by class`);
        }

        return element;
    }
}

DocumentManager.initialize();
