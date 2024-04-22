import React from 'react';
import Layout from "@theme/Layout";

import styles from "./index.module.css";
import HeroElipse from '../components/Hero/HeroElipse';

export default function Pricing(): JSX.Element {
  return (
    <Layout description="A better developer experience for React Native developers.">
      <div className={styles.preventfulContainer}>
        <div className={styles.container}>
          <HeroElipse />
        </div>
      </div>
    </Layout>
  );
}
