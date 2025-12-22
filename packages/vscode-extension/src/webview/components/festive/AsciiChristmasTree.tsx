import { useState, useEffect, useMemo } from "react";
import "./AsciiChristmasTree.css";

interface Pixel {
  value: string;
  color?: string;
}

const COLORS = {
  white: "#ffffff",
  green: "#338a3d",
  yellow: "#dfc321",
  red: "#c22525",
  magenta: "#1f52b8",
  gray: "#808080",
};

function AsciiChristmasTree({ width = 46, height = 19 }: { width?: number; height?: number }) {
  const [baubleColors, setBaubleColors] = useState<string[]>([
    COLORS.yellow,
    COLORS.red,
    COLORS.magenta,
  ]);

  // Rotate bauble colors every 500ms for blinking effect
  useEffect(() => {
    const interval = setInterval(() => {
      setBaubleColors((prev) => {
        const rotated = [...prev];
        rotated.push(rotated.shift()!);
        return rotated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const treeImage = useMemo(() => {
    return generateFestiveScene(width, height, baubleColors);
  }, [width, height, baubleColors]);

  return (
    <div className="preview-loader-tree-container">
      <pre className="ascii-christmas-tree" aria-label="ASCII Christmas Tree">
        {treeImage.map((row, i) => (
          <div key={i} className="tree-row">
            {row.map((pixel, j) => (
              <span
                key={j}
                style={{
                  color: pixel.color || "inherit",
                }}>
                {pixel.value || " "}
              </span>
            ))}
          </div>
        ))}
      </pre>
    </div>
  );
}

function generateFestiveScene(width: number, _height: number, baubleColors: string[]): Pixel[][] {
  // Generate single centered tree with fixed size
  const treeWidth = 21;
  const tree = generateTree(treeWidth, baubleColors, 0);

  // Calculate the actual height needed for the tree
  const actualHeight = tree.length;

  // Create empty background with calculated height
  const image: Pixel[][] = Array(actualHeight)
    .fill(null)
    .map(() =>
      Array(width)
        .fill(null)
        .map(() => ({ value: " " }))
    );

  const x = Math.floor((width - treeWidth) / 2);
  pasteTree(image, tree, x, 0);

  return image;
}

function generateTree(w: number, baubleColors: string[], offset: number): Pixel[][] {
  // Ensure odd width
  if (w % 2 === 0) {
    w -= 1;
  }

  const tree: Pixel[][] = [];

  // Star on top
  tree.push(centerPixels(w, pixels(" * ", COLORS.yellow)));

  // Tree crown
  tree.push(centerPixels(w, pixels(" /_\\ ", COLORS.green)));
  tree.push(centerPixels(w, pixels(" /_\\_\\ ", COLORS.green)));

  // Tree body
  for (let i = 3; i < (w - 2) / 2; i++) {
    const left = ` ${"_\\".repeat(i)} `;
    const right = ` ${"/_".repeat(i)}\\ `;
    tree.push(centerPixels(w, pixels(left, COLORS.green)));
    tree.push(centerPixels(w, pixels(right, COLORS.green)));
  }

  // Add baubles - need to modify tree directly, not slices
  for (let rowIdx = 2; rowIdx < tree.length; rowIdx++) {
    const row = tree[rowIdx];
    const third = Math.floor(w / 3);

    const colors = [...baubleColors];
    // Rotate colors based on row for variation
    for (let r = 0; r < (offset + rowIdx) % 3; r++) {
      colors.push(colors.shift()!);
    }

    // Place baubles in three sections of the row
    const sectionRanges = [
      { start: 0, end: third },
      { start: third, end: third * 2 },
      { start: third * 2, end: w },
    ];

    sectionRanges.forEach((range, sectionIdx) => {
      // Find all underscore positions in this section
      const underscorePositions: number[] = [];
      for (let j = range.start; j < range.end && j < row.length; j++) {
        if (row[j].value === "_") {
          underscorePositions.push(j);
        }
      }

      // Place a bauble at a random underscore position
      if (underscorePositions.length > 0) {
        const randomIdx = Math.floor(Math.random() * underscorePositions.length);
        const pos = underscorePositions[randomIdx];
        row[pos] = { value: "*", color: colors[sectionIdx] };
      }
    });
  }

  // Add pot
  if (w >= 15) {
    tree.push(centerPixels(w, pixels(" [_____] ", COLORS.gray)));
    tree.push(centerPixels(w, pixels(" \\___/ ", COLORS.gray)));
  } else {
    const n = w >= 10 ? 3 : 1;
    tree.push(centerPixels(w, pixels(` \\${"_".repeat(n)}/ `, COLORS.gray)));
  }

  return tree;
}

function pixels(str: string, color: string): Pixel[] {
  return str.split("").map((c) => ({ value: c, color }));
}

function centerPixels(width: number, pixelArray: Pixel[]): Pixel[] {
  const row: Pixel[] = Array(width)
    .fill(null)
    .map(() => ({ value: " " }));
  const start = Math.floor((width - pixelArray.length) / 2);

  for (let i = 0; i < pixelArray.length; i++) {
    row[start + i] = pixelArray[i];
  }

  return row;
}

function pasteTree(bg: Pixel[][], fg: Pixel[][], x: number, y: number): void {
  const maxY = bg.length - y;

  for (let i = 0; i < fg.length; i++) {
    const row = fg[fg.length - 1 - i];
    for (let j = 0; j < row.length; j++) {
      if (row[j].value !== " ") {
        const bgRow = maxY - i - 1;
        if (bgRow >= 0 && bgRow < bg.length && x + j < bg[0].length) {
          bg[bgRow][x + j] = row[j];
        }
      }
    }
  }
}

export default AsciiChristmasTree;
