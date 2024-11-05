---
id: router-integration
title: Router integration
sidebar_position: 3
---

The Radon IDE integrates with your deep-linked application allowing you to jump around the navigation structure.
The extension automatically detects the changes in the navigation state and keeps track of the visited routes.

Radon IDE router integration supports both Expo Router and React Navigation projects.

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/4_sztudio_url_bar.mp4" type="video/mp4"/>
</video>

## Using the integration

The router integration consists of 3 features:

<img width="300" src="/img/docs/ide_router_integration.png" className="shadow-image"/>

1. **Back button** - goes to the previous URL route in the navigation history.
2. **Go to main screen button** - navigates to the `/` route.
3. **URL select** - a drop-down that allows to quickly visit recently used and all visited navigation URLs. Clicking on one of the displayed URLs will take you to that particular screen.

<img width="125" src="/img/docs/ide_url_select.png" />
