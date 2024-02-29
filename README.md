<h1 align="center">Jellyfin Chromecast Client</h1>
<h3 align="center">Part of the <a href="https://jellyfin.org">Jellyfin Project</a></h3>

<p align="center">
<img alt="Logo Banner" src="https://raw.githubusercontent.com/jellyfin/jellyfin-ux/master/branding/SVG/banner-logo-solid.svg?sanitize=true"/>
<br/>
<br/>
<a href="https://github.com/jellyfin/jellyfin">
<img alt="GPL 2.0 License" src="https://img.shields.io/github/license/jellyfin/jellyfin-chromecast.svg"/>
</a>
<a href="https://github.com/jellyfin/jellyfin/releases">
<img alt="Current Release" src="https://img.shields.io/github/release/jellyfin/jellyfin-chromecast.svg"/>
</a>
</p>

Jellyfin chromecast is a receiver used when casting to a google cast capable device. It is automatically used when casting from the jellyfin android client or jellyfin web client.

### What does it do?

As soon as you push the "cast" button on your client this application will start on you cast-capable device & handle it from there.

### What doesn't it do?

Anything related to your non-cast device (e.g. your phone, browser, other device). Any issues/features related to that: check the respective repository.

### Something not working right?
First check if the issue is actually google-cast related. So answer the question:

`"Can I reproduce the issue on any other device than a google chromecast?"`

If yes: Then the issue probably lies somewhere else. If no: Open an <a href="https://github.com/jellyfin/jellyfin-chromecast/issues/new/choose">Issue</a> on GitHub.<br/>

### Testing

Jellyfin allows switching between a `stable` and `unstable` version of the client. Go the client of your choice and: `user` -> `settings` -> `playback` -> `Google cast version`.

Note that this setting is set per-user.
