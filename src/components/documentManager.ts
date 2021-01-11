import { parseISO8601Date } from '../helpers';
import { JellyfinApi } from './jellyfinApi';
import { deviceIds, getActiveDeviceId } from './castDevices';
import { BaseItemDto } from '~/api/generated/models/base-item-dto';

export abstract class DocumentManager {
    // Duration between each backdrop switch in ms
    private static backdropPeriodMs: number | null = 30000;
    // Timer state - so that we don't start the interval more than necessary
    private static backdropTimer = 0;

    // TODO make enum
    private static status = '';

    /**
     * Hide the document body on chromecast audio to save resources
     */
    public static initialize(): void {
        if (getActiveDeviceId() === deviceIds.AUDIO)
            document.body.style.display = 'none';
    }

    /**
     * Set the background image for a html element, with image preloading.
     *
     * @param {HTMLElement} element HTML Element
     * @param {string | null} src URL to the image or null to remove the active one
     * @returns {Promise<void>} wait for the background to be switched
     */
    private static setBackgroundImage(
        element: HTMLElement,
        src: string | null
    ): Promise<void> {
        if (src) {
            return new Promise((resolve, reject) => {
                const preload = new Image();
                preload.src = src;
                preload.addEventListener('load', () => {
                    requestAnimationFrame(() => {
                        element.style.backgroundImage = `url(${src})`;
                        resolve();
                    });
                });
                preload.addEventListener('error', () => {
                    reject();
                });
            });
        } else {
            element.style.backgroundImage = '';
            return Promise.resolve();
        }
    }

    /**
     * Get url for primary image for a given item
     *
     * @param {BaseItemDto} item to look up
     * @returns {string | null} url to primary image
     */
    private static getPrimaryImageUrl(item: BaseItemDto): string | null {
        if (item.AlbumPrimaryImageTag)
            return JellyfinApi.createUrl(
                `Items/${item.AlbumId}/Images/Primary?tag=${item.AlbumPrimaryImageTag}`
            );
        else if (item.ImageTags?.Primary)
            return JellyfinApi.createUrl(
                `Items/${item.Id}/Images/Primary?tag=${item.ImageTags.Primary}`
            );
        else return null;
    }

    /**
     * Get url for logo image for a given item
     *
     * @param {BaseItemDto} item to look up
     * @returns {string | null} url to logo image
     */
    private static getLogoUrl(item: BaseItemDto): string | null {
        if (item.ImageTags?.Logo)
            return JellyfinApi.createUrl(
                `Items/${item.Id}/Images/Logo/0?tag=${item.ImageTags.Logo}`
            );
        else if (item.ParentLogoItemId && item.ParentLogoImageTag)
            return JellyfinApi.createUrl(
                `Items/${item.ParentLogoItemId}/Images/Logo/0?tag=${item.ParentLogoImageTag}`
            );
        else return null;
    }

    /**
     * This fucntion takes an item and shows details about it
     * on the details page. This happens when no media is playing,
     * and the connected client is browsing the library.
     *
     * @param {BaseItemDto} item to show information about
     */
    public static showItem(item: BaseItemDto): void {
        // no showItem for cc audio
        if (getActiveDeviceId() === deviceIds.AUDIO) return;

        // stop cycling backdrops
        this.clearBackdropInterval();

        this.setAppStatus('details');
        this.setWaitingBackdrop(item);

        this.setLogo(this.getLogoUrl(item));
        this.setOverview(item.Overview ?? null);
        this.setGenres(item?.Genres?.join(' / ') ?? null);
        this.setDisplayName(item);

        this.setMiscInfo(item);

        const detailRating = this.getElementById('detailRating');
        detailRating.innerHTML = this.getRatingHtml(item);

        if (item?.UserData?.Played) {
            this.setPlayedIndicator(true);
        } else if (item?.UserData?.UnplayedItemCount) {
            this.setPlayedIndicator(item?.UserData?.UnplayedItemCount);
        } else {
            this.setPlayedIndicator(false);
        }

        let detailImageUrl = this.getPrimaryImageUrl(item);

        if (
            item?.UserData?.PlayedPercentage &&
            item?.UserData?.PlayedPercentage < 100 &&
            !item.IsFolder
        ) {
            this.setHasPlayedPercentage(false);
            this.setPlayedPercentage(item.UserData.PlayedPercentage);

            if (detailImageUrl != null)
                detailImageUrl +=
                    '&PercentPlayed=' +
                    item.UserData.PlayedPercentage.toString();
        } else {
            this.setHasPlayedPercentage(false);
            this.setPlayedPercentage(0);
        }

        this.setDetailImage(detailImageUrl);
    }

