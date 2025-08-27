import React from "react";
import styles from "./styles.module.css";
import { Testimonial } from "..";

interface Props {
  testimonial: Testimonial;
}

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
          <p className={styles.testimonialAuthor}>{testimonial.author}</p>
          <p className={styles.testimonialHandle}>{testimonial.handle}</p>
        </div>
      </div>
      <p dangerouslySetInnerHTML={{ __html: testimonial.body }} />
    </a>
  );
}
