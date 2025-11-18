import React from "react";
import styles from "./styles.module.css";
import type { Testimonial } from "../";
import TestimonialItem from "../TestimonialItem";
import clsx from "clsx";

interface TestimonialCarouselProps {
  data: Testimonial[];
  scrollUp?: boolean;
}

export default function TestimonialCarousel({ data, scrollUp }: TestimonialCarouselProps) {
  const doubleData = [...data, ...data];
  return (
    <div className={styles.carouselContainer}>
      <div className={clsx(styles.carouselContent, scrollUp ? styles.up : styles.down)}>
        {doubleData.map((testimonial, index) => (
          <TestimonialItem key={index} testimonial={testimonial} />
        ))}
      </div>
    </div>
  );
}
