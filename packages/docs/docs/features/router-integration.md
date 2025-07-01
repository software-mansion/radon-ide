---
id: router-integration
title: Router integration
sidebar_position: 3
---

The Radon IDE integrates with your deep-linked application allowing you to jump around the navigation structure.
The extension scans your routing structure, sees the changes in the navigation state and keeps track of the visited routes.

Radon IDE router integration supports both Expo Router and React Navigation projects.

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/ide_router_integration.mp4" type="video/mp4"/>
</video>

## Dynamic routes

You can access dynamic routes by typing the exact pathname in the URL bar.

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/ide_router_integration_dynamic_routes.mp4" type="video/mp4"/>
</video>

## Router integration options

The router integration consists of:

<img width="300" src="/img/docs/ide_router_integration.png" className="shadow-image"/>

1. **Back button** - goes to the previous URL route in the navigation history.
2. **URL select** - a drop-down that allows you to quickly access the static paths in your application. Clicking on one of the displayed URLs will take you to that particular screen.
   There are a couple of options inside the URL select menu:

   - _Suggested paths_ - lists all available paths with recently visited paths displayed at the top,
   - _Go to main screen_ - navigates to the `/` route,
   - _Open a deep link..._ - allows to provide deep links and website URLs to the device. Website URLs will open in the default device browser.

  <img width="350" src="/img/docs/ide_url_select.png" className="shadow-image rounded-xl" />
