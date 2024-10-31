---
id: element-inspector
title: Element inspector
sidebar_position: 1
---

Element inspector lets you quickly jump from the device preview to the exact line of code where given component is defined.

To enable the element inspector, use the inspector button in the bottom-left corner of the Radon IDE panel.

<img width="300" src="/img/docs/ide_enable_inspector.png" className="shadow-image"/>

To use it, first enable the inspector and simply point-and-click on the device preview. The Radon IDE will automatically open the source file with the editor cursor pointing on the line of code where the component is defined.

<video autoPlay loop width="700" controls className="shadow-image">
  <source src="/video/2_sztudio_inspect.mp4" type="video/mp4"/>
</video>

With an element inspector enabled, you can get the exact dimensions of the element by hovering the cursor over the device preview.

<video autoPlay loop width="600" controls className="shadow-image">
  <source src="/video/ide_inspector_hovering.mp4" type="video/mp4"/>
</video>

Alternatively, you can use the inspector by right-clicking on the element visible in the device preview. A dropdown list will appear that allows you to select an element from the React view hierarchy, also allowing quick access to the element's dimensions.

<video autoPlay loop width="600" controls className="shadow-image">
  <source src="/video/ide_element_inspector.mp4" type="video/mp4"/>
</video>
