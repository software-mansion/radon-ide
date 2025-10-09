import React from "react";
import styles from "./styles.module.css";
import TestimonialCarousel from "./TestimonialCarousel";

export interface Testimonial {
  type: "linkedin" | "x" | "producthunt";
  link: string;
  author: string;
  handle: string;
  body: string;
  avatar: string;
}

const leftColumn: Testimonial[] = [
  {
    type: "x",
    link: "https://x.com/mironcatalin/status/1863908433293938930",
    author: "Catalin Miron - AnimateReactNative.com",
    handle: "@mironcatalin",
    body: `
    In my opinion, the must have Extension for React Native developers.`,
    avatar: "https://pbs.twimg.com/profile_images/1276570366555684865/7J55FrYi_400x400.jpg",
  },
  {
    type: "x",
    link: "https://x.com/Baconbrix/status/1863779718522110116",
    author: "Evan Bacon 🥓",
    handle: "@Baconbrix",
    body: "Magic debugging experience in Expo Router 🪄",
    avatar: "https://pbs.twimg.com/profile_images/1576625400205250561/wGfn72X__400x400.jpg",
  },
  {
    type: "x",
    link: "https://x.com/_davidnemes/status/1864220499217113566",
    author: "David Nemes",
    handle: "@_davidnemes",
    body: "Radon IDE by @swmansion is the React Native IDE we've all been waiting for! 🚀 The setup was incredibly simple, and it has everything you need to build amazing apps. https://ide.swmansion.com #ReactNative #devtools",
    avatar: "https://pbs.twimg.com/profile_images/1518484915381223426/eqsKVMxQ_400x400.jpg",
  },
];
const middleColumn: Testimonial[] = [
  {
    type: "x",
    link: "https://x.com/czystyl/status/1863843093004337526",
    author: "Luke Czyszczonik",
    handle: "@czystyl",
    body: "This improves the workflow by 10x!",
    avatar: "https://pbs.twimg.com/profile_images/1152544743890522112/v4QNbxbn_400x400.jpg",
  },
  {
    type: "producthunt",
    link: "https://www.producthunt.com/posts/radon-ide?comment=4190388",
    author: "Sebastien Lorber",
    handle: "@sebastienlorber",
    body: "Awesome to finally have an IDE for React Native!",
    avatar:
      "https://ph-avatars.imgix.net/968504/original.jpeg?auto=compress&codec=mozjpeg&cs=strip&auto=format&w=120&h=120&fit=crop&dpr=1",
  },
  {
    type: "producthunt",
    link: "https://www.producthunt.com/posts/radon-ide?comment=4190615",
    author: "Enzo Manuel Mangano",
    handle: "@enzomanuelmangano",
    body: "Truly a product that makes a difference and adds innovation to the React Native ecosystem. It is beyond measure the value that Software Mansion has brought to React Native already with Reanimated, Gesture Handler, React Native Screens and more...Radon IDE is the icing on the cake. And what of an icing 🤌🤌",
    avatar:
      "https://ph-avatars.imgix.net/6047108/original.jpeg?auto=compress&codec=mozjpeg&cs=strip&auto=format&w=120&h=120&fit=crop&dpr=1",
  },
];
const rightColumn: Testimonial[] = [
  {
    type: "x",
    link: "https://x.com/felippewick/status/1863630901579506065",
    author: "felippe",
    handle: "@felippe",
    body: "Amazing DX 🙌",
    avatar: "https://pbs.twimg.com/profile_images/1889709082241597440/tVDwrG3C_400x400.jpg",
  },
  {
    type: "x",
    link: "https://x.com/VadimNotJustDev/status/1863673342680596640",
    author: "Vadim Savin @notJust.dev",
    handle: "@VadimNotJustDev",
    body: "Radon IDE is a game changer for building RN apps without leaving vscode (or cursor)",
    avatar: "https://pbs.twimg.com/profile_images/1501105735584956417/fdwpCup5_400x400.jpg",
  },

  {
    type: "linkedin",
    link: "https://www.linkedin.com/feed/update/urn:li:ugcPost:7269390576926478337?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A7269390576926478337%2C7269430582307086336%29&dashCommentUrn=urn%3Ali%3Afsd_comment%3A%287269430582307086336%2Curn%3Ali%3AugcPost%3A7269390576926478337%29",
    author: "Alec Hansen",
    handle: "@alecdhansen",
    body: "Congrats SM team. I find Radon especially useful for hopping in an unfamiliar codebase. Tap a component, get taken right to the code. Saves a ton of time!",
    avatar:
      "https://media.licdn.com/dms/image/v2/D4E03AQFy_VU4VjIe8A/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1712089763617?e=1759363200&v=beta&t=ko2ECeiCC4jpePBHMwKnBW7XsbNe494EcsIUu-8-mDM",
  },
];

const data = [...leftColumn, ...middleColumn, ...rightColumn];

export default function Testimonials() {
  return (
    <section>
      <div className={styles.testimonials}>
        <h2 className={styles.testimonialsHeading}>What Engineers Say</h2>
        <div className={styles.testimonialsContainer}>
          <div className={styles.gradientStart} />
          <div className={styles.gradientEnd} />
          <div className={styles.webActive}>
            <TestimonialCarousel data={leftColumn} scrollUp={true} />
            <TestimonialCarousel data={middleColumn} scrollUp={false} />
            <TestimonialCarousel data={rightColumn} scrollUp={true} />
          </div>
          <div className={styles.mobileActive}>
            <TestimonialCarousel data={data} scrollUp={true} />
          </div>
        </div>
      </div>
    </section>
  );
}
