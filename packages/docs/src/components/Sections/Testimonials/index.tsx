import React from "react";
import styles from "./styles.module.css";
import TestimonialItem from "./TestimonialItem";

export interface Testimonial {
  id: number;
  type: "linkedin" | "x" | "producthunt";
  link: string;
  author: string;
  handle: string;
  body: string;
  avatar: string;
}

const data: Testimonial[] = [
  {
    id: 1,
    type: "x",
    link: "https://x.com/Baconbrix/status/1863779718522110116",
    author: "Evan Bacon 🥓",
    handle: "@Baconbrix",
    body: "<b>Magic debugging experience</b> in Expo Router 🪄",
    avatar: "https://pbs.twimg.com/profile_images/1576625400205250561/wGfn72X__400x400.jpg",
  },
  {
    id: 2,
    type: "linkedin",
    link: "https://www.linkedin.com/feed/update/urn:li:ugcPost:7269390576926478337?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A7269390576926478337%2C7269430582307086336%29&dashCommentUrn=urn%3Ali%3Afsd_comment%3A%287269430582307086336%2Curn%3Ali%3AugcPost%3A7269390576926478337%29",
    author: "Alec Hansen",
    handle: "@alecdhansen",
    body: "Congrats SM team. I find <b>Radon especially useful for hopping in an unfamiliar codebase</b>. Tap a component, get taken right to the code. Saves a ton of time!",
    avatar:
      "https://media.licdn.com/dms/image/v2/D4E03AQFy_VU4VjIe8A/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1712089763617?e=1738800000&v=beta&t=-IoLPOBHvxwQirMTBeKpkwNGNSRZBiYg1Z8Z2FMSANA",
  },
  {
    id: 3,
    type: "x",
    link: "https://x.com/mironcatalin/status/1863908433293938930",
    author: "Catalin Miron - AnimateReactNative.com",
    handle: "@mironcatalin",
    body: `
    In my opinion, the <b>must have Extension for React Native developers</b>. Some features that I really like:<br/>
- The preview wrapper to test any component in isolation<br/>
- Jump to file and line of code<br/>
- Route history<br/>
- No need for an extra window, the simulator lives inside the IDE<br/>
- Device settings adjustments<br/>
- I can't say <b>how many times I wish there was a tool to let me change the location that fast</b><br/>
- Fast inline element inspection (This is really useful when debugging but also when you are a new to a project and you'd like to see the structure of the views to easily learn and navigate inside the project).
`,
    avatar: "https://pbs.twimg.com/profile_images/1276570366555684865/7J55FrYi_400x400.jpg",
  },
  {
    id: 4,
    type: "producthunt",
    link: "https://www.producthunt.com/posts/radon-ide?comment=4190615",
    author: "Enzo Manuel Mangano",
    handle: "@enzomanuelmangano",
    body: "<b>Truly a product that makes a difference and adds innovation to the React Native ecosystem</b>. It is beyond measure the value that Software Mansion has brought to React Native already with Reanimated, Gesture Handler, React Native Screens and more...<br/>Radon IDE is the icing on the cake. And what of an icing 🤌🤌",
    avatar:
      "https://ph-avatars.imgix.net/6047108/original.jpeg?auto=compress&codec=mozjpeg&cs=strip&auto=format&w=120&h=120&fit=crop&dpr=1",
  },
  {
    id: 5,
    type: "producthunt",
    link: "https://www.producthunt.com/posts/radon-ide?comment=4190388",
    author: "Sebastien Lorber",
    handle: "@sebastienlorber",
    body: "Awesome to finally have <b>an IDE for React Native</b>!",
    avatar:
      "https://ph-avatars.imgix.net/968504/original.jpeg?auto=compress&codec=mozjpeg&cs=strip&auto=format&w=120&h=120&fit=crop&dpr=1",
  },
  {
    id: 6,
    type: "x",
    link: "https://x.com/czystyl/status/1863843093004337526",
    author: "Luke Czyszczonik",
    handle: "@czystyl",
    body: "This <b>improves the workflow by 10x</b>!",
    avatar: "https://pbs.twimg.com/profile_images/1152544743890522112/v4QNbxbn_400x400.jpg",
  },

  {
    id: 7,
    type: "x",
    link: "https://x.com/VadimNotJustDev/status/1863673342680596640",
    author: "Vadim Savin @notJust.dev",
    handle: "@VadimNotJustDev",
    body: "<b>Radon IDE is a game changer</b> for building RN apps without leaving vscode (or cursor)",
    avatar: "https://pbs.twimg.com/profile_images/1501105735584956417/fdwpCup5_400x400.jpg",
  },
  {
    id: 8,
    type: "x",
    link: "https://x.com/felippewick/status/1863630901579506065",
    author: "felippe",
    handle: "@felippewick",
    body: "Amazing DX 🙌",
    avatar: "https://pbs.twimg.com/profile_images/1859710852053557248/U_nrTBAh_400x400.jpg",
  },
  {
    id: 9,
    type: "x",
    link: "https://x.com/_davidnemes/status/1864220499217113566",
    author: "David Nemes",
    handle: "@_davidnemes",
    body: "Radon IDE by @swmansion is the React Native IDE we've all been waiting for! 🚀 <b>The setup was incredibly simple</b>, and it has everything you need to build amazing apps. https://ide.swmansion.com #ReactNative #devtools",
    avatar: "https://pbs.twimg.com/profile_images/1518484915381223426/eqsKVMxQ_400x400.jpg",
  },
];

export default function Testimonials() {
  return (
    <section>
      <div className={styles.testimonials}>
        <h1 className={styles.testimonialsHeading}>What engineers say</h1>
        <div className={styles.testimonialsContainer}>
          {data.map((testimonial) => (
            <TestimonialItem testimonial={testimonial} key={testimonial.id} />
          ))}
        </div>
      </div>
    </section>
  );
}
