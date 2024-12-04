import React from "react";
import styles from "./styles.module.css";
import TestimonialItem from "./TestimonialItem";

export interface Testimonial {
  id: number;
  type: "linkedin" | "x" | "producthunt";
  link: string;
  author: string;
  body: string;
  avatar: string;
}

const data: Testimonial[] = [
  {
    id: 1,
    type: "linkedin",
    link: "https://www.linkedin.com/feed/update/urn:li:ugcPost:7269390576926478337?commentUrn=urn%3Ali%3Acomment%3A%28ugcPost%3A7269390576926478337%2C7269430582307086336%29&dashCommentUrn=urn%3Ali%3Afsd_comment%3A%287269430582307086336%2Curn%3Ali%3AugcPost%3A7269390576926478337%29",
    author: "Alec Hansen",
    body: "Congrats SM team. I find Radon especially useful for hopping in an unfamiliar codebase. Tap a component, get taken right to the code. Saves a ton of time!",
    avatar:
      "https://media.licdn.com/dms/image/v2/D4E03AQFy_VU4VjIe8A/profile-displayphoto-shrink_400_400/profile-displayphoto-shrink_400_400/0/1712089763617?e=1738800000&v=beta&t=-IoLPOBHvxwQirMTBeKpkwNGNSRZBiYg1Z8Z2FMSANA",
  },
  {
    id: 2,
    type: "x",
    link: "https://x.com/mironcatalin/status/1863908433293938930",
    author: "Catalin Miron - AnimateReactNative.com",
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
