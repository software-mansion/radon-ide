import React from "react";

import styles from "./styles.module.css";

import { Testimonial } from "..";

interface Props {
  testimonial: Testimonial;
}

const icons = {
  x: "https://abs.twimg.com/favicons/twitter.3.ico",
  linkedin: "https://static.licdn.com/aero-v1/sc/h/akt4ae504epesldzj74dzred8",
  producthunt: "https://ph-static.imgix.net/ph-favicon-brand-500.ico?auto=format",
};

export default function TestimonialItem({ testimonial }: Props) {
  return (
    <a href={testimonial.link} target="_blank" rel="noreferrer" className={styles.testimonial}>
      <div className={styles.row}>
        <img
          src={testimonial.avatar}
          alt={testimonial.author}
          className={styles.testimonialAvatar}
        />
        <div className={styles.authorWrapper}>
          <p className={styles.testimonialAuthor}>
            {testimonial.author} <img src={icons[testimonial.type]} className={styles.icon} />
          </p>
          <p className={styles.testimonialHandle}>{testimonial.handle}</p>
        </div>
      </div>
      <p dangerouslySetInnerHTML={{ __html: testimonial.body }} />
    </a>
  );
}
