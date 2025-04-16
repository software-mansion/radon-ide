import styles from "./styles.module.css";
import * as React from "react";
import Markdown from "react-markdown";
import LinkIcon from "../ChainIcon";
import rehypeRaw from "rehype-raw";

export interface ChangelogItem {
  version: string;
  date: string;
  title: string;
  content: string;
}

interface ChangelogProps {
  changelog: ChangelogItem[];
}

const DateItem = ({ item }: { item: ChangelogItem }) => (
  <span className={styles.date}>
    {new Date(item.date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}
    <a href={`#${item.version}`} id={item.version} className={styles.link}>
      <LinkIcon width={18} height={18} />
    </a>
  </span>
);

export default function ChangelogScreen({ changelog }: ChangelogProps) {
  return (
    <div className={styles.changelogContainer}>
      {changelog.map((item) => (
        <section key={item.version} className={styles.changelogItem}>
          <div className={styles.versionContainer}>
            <DateItem item={item} />
            <code className={styles.tag}>{item.version}</code>
            <span className={styles.circle} />
          </div>
          <article className={styles.article}>
            <DateItem item={item} />
            <h2 id={item.version} className={styles.title}>
              {item.title}
            </h2>
            <Markdown rehypePlugins={[rehypeRaw]}>{item.content}</Markdown>
          </article>
        </section>
      ))}
    </div>
  );
}