    /**
     * Set value of played indicator
     *
     * @param {boolean | number} value True = played, false = not visible, number = number of unplayed items
     */
    private static setPlayedIndicator(value: boolean | number): void {
        const playedIndicator = this.getElementById('playedIndicator');

        if (value === true) {
            // All items played
            this.setVisibility(playedIndicator, true);
            playedIndicator.innerHTML =
                '<span class="glyphicon glyphicon-ok"></span>';
        } else if (value === false) {
            // No indicator
            this.setVisibility(playedIndicator, false);
        } else {
            // number
            this.setVisibility(playedIndicator, true);
            playedIndicator.innerHTML = value.toString();
        }
    }

    /**
     * Show item, but from just the id number, not an actual item.
     * Looks up the item and then calls showItem
     *
     * @param {string} itemId id of item to look up
     * @returns {Promise<void>} promise that resolves when the item is shown
     */
    public static async showItemId(itemId: string): Promise<void> {
        // no showItemId for cc audio
        if (getActiveDeviceId() === deviceIds.AUDIO) return;

        const item: BaseItemDto = await JellyfinApi.authAjaxUser(
            'Items/' + itemId,
            {
                dataType: 'json',
                type: 'GET'
            }
        );

        DocumentManager.showItem(item);
    }

    /**
     * Get HTML content used to display the rating of an item
     *
     * @param {BaseItemDto} item to look up
     * @returns {string} html to put in document
     */
    private static getRatingHtml(item: BaseItemDto): string {
        let html = '';
        if (item.CommunityRating != null) {
            html +=
                `<div class="starRating" title="${item.CommunityRating}"></div>` +
                '<div class="starRatingValue">' +
                item.CommunityRating.toFixed(1) +
                '</div>';
        }

        if (item.CriticRating != null) {
            const verdict = item.CriticRating >= 60 ? 'fresh' : 'rotten';
            html +=
                `<div class="${verdict} rottentomatoesicon" title="${verdict}"></div>` +
                `<div class="criticRating">${item.CriticRating}%</div>`;
        }

        return html;
    }

    /**
     * Set the status of the app, and switch the visible view
     * to the corresponding one.
     *
     * @param {string} status to set
     */
    public static setAppStatus(status: string): void {
        this.status = status;
        document.body.className = status;
    }

    /**
     * Get the status of the app
     *
     * @returns {string} app status
     */
    public static getAppStatus(): string {
        return this.status;
    }

    /**
     * BACKDROP LOGIC
     *
     * Backdrops are set on the waiting container.
     * They are switched around every 30 seconds by default
     * (governed by startBackdropInterval)
     *
     * @param {BaseItemDto | null} item Item to use for waiting backdrop, null to remove it.
     */
    public static async setWaitingBackdrop(
        item: BaseItemDto | null
    ): Promise<void> {
        // no backdrop as a fallback
        let src: string | null = null;

        if (item != null) {
            if (item.BackdropImageTags && item.BackdropImageTags.length) {
                // get first backdrop of image if applicable
                src = JellyfinApi.createUrl(
                    `Items/${item.Id}/Images/Backdrop/0?tag=${item.BackdropImageTags[0]}`
                );
            } else if (
                item.ParentBackdropItemId &&
                item.ParentBackdropImageTags &&
                item.ParentBackdropImageTags.length
            ) {
                // otherwise get first backdrop from parent
                src = JellyfinApi.createUrl(
                    `Items/${item.ParentBackdropItemId}/Images/Backdrop/0?tag=${item.ParentBackdropImageTags[0]}`
                );
            }
        }

        let element: HTMLElement = this.querySelector(
            '#waiting-container-backdrop'
        );

        await this.setBackgroundImage(element, src);

        element = this.querySelector('.waitingDescription');
        element.innerHTML = item?.Name ?? '';
    }

    /**
     * Set a random backdrop on the waiting container
     *
     * @returns {Promise<void>} promise waiting for the backdrop to be set
     */
    private static setRandomUserBackdrop(): Promise<void> {
        return JellyfinApi.authAjaxUser('Items', {
            dataType: 'json',
            type: 'GET',
            query: {
                SortBy: 'Random',
                IncludeItemTypes: 'Movie,Series',
                ImageTypes: 'Backdrop',
                Recursive: true,
                Limit: 1,
                // Although we're limiting to what the user has access to,
                // not everyone will want to see adult backdrops rotating on their TV.
                MaxOfficialRating: 'PG-13'
            }
        }).then((result) => {
            if (result.Items && result.Items[0])
                return DocumentManager.setWaitingBackdrop(result.Items[0]);
            else return DocumentManager.setWaitingBackdrop(null);
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
     * @returns {Promise<void>} promise for the first backdrop to be set
     */
    public static async startBackdropInterval(): Promise<void> {
        // no backdrop rotation for cc audio
        if (getActiveDeviceId() === deviceIds.AUDIO) return;

        // avoid running it multiple times
        this.clearBackdropInterval();

        // skip out if it's disabled
        if (!this.backdropPeriodMs) {
            this.setWaitingBackdrop(null);
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
     * @param {number | null} period in milliseconds or null
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
                this.setWaitingBackdrop(null);
            }
        }
    }

    /**
     * Set background behind the media player,
     * this is shown while the media is loading.
     *
     * @param {BaseItemDto} item to get backdrop from
     */
    public static setPlayerBackdrop(item: BaseItemDto): void {
        // no backdrop rotation for cc audio
        if (getActiveDeviceId() === deviceIds.AUDIO) return;

        let backdropUrl: string | null = null;

        if (item.BackdropImageTags && item.BackdropImageTags.length) {
            backdropUrl = JellyfinApi.createUrl(
                `Items/${item.Id}/Images/Backdrop/0?tag=${item.BackdropImageTags[0]}`
            );
        } else if (
            item.ParentBackdropItemId &&
            item.ParentBackdropImageTags &&
            item.ParentBackdropImageTags.length
        ) {
            backdropUrl = JellyfinApi.createUrl(
                `Items/${item.ParentBackdropItemId}/Images/Backdrop/0?tag=${item.ParentBackdropImageTags[0]}`
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
     * @param {string | null} src Source url or null
     */
    public static setLogo(src: string | null): void {
        const element: HTMLElement = this.querySelector('.detailLogo');
        this.setBackgroundImage(element, src);
    }

    /**
     * Set the URL to the item banner image (I think?),
     * or null to remove it
     *
     * @param {string | null} src Source url or null
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
     * @param {BaseItemDto} item source for the displayed name
     */
    private static setDisplayName(item: BaseItemDto): void {
        const name: string = item.EpisodeTitle ?? <string>item.Name;

        let displayName: string = name;

        if (item.Type == 'TvChannel') {
            if (item.Number) displayName = `${item.Number} ${name}`;
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
     * @param {string | null} name String/html for genres box, null to empty
     */
    private static setGenres(name: string | null): void {
        const element = this.querySelector('.genres');
        element.innerHTML = name || '';
    }

    /**
     * Set the html of the overview container
     *
     * @param {string | null} name string or html to insert
     */
    private static setOverview(name: string | null): void {
        const element = this.querySelector('.overview');
        element.innerHTML = name || '';
    }

    /**
     * Set the progress of the progress bar in the
     * item details page. (Not the same as the playback ui)
     *
     * @param {number} value Percentage to set
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
     * @param {boolean} value If true, show progress on details page
     */
    private static setHasPlayedPercentage(value: boolean): void {
        const element = this.querySelector('.detailImageProgressContainer');
        if (value) (<HTMLElement>element).classList.remove('d-none');
        else (<HTMLElement>element).classList.add('d-none');
    }

    /**
     * Get a human readable representation of the current position
     * in ticks
     *
     * @param {number} ticks tick position
     * @returns {string} human readable position
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
            parts.push('0' + minutes.toString());
        } else {
            parts.push(minutes.toString());
        }

        const seconds: number = Math.floor(ticks / ticksPerSecond);

        if (seconds < 10) {
            parts.push('0' + seconds.toString());
        } else {
            parts.push(seconds.toString());
        }

        return parts.join(':');
    }

    /**
     * Set information about mostly episodes or series
     * on the item details page
     *
     * @param {BaseItemDto} item to look up
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
                    console.log('Error parsing date: ' + item.PremiereDate);
                }
            }
        }
        if (item.StartDate) {
            try {
                info.push(
                    parseISO8601Date(item.StartDate).toLocaleDateString()
                );
            } catch (e) {
                console.log('Error parsing date: ' + item.PremiereDate);
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
                            text +=
                                '-' +
                                parseISO8601Date(item.EndDate).getFullYear();
                        }
                    } catch (e) {
                        console.log('Error parsing date: ' + item.EndDate);
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
                    console.log('Error parsing date: ' + item.PremiereDate);
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
                info.push(Math.round(minutes) + 'min');
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
     * @param {HTMLElement} element Element to set visibility on
     * @param {boolean} visible True if the element should be visible.
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
     * @param {string} id ID to look up
     * @returns {HTMLElement} HTML Element
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
     * @param {string} cls Class to look up
     * @returns {HTMLElement} HTML Element
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
